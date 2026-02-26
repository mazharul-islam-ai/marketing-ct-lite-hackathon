import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLeaders,
  fetchLeader,
  createLeader,
  updateLeader,
  deleteLeader,
  fetchUploads,
  createUpload,
  deleteUpload,
  fetchWeeklyTrends,
  generateWeeklyTrends,
  fetchGeneratedPosts,
  generatePost,
  updateGeneratedPost,
  deleteGeneratedPost,
} from "./api";
import {
  LinkedInLeader,
  LeaderInput,
  LeaderUpload,
  UploadInput,
  WeeklyTrend,
  GeneratedPost,
  GeneratePostInput,
  UpdatePostInput,
} from "./types";

const leaderListKey = ["linkedin", "leaders"] as const;
const leaderKey = (leaderId: string) => ["linkedin", "leaders", leaderId] as const;
const uploadsKey = (leaderId: string) => ["linkedin", "leaders", leaderId, "uploads"] as const;
const trendsKey = (leaderId: string) => ["linkedin", "leaders", leaderId, "trends"] as const;
const postsKey = (leaderId: string) => ["linkedin", "leaders", leaderId, "posts"] as const;

export const useLinkedInLeaders = () =>
  useQuery<LinkedInLeader[]>({
    queryKey: leaderListKey,
    queryFn: fetchLeaders,
  });

export const useLinkedInLeader = (leaderSlugOrId?: string) => {
  return useQuery<LinkedInLeader>({
    queryKey: ['linkedin-leader', leaderSlugOrId],
    queryFn: async () => {
      if (!leaderSlugOrId) throw new Error("Missing leader id or slug");
      
      // Try fetching by ID first (if it's a UUID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leaderSlugOrId);
      
      if (isUUID) {
        return await fetchLeader(leaderSlugOrId);
      }
      
      // Otherwise, fetch by slug and transform to LinkedInLeader
      const { data, error } = await (supabase as any)
        .from('thought_leaders')
        .select('*')
        .eq('url_slug', leaderSlugOrId)
        .single();
      
      if (error) throw error;
      
      // Transform database result to LinkedInLeader type (same as in api.ts)
      return {
        id: data.id,
        name: data.name,
        title: data.title,
        department: data.department,
        linkedinUrl: data.linkedin_url,
        personaTone: data.persona_tone,
        personalContext: data.personal_context as any,
        targetAudience: data.target_audience as any,
        agentTemplateId: data.agent_template_id,
        urlSlug: data.url_slug,
        styleOverrides: data.style_overrides as any,
        targetClientSegments: data.target_client_segments || [],
        // Niche & Growth Phase fields
        nicheKeyword: (data as any).niche_keyword ?? null,
        nicheDomain: (data as any).niche_domain ?? null,
        contentPhase: (data as any).content_phase ?? null,
        contentPhaseStartDate: (data as any).content_phase_start_date ?? null,
        weeklyRhythm: (data as any).weekly_rhythm ?? { teaching: 2, opinion: 1, how_to: 1 },
        postsThisWeek: (data as any).posts_this_week ?? { teaching: 0, opinion: 0, how_to: 0 },
        postsWeekStart: (data as any).posts_week_start ?? null,
        uploadCount: 0,
        trendCount: 0,
        generatedPostCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as LinkedInLeader;
    },
    enabled: !!leaderSlugOrId,
  });
};

export const useCreateLeader = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: LeaderInput) => createLeader(payload),
    onSuccess: (leader) => {
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      if (leader?.id) {
        queryClient.setQueryData(leaderKey(leader.id), leader);
      }
      toast({ title: "Leader created", description: `${leader.name} was added.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create leader", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateLeader = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: LeaderInput) => {
      if (!leaderId) throw new Error("Leader id is required");
      return updateLeader(leaderId, payload);
    },
    onSuccess: (leader) => {
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      queryClient.invalidateQueries({ queryKey: leaderKey(leaderId) });
      toast({ title: "Leader updated", description: `${leader.name}'s profile was updated.` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update leader", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteLeader = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (leaderId: string) => deleteLeader(leaderId),
    onSuccess: (_, leaderId) => {
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      queryClient.removeQueries({ queryKey: leaderKey(leaderId) });
      toast({ title: "Leader removed", description: "The leader was deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete leader", description: error.message, variant: "destructive" });
    },
  });
};

export const useLeaderUploads = (leaderId?: string) =>
  useQuery<LeaderUpload[]>({
    queryKey: leaderId ? uploadsKey(leaderId) : leaderListKey,
    queryFn: () => (leaderId ? fetchUploads(leaderId) : Promise.reject(new Error("Missing leader id"))),
    enabled: !!leaderId,
  });

export const useCreateUpload = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: UploadInput) => {
      if (!leaderId) throw new Error("Leader id is required");
      return createUpload(leaderId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadsKey(leaderId) });
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      toast({ title: "Upload saved", description: "Reference document added." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save upload", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteUpload = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (uploadId: string) => {
      if (!leaderId) throw new Error("Leader id is required");
      return deleteUpload(leaderId, uploadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadsKey(leaderId) });
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      toast({ title: "Upload removed", description: "The upload was deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete upload", description: error.message, variant: "destructive" });
    },
  });
};

export const useWeeklyTrends = (leaderId?: string) =>
  useQuery<WeeklyTrend[]>({
    queryKey: leaderId ? trendsKey(leaderId) : leaderListKey,
    queryFn: () => (leaderId ? fetchWeeklyTrends(leaderId) : Promise.reject(new Error("Missing leader id"))),
    enabled: !!leaderId,
  });

export const useGenerateWeeklyTrends = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => {
      if (!leaderId) throw new Error("Leader id is required");
      return generateWeeklyTrends(leaderId);
    },
    onSuccess: (trends) => {
      queryClient.setQueryData(trendsKey(leaderId), trends);
      queryClient.invalidateQueries({ queryKey: trendsKey(leaderId) });
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      toast({ title: "Weekly trends ready", description: "Perplexity topics generated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Trend generation failed", description: error.message, variant: "destructive" });
    },
  });
};

export const useGeneratedPosts = (leaderId?: string) =>
  useQuery<GeneratedPost[]>({
    queryKey: leaderId ? postsKey(leaderId) : leaderListKey,
    queryFn: () => (leaderId ? fetchGeneratedPosts(leaderId) : Promise.reject(new Error("Missing leader id"))),
    enabled: !!leaderId,
  });

export const useGeneratePost = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: GeneratePostInput) => {
      if (!leaderId) throw new Error("Leader id is required");
      return generatePost(leaderId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsKey(leaderId) });
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      toast({ title: "Post generated", description: "A new LinkedIn draft is ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdatePost = (leaderId?: string, postId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: UpdatePostInput) => {
      if (!leaderId || !postId) throw new Error("Leader and post ids are required");
      return updateGeneratedPost(leaderId, postId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsKey(leaderId) });
      toast({ title: "Post updated", description: "Changes saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeletePost = (leaderId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (postId: string) => {
      if (!leaderId) throw new Error("Leader id is required");
      return deleteGeneratedPost(leaderId, postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postsKey(leaderId) });
      queryClient.invalidateQueries({ queryKey: leaderListKey });
      toast({ title: "Draft deleted", description: "The post draft was deleted successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
    },
  });
};
