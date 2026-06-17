import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, DollarSign, Zap, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { AgentRun, RunStep } from "../types";

interface RuntimeTabProps {
  currentRun: AgentRun | null;
  onCancelRun?: () => void;
  triggerDevRunId?: string | null;
}

interface NodeRunMeta {
  status: string;
  label?: string;
  cost?: number;
  tokens?: number;
  duration_ms?: number;
  error?: string;
  branch?: string;
}

interface LiveMetadata {
  status: string;
  progress: number;
  totalSteps: number;
  currentNode: string;
  totalCost: number;
  tokensUsed: number;
  stepCount: number;
  error?: string;
  [key: string]: unknown;
}

export function RuntimeTab({ currentRun, onCancelRun }: RuntimeTabProps) {
  const [runSteps, setRunSteps] = useState<RunStep[]>([]);
  const [liveRun, setLiveRun] = useState<AgentRun | null>(currentRun);
  const [staleError, setStaleError] = useState<string | null>(null);

  // Poll run status and steps when run is active
  useEffect(() => {
    if (!currentRun?.id) return;
    setLiveRun(currentRun);
    setStaleError(null);

    const channel = supabase
      .channel(`run-${currentRun.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter: `id=eq.${currentRun.id}` },
        (payload) => {
          const updated = payload.new as AgentRun;
          setLiveRun(updated);
          if (updated.status !== "queued" && updated.status !== "running") {
            setStaleError(null);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${currentRun.id}` },
        () => {
          loadSteps(currentRun.id);
        },
      )
      .subscribe();

    loadSteps(currentRun.id);

    // Polling fallback: re-fetch agent_runs every 5s while active.
    // This covers cases where the Supabase Realtime subscription misses events
    // (e.g. before the supabase_realtime publication is applied).
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("agent_runs" as never)
        .select("*")
        .eq("id", currentRun.id)
        .single() as { data: AgentRun | null };

      if (data) {
        setLiveRun(data);
        if (data.status !== "queued" && data.status !== "running") {
          if (pollInterval) clearInterval(pollInterval);
          // Refresh steps once more on completion
          loadSteps(currentRun.id);
        }
      }
    }, 5000);

    // Stale-run guard: if still queued/running with no steps after 5 minutes, show error.
    // 5 minutes accounts for pgmq fallback latency (~1 min poll + execution time).
    const staleTimer = setTimeout(() => {
      setLiveRun((live) => {
        if (live && (live.status === "queued" || live.status === "running")) {
          setRunSteps((steps) => {
            if (steps.length === 0) {
              setStaleError(
                "Run appears stuck. The worker may have crashed before starting. Check the Trigger.dev dashboard for errors.",
              );
            }
            return steps;
          });
        }
        return live;
      });
    }, 300_000);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(staleTimer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentRun?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSteps(runId: string) {
    const { data } = await supabase
      .from("run_steps" as never)
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true }) as { data: RunStep[] | null };

    if (data) setRunSteps(data);
  }

  if (!currentRun) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
        <BarChart3 className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">No active run</p>
          <p className="text-xs mt-1">Click ▶ Run to execute your agent flow</p>
        </div>
      </div>
    );
  }

  const run = liveRun ?? currentRun;
  const isActive = run.status === "running" || run.status === "queued";
  const progress = run.step_count && runSteps.length
    ? Math.round((runSteps.filter((s) => s.status === "completed" || s.status === "failed").length / Math.max(runSteps.length, 1)) * 100)
    : run.status === "completed" ? 100 : 0;

  const durationMs = run.started_at && run.completed_at
    ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
    : run.started_at
      ? Date.now() - new Date(run.started_at).getTime()
      : null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Run header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-mono">Run #{run.id.slice(0, 8)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <RunStatusBadge status={run.status} />
              {isActive && (
                <span className="text-xs text-slate-400 animate-pulse">
                  {run.status === "queued" ? "Waiting in queue…" : "Executing…"}
                </span>
              )}
            </div>
          </div>
          {isActive && onCancelRun && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onCancelRun}>
              Cancel
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <MetricCell icon={<Clock className="w-3 h-3" />} label="Duration" value={durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"} />
        <MetricCell icon={<Zap className="w-3 h-3" />} label="Tokens" value={run.tokens_used?.toLocaleString() ?? "0"} />
        <MetricCell icon={<DollarSign className="w-3 h-3" />} label="Cost" value={`$${(run.total_cost ?? 0).toFixed(4)}`} />
      </div>

      {/* Step list */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Steps ({runSteps.length})
          </p>

          {runSteps.length === 0 && run.status !== "queued" && !staleError && (
            <p className="text-xs text-slate-400">No steps recorded yet.</p>
          )}

          {run.status === "queued" && !staleError && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Waiting for worker to pick up…
            </div>
          )}

          {staleError && (
            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {staleError}
            </div>
          )}

          {runSteps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i + 1} />
          ))}

          {run.error_message && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {run.error_message}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Output preview — shown after run completes if any output-producing step has content */}
      <OutputPanel run={run} runSteps={runSteps} />
    </div>
  );
}

// ── Output panel ─────────────────────────────────────────────────────────────

const OUTPUT_NODE_TYPES = ["dashboard_write", "report_generate"];
const LLM_NODE_TYPES = ["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"];

function OutputPanel({ run, runSteps }: { run: AgentRun; runSteps: RunStep[] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (run.status !== "completed") return null;

  // Prefer last dashboard_write/report_generate step with saved content
  const outputStep = [...runSteps]
    .reverse()
    .find((s) => OUTPUT_NODE_TYPES.includes(s.node_type) && (s.output as Record<string, unknown>)?.content);

  // Fall back to last LLM step's result text
  const llmStep = !outputStep
    ? [...runSteps].reverse().find(
        (s) => LLM_NODE_TYPES.includes(s.node_type) && (s.output as Record<string, unknown>)?.result,
      )
    : null;

  const content = outputStep
    ? String((outputStep.output as Record<string, unknown>).content)
    : llmStep
      ? String((llmStep.output as Record<string, unknown>).result)
      : null;

  const title = outputStep
    ? String((outputStep.output as Record<string, unknown>).title ?? outputStep.node_label ?? "Output")
    : llmStep
      ? String(llmStep.node_label ?? "Output")
      : null;

  if (!content) {
    return (
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="font-medium">Run completed successfully</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 flex flex-col">
      <button
        className="flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]">{title}</span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {!collapsed && (
        <ScrollArea className="max-h-60">
          <div className="px-4 py-3 prose prose-sm max-w-none text-slate-700 text-xs [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_table]:text-[11px] [&_pre]:text-[10px]">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function StepRow({ step, index }: { step: RunStep; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const durationMs = step.duration_ms;
  const statusIcon =
    step.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> :
    step.status === "failed" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
    step.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> :
    <Clock className="w-3.5 h-3.5 text-slate-300" />;

  return (
    <div className={cn("rounded border text-xs transition-colors", step.status === "failed" ? "border-red-200 bg-red-50" : "border-slate-100 hover:border-slate-200")}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => step.output || step.error ? setExpanded(!expanded) : undefined}
      >
        <span className="text-slate-400 w-4 shrink-0">{index}.</span>
        {statusIcon}
        <span className="flex-1 font-medium text-slate-700 truncate">{step.node_label ?? step.node_id}</span>
        <span className="text-[10px] text-slate-400 font-mono shrink-0">{step.node_type}</span>
        {durationMs != null && (
          <span className="text-[10px] text-slate-400 shrink-0">{(durationMs / 1000).toFixed(2)}s</span>
        )}
        {step.cost > 0 && (
          <span className="text-[10px] text-slate-400 shrink-0">${step.cost.toFixed(4)}</span>
        )}
      </button>

      {expanded && (step.output || step.error) && (
        <div className="px-3 pb-2 border-t border-slate-100">
          {step.error && <p className="text-red-600 mt-1 text-[11px]">{step.error}</p>}
          {step.output && (() => {
            const out = step.output as Record<string, unknown>;
            // content field: render as markdown (report_generate / dashboard_write)
            if (out.content) {
              const preview = String(out.content).slice(0, 400);
              return (
                <div className="mt-1 text-[11px] text-slate-600 max-h-28 overflow-y-auto prose prose-[11px] max-w-none [&_*]:text-[11px]">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {preview + (String(out.content).length > 400 ? "…" : "")}
                  </ReactMarkdown>
                </div>
              );
            }
            // result field: plain text (LLM nodes)
            if (out.result) {
              const preview = String(out.result).slice(0, 300);
              return (
                <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {preview}{String(out.result).length > 300 ? "…" : ""}
                </p>
              );
            }
            // fallback: raw JSON for everything else
            return (
              <pre className="text-[10px] bg-white rounded border border-slate-100 p-2 mt-1 overflow-x-auto max-h-28 text-slate-600 font-mono">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function MetricCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2 px-3">
      <div className="flex items-center gap-1 text-slate-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-700 mt-0.5">{value}</span>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-700",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", map[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}
