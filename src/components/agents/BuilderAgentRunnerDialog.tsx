import { useEffect, useState, useCallback } from "react";
import {
  Play, X, Loader2, CheckCircle2, XCircle, Clock,
  Zap, DollarSign, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun, RunStep } from "@/pages/adminpanel/agent-builder/types";

interface BuilderAgentRunnerDialogProps {
  agentId: string;
  agentName: string;
  versionId: string | null;
  onClose: () => void;
  /** Pass an anon-compatible trigger function for public agents */
  triggerFn?: (agentId: string, versionId?: string) => Promise<string | null>;
}

const STATUS_CONFIG = {
  queued:    { color: "text-amber-500",  icon: Clock,         label: "Queued" },
  running:   { color: "text-blue-500",   icon: Loader2,       label: "Running" },
  completed: { color: "text-green-600",  icon: CheckCircle2,  label: "Completed" },
  failed:    { color: "text-red-500",    icon: XCircle,       label: "Failed" },
  cancelled: { color: "text-slate-400",  icon: AlertCircle,   label: "Cancelled" },
} as const;

export function BuilderAgentRunnerDialog({
  agentId,
  agentName,
  versionId,
  onClose,
  triggerFn,
}: BuilderAgentRunnerDialogProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSteps = useCallback(async (runId: string) => {
    const { data } = await supabase
      .from("run_steps" as never)
      .select("*")
      .eq("run_id", runId)
      .order("started_at", { ascending: true }) as { data: RunStep[] | null };
    if (data) setRunSteps(data);
  }, []);

  // Subscribe to live run + step updates via Supabase realtime
  useEffect(() => {
    if (!currentRun?.id) return;

    const channel = supabase
      .channel(`runner-dialog-${currentRun.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter: `id=eq.${currentRun.id}` },
        (payload) => setCurrentRun(payload.new as AgentRun),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${currentRun.id}` },
        () => fetchSteps(currentRun.id),
      )
      .subscribe();

    fetchSteps(currentRun.id);

    // Polling fallback: re-fetch agent_runs every 5s while active.
    // Covers cases where the Realtime publication hasn't been applied yet.
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("agent_runs" as never)
        .select("*")
        .eq("id", currentRun.id)
        .single() as { data: AgentRun | null };

      if (data) {
        setCurrentRun(data);
        if (data.status !== "queued" && data.status !== "running") {
          if (pollInterval) clearInterval(pollInterval);
          fetchSteps(currentRun.id);
        }
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentRun?.id, fetchSteps]);

  const handleRun = async () => {
    setIsTriggering(true);
    setError(null);
    setRunSteps([]);
    setCurrentRun(null);

    try {
      let runId: string | null = null;

      if (triggerFn) {
        runId = await triggerFn(agentId, versionId ?? undefined);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const response = await supabase.functions.invoke("trigger-flow-run", {
          body: {
            agent_id: agentId,
            version_id: versionId,
            trigger_type: "manual",
            budget_limit: 5.0,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.error) throw new Error(response.error.message);
        const result = response.data as { success: boolean; run_id: string; error?: string };
        if (!result.success) throw new Error(result.error ?? "Failed to trigger run");
        runId = result.run_id;
      }

      if (!runId) throw new Error("No run ID returned");

      const { data: run } = await supabase
        .from("agent_runs" as never)
        .select("*")
        .eq("id", runId)
        .single() as { data: AgentRun | null };

      if (run) setCurrentRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setIsTriggering(false);
    }
  };

  const isRunActive = currentRun?.status === "running" || currentRun?.status === "queued";
  const statusConfig = currentRun ? STATUS_CONFIG[currentRun.status] : null;
  const StatusIcon = statusConfig?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-semibold text-sm text-slate-800">{agentName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manual run</p>
          </div>
          <div className="flex items-center gap-2">
            {currentRun && statusConfig && StatusIcon && (
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", statusConfig.color)}>
                <StatusIcon className={cn("w-3.5 h-3.5", isRunActive && "animate-spin")} />
                {statusConfig.label}
              </div>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Run stats */}
        {currentRun && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-slate-100 bg-slate-50 text-xs text-slate-600 shrink-0">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {currentRun.tokens_used ?? 0} tokens
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> ${(currentRun.total_cost ?? 0).toFixed(4)}
            </span>
            <span>{currentRun.step_count ?? 0} steps</span>
          </div>
        )}

        {/* Steps / output */}
        <ScrollArea className="flex-1 min-h-0 px-5 py-4">
          {!currentRun && !error && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <Play className="w-8 h-8 opacity-30" />
              <p className="text-sm">Click "Run Agent" to execute</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {currentRun && runSteps.length === 0 && isRunActive && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for steps...
            </div>
          )}

          {runSteps.length > 0 && (
            <div className="space-y-2">
              {runSteps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </div>
          )}

          {currentRun?.status === "completed" && runSteps.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Run completed successfully
            </div>
          )}

          {currentRun?.status === "failed" && (
            <div className="mt-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{currentRun.error_message ?? "Run failed"}</span>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleRun}
            disabled={isTriggering || isRunActive}
          >
            {isTriggering || isRunActive ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            {isRunActive ? "Running…" : "Run Agent"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: RunStep }) {
  const isRunning = step.status === "running";
  const isFailed = step.status === "failed";
  const isCompleted = step.status === "completed";

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5 text-xs",
      isRunning  && "border-blue-200 bg-blue-50",
      isFailed   && "border-red-200 bg-red-50",
      isCompleted && "border-green-100 bg-green-50",
      !isRunning && !isFailed && !isCompleted && "border-slate-100 bg-slate-50",
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-slate-700">{step.node_label ?? step.node_type}</span>
        <div className="flex items-center gap-2">
          {step.duration_ms != null && (
            <span className="text-slate-400">{step.duration_ms}ms</span>
          )}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] py-0 px-1.5 capitalize",
              isRunning   && "border-blue-300 text-blue-600",
              isFailed    && "border-red-300 text-red-600",
              isCompleted && "border-green-300 text-green-600",
            )}
          >
            {step.status}
          </Badge>
        </div>
      </div>
      {step.error && (
        <p className="text-red-500 mt-1 text-[11px]">{step.error}</p>
      )}
      {step.output && isCompleted && (
        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">
          {JSON.stringify(step.output, null, 2)}
        </pre>
      )}
    </div>
  );
}
