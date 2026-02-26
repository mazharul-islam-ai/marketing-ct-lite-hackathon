import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { ProjectTask, TaskCategory } from './useProjectTasks';

export type TaskViewMode = 'assigned' | 'delegated' | 'all';

export interface UseMyTasksFilters {
  brandId?: string;
  category?: TaskCategory;
  status?: ProjectTask['status'];
  priority?: ProjectTask['priority'];
  page?: number;
  limit?: number;
  viewMode?: TaskViewMode;
  assigneeId?: string; // View another user's tasks (for PM dashboard drill-down)
}

export const useMyTasks = (filters?: UseMyTasksFilters) => {
  const { user } = useAuth();
  const page = filters?.page || 1;
  const limit = filters?.limit || 10;

  // If assigneeId is provided, we're viewing another user's tasks
  const targetUserId = filters?.assigneeId || user?.id;

  return useQuery({
    queryKey: ['my-tasks', targetUserId, filters],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Build base query with user filter
      // Note: creator join will only work after migration is applied
      const viewMode = filters?.viewMode || 'assigned';

      let query = (supabase as any)
        .from('project_tasks')
        .select('*', { count: 'exact' });

      // If viewing another user's tasks, show all their assigned tasks
      if (filters?.assigneeId) {
        query = query.eq('assigned_to', filters.assigneeId);
      } else {
        // Apply view mode filter for current user
        if (viewMode === 'assigned') {
          query = query.eq('assigned_to', user.id);
        } else if (viewMode === 'delegated') {
          // Tasks created by me and assigned to someone else (delegated tasks)
        query = query.neq('assigned_to', user.id);
        } else if (viewMode === 'all') {
        query = query.eq('assigned_to', user.id);
        }
      }

      query = query.order('created_at', { ascending: false });

      // Apply additional filters
      if (filters?.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      // Apply pagination
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching my tasks:', error);
        throw error;
      }

      return {
        tasks: ((data || []) as unknown as ProjectTask[]),
        count: count || 0,
      };
    },
    enabled: !!user?.id,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Hook to get all user's tasks (without pagination) for stats calculation
export const useMyTasksStats = (viewMode: TaskViewMode = 'assigned', assigneeId?: string) => {
  const { user } = useAuth();
  const targetUserId = assigneeId || user?.id;

  return useQuery({
    queryKey: ['my-tasks-stats', targetUserId, viewMode, assigneeId],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('project_tasks')
        .select('id, status');

      // If viewing another user's tasks, show all their assigned tasks
      if (assigneeId) {
        query = query.eq('assigned_to', assigneeId);
      } else {
        // Apply view mode filter for current user
        if (viewMode === 'assigned') {
          query = query.eq('assigned_to', user.id);
        } else if (viewMode === 'delegated') {
          // Tasks created by me and assigned to someone else (delegated tasks)
          query = query.neq('assigned_to', user.id);
        } else if (viewMode === 'all') {
          query = query.eq('assigned_to', user.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching my tasks stats:', error);
        throw error;
      }

      const tasks = data || [];

      return {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
      };
    },
    enabled: !!user?.id,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Hook to get user info by ID
export const useUserInfo = (userId?: string) => {
  return useQuery({
    queryKey: ['user-info', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user info:', error);
        throw error;
      }

      return data;
    },
    enabled: !!userId,
    staleTime: 60000,
  });
};
