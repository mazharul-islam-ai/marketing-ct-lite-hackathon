import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DailyHeadStart {
  id: string;
  user_id: string;
  date: string;
  goals: string | null;
  priorities: string[] | null;
  blockers: string | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeadStartInput {
  goals?: string;
  priorities?: string[];
  blockers?: string;
  mood?: string;
}

export function useDailyHeadStart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: todayHeadStart, isLoading, error } = useQuery({
    queryKey: ['daily-head-start', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await (supabase as any)
        .from('daily_head_starts')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;
      return data as DailyHeadStart | null;
    },
    enabled: !!user?.id,
  });

  const submitHeadStart = useMutation({
    mutationFn: async (input: HeadStartInput) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await (supabase as any)
        .from('daily_head_starts')
        .upsert({
          user_id: user.id,
          date: today,
          goals: input.goals,
          priorities: input.priorities,
          blockers: input.blockers,
          mood: input.mood,
        }, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-head-start'] });
      toast.success('Daily head start saved!');
    },
    onError: (error) => {
      console.error('Error saving head start:', error);
      toast.error('Failed to save head start');
    },
  });

  return {
    todayHeadStart,
    isLoading,
    error,
    hasSubmittedToday: !!todayHeadStart,
    submitHeadStart: submitHeadStart.mutate,
    isSubmitting: submitHeadStart.isPending,
  };
}
