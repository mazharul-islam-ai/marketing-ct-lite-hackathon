import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Agent } from "../types";

async function pauseAutomation(agentId: string) {
  await supabase
    .from("automations" as never)
    .update({ is_active: false })
    .eq("agent_id", agentId);
}

function invalidateAgentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["builder-agents"] });
  queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
  queryClient.invalidateQueries({ queryKey: ["i420-dashboard-stats"] });
}

export function useAgentLifecycle() {
  const queryClient = useQueryClient();

  const unpublishAgent = useCallback(async (agentId: string) => {
    const { error } = await supabase
      .from("agents" as never)
      .update({
        status: "draft",
        visibility: "admin_only",
        public_token: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to move agent to draft");
      return false;
    }

    await pauseAutomation(agentId);
    invalidateAgentQueries(queryClient);
    toast.success("Moved to draft — removed from workspace and public access");
    return true;
  }, [queryClient]);

  const archiveAgent = useCallback(async (agentId: string) => {
    const { error } = await supabase
      .from("agents" as never)
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to archive agent");
      return false;
    }

    await pauseAutomation(agentId);
    invalidateAgentQueries(queryClient);
    toast.success("Archived");
    return true;
  }, [queryClient]);

  const deleteAgent = useCallback(async (agentId: string) => {
    const { error } = await supabase
      .from("agents" as never)
      .delete()
      .eq("id", agentId);

    if (error) {
      toast.error("Failed to delete agent. Super admin role may be required.");
      return false;
    }

    invalidateAgentQueries(queryClient);
    toast.success("Permanently deleted");
    return true;
  }, [queryClient]);

  const cloneAgent = useCallback(async (agent: Agent): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to clone");
      return null;
    }

    const { data: newAgent, error } = await supabase
      .from("agents" as never)
      .insert({
        name: `${agent.name} (copy)`,
        description: agent.description,
        status: "draft",
        visibility: "admin_only",
        created_by: user.id,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: unknown };

    if (error || !newAgent) {
      toast.error("Clone failed");
      return null;
    }

    if (agent.current_version_id) {
      const { data: version } = await supabase
        .from("agent_versions" as never)
        .select("flow_json")
        .eq("id", agent.current_version_id)
        .single() as { data: { flow_json: unknown } | null };

      if (version) {
        const { data: newVersion } = await supabase
          .from("agent_versions" as never)
          .insert({
            agent_id: newAgent.id,
            version: 1,
            flow_json: version.flow_json,
            published_by: user.id,
          })
          .select("id")
          .single() as { data: { id: string } | null };

        if (newVersion) {
          await supabase
            .from("agents" as never)
            .update({ current_version_id: newVersion.id })
            .eq("id", newAgent.id);
        }
      }
    }

    invalidateAgentQueries(queryClient);
    toast.success("Agent cloned");
    return newAgent.id;
  }, [queryClient]);

  return { unpublishAgent, archiveAgent, deleteAgent, cloneAgent };
}
