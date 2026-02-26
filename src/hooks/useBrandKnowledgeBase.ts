import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database, Json } from "@/integrations/supabase/types";

type KnowledgeFile = Database['public']['Tables']['knowledge_files']['Row'];
type KnowledgeSource = Database['public']['Tables']['knowledge_sources']['Row'];

export interface BrandKnowledgeFile extends KnowledgeFile {
  knowledge_sources?: KnowledgeSource;
}

/**
 * Hook for managing brand-specific knowledge base files
 * Uses the shared knowledge_files table with brand_id filtering
 */
export const useBrandKnowledgeBase = (brandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch brand-specific knowledge sources
  const { data: sources, isLoading: isLoadingSources } = useQuery({
    queryKey: ['brand-knowledge-sources', brandId],
    queryFn: async () => {
      if (!brandId) return [];

      const { data, error } = await supabase
        .from('knowledge_sources')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as KnowledgeSource[];
    },
    enabled: !!brandId,
  });

  // Fetch brand-specific knowledge files
  const { data: files, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['brand-knowledge-files', brandId],
    queryFn: async () => {
      if (!brandId) return [];

      const { data, error } = await (supabase as any)
        .from('knowledge_files')
        .select('*, knowledge_sources(*)')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BrandKnowledgeFile[];
    },
    enabled: !!brandId,
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if any files are pending or processing
      const hasProcessingFiles = query.state.data?.some(
        file => file.processing_status === 'pending' || file.processing_status === 'processing'
      );
      return hasProcessingFiles ? 3000 : false;
    },
  });

  // Upload file mutation
  const uploadFile = useMutation({
    mutationFn: async ({
      file,
      sourceId,
      fileSummary
    }: {
      file: File;
      sourceId: string;
      fileSummary?: string;
    }) => {
      if (!brandId) throw new Error('Brand ID is required');
      if (!sourceId) throw new Error('Source ID is required');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('brandId', brandId);
      formData.append('sourceId', sourceId);
      if (fileSummary) formData.append('fileSummary', fileSummary);

      const { data, error } = await supabase.functions.invoke('brand-knowledge-upload', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });

      // Check if indexing was successful or failed
      if (data?.success) {
        toast({
          title: "File uploaded and indexed",
          description: data.message || "File has been successfully processed and indexed.",
        });
      } else {
        toast({
          title: "Upload completed with errors",
          description: data?.message || "File uploaded but indexing encountered issues.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation (only own files)
  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      // Hard delete since is_active column doesn't exist yet
      const { error } = await supabase
        .from('knowledge_files')
        .delete()
        .eq('id', fileId)
        .eq('brand_id', brandId); // Ensure user can only delete their brand's files

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "File deleted",
        description: "The file has been removed from the knowledge base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete stuck knowledge files via edge function
  // This properly deletes files from storage, embeddings, and database
  const deleteStuckFiles = useMutation({
    mutationFn: async (fileIds: string[]) => {
      if (!brandId) throw new Error('Brand ID is required');
      if (!fileIds || fileIds.length === 0) throw new Error('File IDs are required');

      const { data, error } = await supabase.functions.invoke('delete-stuck-knowledge-files', {
        body: { file_ids: fileIds, brand_id: brandId }
      });

      if (error) throw error;

      // Check if any files failed to delete
      if (data.failed > 0) {
        console.warn('Some files failed to delete:', data.errors);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });

      if (data.deleted > 0) {
        toast({
          title: "Files deleted",
          description: `Successfully deleted ${data.deleted} file(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
        });
      }

      if (data.failed > 0 && data.deleted === 0) {
        toast({
          title: "Delete failed",
          description: `Failed to delete ${data.failed} file(s). ${data.errors[0] || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync knowledge base mutation
  const syncKnowledge = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error('Brand ID is required');

      try {
        const { data, error } = await supabase.functions.invoke('knowledge-base', {
          body: { action: 'sync' },
        });

        if (error) throw error;
        return data;
      } catch (error) {
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('Failed to send a request')) {
            throw new Error('Edge function unavailable. Please ensure the knowledge-base function is deployed and Supabase is properly configured.');
          }
          if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection and try again.');
          }
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "Sync complete",
        description: data?.message || "Knowledge base has been synchronized.",
      });
    },
    onError: (error: Error) => {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create brand-specific knowledge source
  const createSource = useMutation({
    mutationFn: async ({
      name,
      type,
      config,
    }: {
      name: string;
      type: 'manual' | 'google_drive' | 'supabase' | 'api';
      config?: Record<string, unknown>;
    }) => {
      if (!brandId) throw new Error('Brand ID is required');

      const { data, error } = await supabase
        .from('knowledge_sources')
        .insert([{
          name,
          type,
          brand_id: brandId,
          config: (config || {}) as Json,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-sources', brandId] });
      toast({
        title: "Source created",
        description: "Knowledge source has been added to your brand.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete source
  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from('knowledge_sources')
        .update({ is_active: false })
        .eq('id', sourceId)
        .eq('brand_id', brandId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-sources', brandId] });
      toast({
        title: "Source removed",
        description: "The knowledge source has been deactivated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove source",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync Google Drive source
  const syncGoogleDriveSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke('knowledge-base', {
        body: {
          action: 'sync-google-drive',
          sourceId
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge-files', brandId] });
      toast({
        title: "Google Drive sync complete",
        description: `Synced ${data?.synced || 0} files (${data?.inserted || 0} new, ${data?.updated || 0} updated)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate statistics
  const indexedFilesCount = files?.filter(f => f.is_indexed).length || 0;
  const totalFilesCount = files?.length || 0;
  const pendingFilesCount = files?.filter(f => f.processing_status === 'pending').length || 0;
  const processingFilesCount = files?.filter(f => f.processing_status === 'processing').length || 0;
  const failedFilesCount = files?.filter(f => f.processing_status === 'failed').length || 0;

  return {
    // Data
    files,
    sources,

    // Loading states
    isLoading: isLoadingFiles || isLoadingSources,
    isLoadingFiles,
    isLoadingSources,

    // Mutations
    uploadFile,
    deleteFile,
    deleteStuckFiles,
    syncKnowledge,
    createSource,
    deleteSource,
    syncGoogleDriveSource,

    // Statistics
    indexedFilesCount,
    totalFilesCount,
    pendingFilesCount,
    processingFilesCount,
    failedFilesCount,
  };
};
