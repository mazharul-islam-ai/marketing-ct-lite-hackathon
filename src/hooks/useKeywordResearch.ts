import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KeywordSuggestion {
  keyword: string;
  search_volume: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  relevance_score: number;
}

export interface SavedKeyword {
  id: string;
  brand_id: string;
  user_id: string;
  keyword: string;
  keyword_normalized: string;
  search_volume: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  difficulty_score: number | null;
  current_rank: number | null;
  target_rank: number | null;
  priority: 'low' | 'medium' | 'high';
  status: 'tracking' | 'targeting' | 'achieved' | 'archived';
  tags: string[] | null;
  notes: string | null;
  used_in_blog_count: number;
  last_used_in_blog: string | null;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
}

export function useKeywordSuggestions() {
  return useMutation({
    mutationFn: async ({
      brandId,
      seedKeyword,
      count = 10,
    }: {
      brandId: string;
      seedKeyword: string;
      count?: number;
    }): Promise<KeywordSuggestion[]> => {
      const { data, error } = await supabase.functions.invoke('keyword-research-api', {
        body: {
          action: 'suggest_keywords',
          brand_id: brandId,
          seed_keyword: seedKeyword,
          count,
          model,
        },
      });

      if (error) throw error;
      return data.suggestions;
    },
  });
}

export function useSaveKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyword: {
      brand_id: string;
      keyword: string;
      search_volume?: number | null;
      competition?: 'low' | 'medium' | 'high' | null;
      difficulty_score?: number | null;
      priority?: 'low' | 'medium' | 'high';
      tags?: string[];
      notes?: string;
    }): Promise<SavedKeyword> => {
      const { data, error } = await supabase.functions.invoke('keyword-research-api', {
        body: {
          action: 'save_keyword',
          ...keyword,
        },
      });

      if (error) throw error;
      return data.keyword;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['keywords', variables.brand_id] });
    },
  });
}

export function useKeywords(brandId?: string, status?: string, priority?: string) {
  return useQuery({
    queryKey: ['keywords', brandId, status, priority],
    enabled: !!brandId,
    queryFn: async (): Promise<SavedKeyword[]> => {
      const { data, error } = await supabase.functions.invoke('keyword-research-api', {
        body: {
          action: 'get_keywords',
          brand_id: brandId,
          status: status !== 'all' ? status : undefined,
          priority: priority !== 'all' ? priority : undefined,
        },
      });

      if (error) throw error;
      return data.keywords;
    },
  });
}

export function useUpdateKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      keywordId,
      updates,
      brandId,
    }: {
      keywordId: string;
      updates: Partial<SavedKeyword>;
      brandId: string;
    }): Promise<SavedKeyword> => {
      const { data, error } = await supabase.functions.invoke('keyword-research-api', {
        body: {
          action: 'update_keyword',
          keyword_id: keywordId,
          updates,
        },
      });

      if (error) throw error;
      return data.keyword;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['keywords', variables.brandId] });
    },
  });
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keywordId, brandId }: { keywordId: string; brandId: string }) => {
      const { data, error } = await supabase.functions.invoke('keyword-research-api', {
        body: {
          action: 'delete_keyword',
          keyword_id: keywordId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['keywords', variables.brandId] });
    },
  });
}
