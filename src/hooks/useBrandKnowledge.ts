import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandKnowledgeFile {
  id: string;
  brand_id: string;
  file_name: string;
  file_url: string;
  file_summary: string | null;
  file_type: 'upload' | 'url';
  file_size: number | null;
  mime_type: string | null;
  openai_file_id: string | null;
  openai_vector_store_id: string | null;
  file_indexed_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandFileComment {
  id: string;
  file_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  users?: {
    email: string;
  };
}

export const useBrandKnowledge = (brandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files, isLoading } = useQuery({
    queryKey: ['brand-knowledge', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const { data, error } = await supabase
        .from('brand_knowledge_files')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown) as BrandKnowledgeFile[];
    },
    enabled: !!brandId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, fileSummary }: { file: File; fileSummary?: string }) => {
      if (!brandId) throw new Error('Brand ID is required');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('brandId', brandId);
      if (fileSummary) formData.append('fileSummary', fileSummary);

      const { data, error } = await supabase.functions.invoke('brand-knowledge-upload', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge', brandId] });
      toast({
        title: "File uploaded successfully",
        description: "The file has been added to the brand knowledge base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('brand_knowledge_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge', brandId] });
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

  const indexFiles = useMutation({
    mutationFn: async ({ brandSlug }: { brandSlug: string }) => {
      if (!brandId) throw new Error('Brand ID is required');

      const { data, error } = await supabase.functions.invoke('index-brand-knowledge', {
        body: { brandId, brandSlug },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brand-knowledge', brandId] });
      toast({
        title: "Indexing complete",
        description: `Successfully indexed ${data.indexed} files.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Indexing failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const indexedFilesCount = files?.filter(f => f.openai_file_id).length || 0;
  const totalFilesCount = files?.length || 0;

  return {
    files,
    isLoading,
    uploadFile,
    deleteFile,
    indexFiles,
    indexedFilesCount,
    totalFilesCount,
  };
};

export const useBrandFileComments = (fileId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['brand-file-comments', fileId],
    queryFn: async () => {
      if (!fileId) return [];
      const { data, error } = await supabase
        .from('brand_file_comments')
        .select('*, users(email)')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as BrandFileComment[];
    },
    enabled: !!fileId,
  });

  const addComment = useMutation({
    mutationFn: async ({ comment }: { comment: string }) => {
      if (!fileId) throw new Error('File ID is required');

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('brand_file_comments')
        .insert({
          file_id: fileId,
          user_id: userData.user.id,
          comment,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-file-comments', fileId] });
      toast({
        title: "Comment added",
        description: "Your comment has been added to the file.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('brand_file_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-file-comments', fileId] });
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
  };
};
