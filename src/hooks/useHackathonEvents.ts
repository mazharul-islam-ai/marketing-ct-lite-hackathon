import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HackathonEvent } from "@/types/hackathon";

// Create hackathon event
export const useCreateHackathonEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<HackathonEvent, "id" | "created_at" | "updated_at">
    ) => {
      const { data: result, error } = await (supabase as any)
        .from("hackathon_events")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return (result as unknown) as HackathonEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-events"] });
      toast.success("Event created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create event: ${error.message}`);
    },
  });
};

// Update hackathon event
export const useUpdateHackathonEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; updates: Partial<HackathonEvent> }) => {
      const { data: result, error } = await (supabase as any)
        .from("hackathon_events")
        .update(data.updates)
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return (result as unknown) as HackathonEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-events"] });
      toast.success("Event updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update event: ${error.message}`);
    },
  });
};

// Delete hackathon event
export const useDeleteHackathonEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("hackathon_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hackathon-events"] });
      toast.success("Event deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete event: ${error.message}`);
    },
  });
};
