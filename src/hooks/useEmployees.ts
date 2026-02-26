import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/types/hackathon";

// Fetch all employees
export const useEmployees = () => {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;
      return (data as unknown) as Employee[];
    },
  });
};

// Sync employees from Control Tower
export const useSyncEmployees = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("employee-sync", {
        method: "POST",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employees synced successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync employees: ${error.message}`);
    },
  });
};

// Send hackathon invites
export const useSendHackathonInvites = () => {
  return useMutation({
    mutationFn: async (data: { eventId: string; employeeIds: string[] }) => {
      const { data: result, error } = await supabase.functions.invoke(
        "hackathon-invite",
        {
          method: "POST",
          body: {
            eventId: data.eventId,
            employeeIds: data.employeeIds,
          },
        }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast.success(
        `Invitations sent successfully to ${data.invitedCount || 0} employees`
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to send invites: ${error.message}`);
    },
  });
};
