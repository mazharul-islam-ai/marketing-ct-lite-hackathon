import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Bottleneck tag types
export interface BottleneckTag {
  reason: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
}

export interface FailureReason {
  reason: string;
  retry_safe: boolean;
  action: string;
}

export interface ContentLifecycleRequest {
  brand_id?: string;
  scope?: 'all' | 'brand';
  include?: {
    seo_blogs?: boolean;
    trends?: boolean;
    keywords?: boolean;
    velocity?: boolean;
  };
  refinement_prompt?: string;
}

export interface NormalizedPipeline {
  research: number;
  draft: number;
  review: number;
  published: number;
  failed: number;
  unknown: number;
}

export interface SLAMetrics {
  breaching_count: number;
  avg_delay_days: number;
  brand_health: Record<string, { breaches: number; total: number; health_pct: number }>;
}

export interface ContentMetrics {
  seo: {
    total: number;
    failed: number;
    generating: number;
    completed: number;
    failed_items: Array<{
      id: string;
      title: string;
      brand_id: string;
      brand_name: string;
      created_at: string;
      failure_reason: FailureReason;
    }>;
  };
  trends: {
    total: number;
    draft: number;
    ready: number;
    used: number;
    utilization_score: number;
    draft_items: Array<{
      id: string;
      topic_title: string;
      leader_id: string;
      leader_name: string;
      created_at: string;
      days_stuck: number;
      bottleneck_tags: BottleneckTag[];
    }>;
    unused_high_impact: Array<{
      id: string;
      topic_title: string;
      leader_name: string;
      days_old: number;
    }>;
  };
  keywords: {
    tracked: number;
    with_content: number;
    without_content: number;
    coverage: {
      covered: number;
      weak: number;
      not_covered: number;
    };
    high_volume_gaps: Array<{
      id: string;
      keyword: string;
      search_volume: number;
      brand_name: string;
      coverage_state: string;
    }>;
  };
  velocity: {
    this_week: number;
    last_week: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    change_pct: number;
    avg_days_to_publish: number | null;
  };
  pipeline: NormalizedPipeline;
  sla: SLAMetrics;
}

export interface ContentLifecycleAnalysis {
  weekly_summary?: string;
  summary?: string;
  pipeline_summary?: {
    research: number;
    draft: number;
    review: number;
    published: number;
    failed: number;
    conversion_research_to_draft?: string;
    conversion_draft_to_published?: string;
  };
  stuck_content?: Array<{
    type: string;
    title: string;
    status: string;
    brand?: string;
    leader?: string;
    stuck_days?: number;
    recommendation: string;
    bottleneck_tags?: BottleneckTag[];
  }>;
  trend_utilization?: {
    score: number;
    unused_high_impact: Array<{
      id: string;
      topic_title: string;
      leader_name: string;
      days_old: number;
    }>;
  };
  keyword_coverage?: {
    covered: number;
    weak: number;
    not_covered: number;
    priority_gaps: Array<{
      keyword: string;
      search_volume: number;
      coverage_state: string;
    }>;
  };
  sla_status?: {
    breaching_count: number;
    avg_delay_days: number;
    stages: Record<string, { breaches: number; avg_delay: number }>;
  };
  content_gaps?: Array<{
    type: string;
    keyword?: string;
    search_volume?: number;
    brand?: string;
    action: string;
  }>;
  velocity?: {
    this_week: number;
    last_week: number;
    trend: string;
    change_pct: number;
    avg_days_to_publish: number | null;
  };
  priority_actions?: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
  }>;
}

export interface ContentLifecycleResponse {
  success: boolean;
  analysis: ContentLifecycleAnalysis;
  metrics: ContentMetrics;
  provider_meta: {
    provider: string;
    version: string;
    api_model: string;
    response_time_ms: number;
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export function useContentLifecycleAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ContentLifecycleRequest): Promise<ContentLifecycleResponse> => {
      const { data, error } = await supabase.functions.invoke('content-lifecycle-agent', {
        body: request
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['content-lifecycle'] });
    }
  });
}

export function useLatestContentLifecycleRun(brandId?: string) {
  return useQuery({
    queryKey: ['content-lifecycle', 'latest', brandId],
    queryFn: async () => {
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('slug', 'content-lifecycle')
        .single();

      if (!agent) return null;

      let query = supabase
        .from('ai_agent_runs')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (brandId) {
        query = query.contains('execution_context', { brand_id: brandId });
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Quick metrics hook for dashboard cards
export function useContentPipelineMetrics() {
  return useQuery({
    queryKey: ['content-pipeline-metrics'],
    queryFn: async () => {
      // Fetch counts in parallel
      const [seoResult, trendsResult, keywordsResult] = await Promise.all([
        (supabase as any)
          .from('seo_blog_content')
          .select('status', { count: 'exact', head: false })
          .limit(500),
        (supabase as any)
          .from('weekly_trends')
          .select('status', { count: 'exact', head: false })
          .limit(500),
        supabase
          .from('keyword_research')
          .select('id', { count: 'exact', head: true }),
      ]);

      const seoBlogs = seoResult.data || [];
      const trends = trendsResult.data || [];

      return {
        seo: {
          total: seoBlogs.length,
          failed: seoBlogs.filter(b => b.status === 'failed').length,
          completed: seoBlogs.filter(b => b.status === 'completed').length,
        },
        trends: {
          total: trends.length,
          draft: trends.filter(t => t.status === 'draft' || t.status === 'Draft').length,
          ready: trends.filter(t => t.status === 'ready' || t.status === 'Ready').length,
        },
        keywords: {
          tracked: keywordsResult.count || 0,
        },
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
