import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun } from "../types";

const ACTIVE_RUN_STATUSES = new Set<AgentRun["status"]>(["queued", "running"]);

function isActiveRunStatus(status: AgentRun["status"]): boolean {
  return ACTIVE_RUN_STATUSES.has(status);
}

interface TriggerRunResult {
  runId: string | null;
  error?: string;
}

interface UseFlowRunReturn {
  currentRun: AgentRun | null;
  isTriggering: boolean;
  triggerRun: (
    agentId: string,
    versionId?: string,
    triggerType?: AgentRun["trigger_type"],
    inputContext?: Record<string, unknown>,
  ) => Promise<TriggerRunResult>;
  cancelRun: (runId: string) => Promise<void>;
  clearRun: () => void;
}

export function useFlowRun(): UseFlowRunReturn {
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // Keep currentRun in sync until terminal status so header Stop/Run toggles correctly
  useEffect(() => {
    const runId = currentRun?.id;
    if (!runId) return;

    const channel = supabase
      .channel(`flow-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter: `id=eq.${runId}` },
        (payload) => setCurrentRun(payload.new as AgentRun),
      )
      .subscribe();

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("agent_runs" as never)
        .select("*")
        .eq("id", runId)
        .single() as { data: AgentRun | null };

      if (data) {
        setCurrentRun(data);
        if (!isActiveRunStatus(data.status) && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentRun?.id]);

  const triggerRun = useCallback(
    async (
      agentId: string,
      versionId?: string,
      triggerType: AgentRun["trigger_type"] = "manual",
      inputContext?: Record<string, unknown>,
    ): Promise<TriggerRunResult> => {
      setIsTriggering(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await supabase.functions.invoke("trigger-flow-run", {
          body: {
            agent_id: agentId,
            version_id: versionId,
            trigger_type: triggerType,
            input_context: {
              mode: "report",
              ...inputContext,
            },
            budget_limit: 5.0,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.error) {
          // Try to extract the actual error message from the edge-function response body
          let errorMessage = response.error.message;
          try {
            // FunctionsFetchError exposes the raw Response on .context
            const body = await (response.error as { context?: Response }).context?.json?.();
            if (body?.error) errorMessage = body.error;
          } catch { /* ignore parse failures */ }
          return { runId: null, error: errorMessage };
        }

        const result = response.data as {
          success: boolean;
          run_id: string;
          status: string;
          error?: string;
        };

        if (!result.success) {
          return { runId: null, error: result.error ?? "Failed to trigger run" };
        }

        const { data: run } = await supabase
          .from("agent_runs" as never)
          .select("*")
          .eq("id", result.run_id)
          .single() as { data: AgentRun | null };

        if (run) setCurrentRun(run);

        return { runId: result.run_id };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("triggerRun error:", err);
        return { runId: null, error: errorMessage };
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
