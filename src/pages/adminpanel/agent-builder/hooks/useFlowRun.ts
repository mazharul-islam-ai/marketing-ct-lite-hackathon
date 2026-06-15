import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun } from "../types";

interface UseFlowRunReturn {
  currentRun: AgentRun | null;
  isTriggering: boolean;
  triggerRun: (agentId: string, versionId?: string, triggerType?: AgentRun["trigger_type"]) => Promise<string | null>;
  cancelRun: (runId: string) => Promise<void>;
  clearRun: () => void;
}

export function useFlowRun(): UseFlowRunReturn {
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const triggerRun = useCallback(
    async (
      agentId: string,
      versionId?: string,
      triggerType: AgentRun["trigger_type"] = "manual",
    ): Promise<string | null> => {
      setIsTriggering(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await supabase.functions.invoke("trigger-flow-run", {
          body: {
            agent_id: agentId,
            version_id: versionId,
            trigger_type: triggerType,
            budget_limit: 5.0,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.error) throw new Error(response.error.message);

        const result = response.data as {
          success: boolean;
          run_id: string;
          status: string;
          error?: string;
        };

        if (!result.success) throw new Error(result.error ?? "Failed to trigger run");

        // Load the created run record
        const { data: run } = await supabase
          .from("agent_runs" as never)
          .select("*")
          .eq("id", result.run_id)
          .single() as { data: AgentRun | null };

        if (run) setCurrentRun(run);

        return result.run_id;
      } catch (err) {
        console.error("triggerRun error:", err);
        return null;
      } finally {
        setIsTriggering(false);
      }
    },
    [],
  );

  const cancelRun = useCallback(async (runId: string) => {
    await supabase
      .from("agent_runs" as never)
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", runId);

    setCurrentRun((prev) => prev?.id === runId ? { ...prev, status: "cancelled" } : prev);
  }, []);

  const clearRun = useCallback(() => setCurrentRun(null), []);

  return { currentRun, isTriggering, triggerRun, cancelRun, clearRun };
}
