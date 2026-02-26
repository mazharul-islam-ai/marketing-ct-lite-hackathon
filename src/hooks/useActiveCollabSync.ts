import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ProjectWithCounts = {
  id: string;
  name: string;
  activecollab_project_id: string;
  activecollab_sync_at: string | null;
  task_count: number;
  comment_count: number;
};

export const useActiveCollabSync = () => {
  const queryClient = useQueryClient();

  // Fetch sync logs
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['activecollab-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activecollab_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch projects with ActiveCollab integration and their task/comment counts
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['activecollab-projects-with-counts'],
    queryFn: async () => {
      // Using type assertion since the RPC function is not yet in generated types
      const { data, error } = await (supabase.rpc as any)('get_projects_with_sync_counts');
      if (error) throw error;
      // Cast to proper type and provide fallback
      return (data as ProjectWithCounts[]) || [];
    },
  });

  // Manual full sync
  const syncAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { action: 'sync_all_with_comments' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activecollab-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['activecollab-projects-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });

      const errorCount = data.errors?.length || 0;
      
      if (errorCount > 0) {
        toast({
          title: 'Full Sync Partially Completed',
          description: `Synced ${data.projectsProcessed} projects, ${data.tasksSynced} tasks, ${data.commentsSynced} comments. ${errorCount} errors occurred.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Full Sync Completed',
          description: `Successfully synced ${data.projectsProcessed} projects, ${data.tasksSynced} tasks, and ${data.commentsSynced} comments`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Sync single project
  const syncProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.functions.invoke('activecollab-tasks', {
        body: { 
          action: 'sync_to_local',
          projectId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activecollab-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['activecollab-projects-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });

      const perfInfo = data.perfMetrics 
        ? ` (${data.perfMetrics.totalTimeMs}ms, ${data.perfMetrics.tasksPerSecond} tasks/s)`
        : '';

      toast({
        title: 'Project Synced',
        description: `Successfully synced ${data.tasksSynced || 0} tasks and ${data.commentsSynced || 0} comments${perfInfo}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Project Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Poll for sync progress (both project and full sync)
  const { data: syncProgress } = useQuery({
    queryKey: ['sync-progress'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('activecollab_sync_logs')
        .select('*')
        .eq('status', 'in_progress')
        .eq('entity_type', 'task')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!data) return null;
      
      try {
        return JSON.parse(data.error_message || '{}');
      } catch {
        return null;
      }
    },
    refetchInterval: (syncProject.isPending || syncAll.isPending) ? 1000 : false,
    enabled: syncProject.isPending || syncAll.isPending,
  });

  // Get last successful sync
  const lastSync = syncLogs?.find(log => log.status === 'success' || log.status === 'partial_success');

  return {
    syncLogs,
    projects,
    logsLoading,
    projectsLoading,
    syncAll,
    syncProject,
    syncProgress,
    lastSync,
  };
};
