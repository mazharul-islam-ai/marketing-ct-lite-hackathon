import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Bot, Play, Loader2, CheckCircle2, XCircle, Clock,
  Zap, DollarSign, AlertCircle, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AgentRun, RunStep } from "@/pages/adminpanel/agent-builder/types";

interface PublicAgent {
  id: string;
  name: string;
  description: string | null;
  current_version_id: string | null;
}

const STATUS_CONFIG = {
  queued:    { color: "text-amber-500",  icon: Clock,         label: "Queued" },
  running:   { color: "text-blue-500",   icon: Loader2,       label: "Running" },
  completed: { color: "text-green-600",  icon: CheckCircle2,  label: "Completed" },
  failed:    { color: "text-red-500",    icon: XCircle,       label: "Failed" },
  cancelled: { color: "text-slate-400",  icon: AlertCircle,   label: "Cancelled" },
} as const;

export default function AgentPublicPage() {
  const { publicToken } = useParams<{ publicToken: string }>();

  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isTriggering, setIsTriggering] = useState(false);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch agent by public_token using anon client (no auth)
  useEffect(() => {
    if (!publicToken) return;
    supabase
      .from("agents" as never)
      .select("id, name, description, current_version_id")
      .eq("public_token", publicToken)
      .eq("visibility", "public")
      .eq("status", "published")
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setAgent(data as PublicAgent);
        }
        setLoading(false);
      });
  }, [publicToken]);

  const fetchSteps = useCallback(async (runId: string) => {
    const { data } = await supabase
      .from("run_steps" as never)
      .select("*")
      .eq("run_id", runId)
      .order("started_at", { ascending: true }) as { data: RunStep[] | null };
    if (data) setRunSteps(data);
  }, []);

  // Subscribe to live run updates
  useEffect(() => {
    if (!currentRun?.id) return;

    const channel = supabase
      .channel(`public-run-${currentRun.id}`)
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
    return () => { supabase.removeChannel(channel); };
  }, [currentRun?.id, fetchSteps]);

  const handleRun = async () => {
    if (!agent || !publicToken) return;
    setIsTriggering(true);
    setRunError(null);
    setRunSteps([]);
    setCurrentRun(null);

    try {
      const response = await supabase.functions.invoke("trigger-public-agent-run", {
        body: {
          public_token: publicToken,
          version_id: agent.current_version_id,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const result = response.data as { success: boolean; run_id: string; error?: string };
      if (!result.success) throw new Error(result.error ?? "Failed to start run");

      const { data: run } = await supabase
        .from("agent_runs" as never)
        .select("*")
        .eq("id", result.run_id)
        .single() as { data: AgentRun | null };

      if (run) setCurrentRun(run);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setIsTriggering(false);
    }
  };

  const isRunActive = currentRun?.status === "running" || currentRun?.status === "queued";
  const statusConfig = currentRun ? STATUS_CONFIG[currentRun.status] : null;
  const StatusIcon = statusConfig?.icon;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 text-center px-4">
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <div>
          <h1 className="text-xl font-bold text-slate-700">Agent Not Found</h1>
          <p className="text-slate-500 mt-1 text-sm">
            This link is invalid or the agent is no longer public.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-green-600" />
          <span className="text-xs text-slate-500">Public Agent</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Agent header */}
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shrink-0">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{agent.name}</h1>
            {agent.description && (
              <p className="text-slate-500 mt-1">{agent.description}</p>
            )}
            <Badge variant="outline" className="mt-2 text-xs border-green-300 text-green-700 bg-green-50">
              Public
            </Badge>
          </div>
        </div>

        {/* Run card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Run header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-sm font-medium text-slate-700">Run Agent</span>
            <div className="flex items-center gap-3">
              {currentRun && statusConfig && StatusIcon && (
                <div className={cn("flex items-center gap-1.5 text-xs font-medium", statusConfig.color)}>
                  <StatusIcon className={cn("w-3.5 h-3.5", isRunActive && "animate-spin")} />
                  {statusConfig.label}
                </div>
              )}
              <Button
                size="sm"
                onClick={handleRun}
                disabled={isTriggering || isRunActive || !agent.current_version_id}
              >
                {isTriggering || isRunActive ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isRunActive ? "Running…" : "Run"}
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          {currentRun && (
            <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-100 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" /> {currentRun.tokens_used ?? 0} tokens
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> ${(currentRun.total_cost ?? 0).toFixed(4)}
              </span>
              <span>{currentRun.step_count ?? 0} steps</span>
            </div>
          )}

          {/* Output area */}
          <ScrollArea className="h-64 px-4 py-3">
            {!currentRun && !runError && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
                <Play className="h-8 w-8 opacity-25" />
                <p className="text-sm">Click "Run" to execute this agent</p>
                {!agent.current_version_id && (
                  <p className="text-xs text-amber-500">No compiled version available yet</p>
                )}
              </div>
            )}

            {runError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{runError}</span>
              </div>
            )}

            {currentRun && runSteps.length === 0 && isRunActive && (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for steps…
              </div>
            )}

            {runSteps.length > 0 && (
              <div className="space-y-2">
                {runSteps.map((step) => (
                  <PublicStepRow key={step.id} step={step} />
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
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{currentRun.error_message ?? "Run failed"}</span>
              </div>
            )}
          </ScrollArea>
        </div>

        <p className="text-center text-xs text-slate-400">
          Powered by SJ Innovation AI Platform
        </p>
      </main>
    </div>
  );
}

function PublicStepRow({ step }: { step: RunStep }) {
  const isRunning = step.status === "running";
  const isFailed = step.status === "failed";
  const isCompleted = step.status === "completed";

  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5 text-xs",
      isRunning   && "border-blue-200 bg-blue-50",
      isFailed    && "border-red-200 bg-red-50",
      isCompleted && "border-green-100 bg-green-50",
      !isRunning && !isFailed && !isCompleted && "border-slate-100 bg-slate-50",
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-slate-700">{step.node_label ?? step.node_type}</span>
        <span className={cn(
          "capitalize font-medium",
          isRunning   && "text-blue-600",
          isFailed    && "text-red-600",
          isCompleted && "text-green-600",
          !isRunning && !isFailed && !isCompleted && "text-slate-400",
        )}>
          {step.status}
        </span>
      </div>
      {step.error && <p className="text-red-500 text-[11px] mt-1">{step.error}</p>}
      {step.output && isCompleted && (
        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">
          {JSON.stringify(step.output, null, 2)}
        </pre>
      )}
    </div>
  );
}
