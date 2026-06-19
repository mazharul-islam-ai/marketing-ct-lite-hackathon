import { useEffect, useState, useRef } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { RunStep, AgentRun } from "../types";
import { ab } from "../agentBuilderTheme";

interface LogsTabProps {
  agentId: string;
  currentRunId?: string | null;
}

interface LogLine {
  timestamp: string;
  level: "INFO" | "ERROR" | "WARN";
  message: string;
}

function runStepsToLogs(steps: RunStep[], run: AgentRun): LogLine[] {
  const lines: LogLine[] = [];

  lines.push({
    timestamp: run.created_at,
    level: "INFO",
    message: `Run #${run.id.slice(0, 8)} started  [trigger: ${run.trigger_type}]`,
  });

  for (const step of steps) {
    if (step.started_at) {
      lines.push({
        timestamp: step.started_at,
        level: "INFO",
        message: `Node ${step.node_id}: ${step.node_type} started`,
      });
    }
    if (step.status === "completed" && step.completed_at) {
      const dms = step.duration_ms ? ` (${step.duration_ms}ms)` : "";
      const tok = step.tokens_used ? `  tokens=${step.tokens_used}` : "";
      const cost = step.cost > 0 ? `  cost=$${step.cost.toFixed(4)}` : "";
      lines.push({
        timestamp: step.completed_at,
        level: "INFO",
        message: `Node ${step.node_id}: ${step.node_label ?? step.node_type} completed${dms}${tok}${cost}`,
      });

      const output = step.output as Record<string, unknown> | null;
      const preview =
        output?.content != null
          ? String(output.content)
          : output?.result != null
            ? String(output.result)
            : null;
      if (preview) {
        const truncated = preview.length > 200 ? `${preview.slice(0, 200)}…` : preview;
        lines.push({
          timestamp: step.completed_at,
          level: "INFO",
          message: `OUTPUT: ${truncated.replace(/\s+/g, " ").trim()}`,
        });
      }
    }
    if (step.status === "failed" && step.completed_at) {
      lines.push({
        timestamp: step.completed_at,
        level: "ERROR",
        message: `Node ${step.node_id}: ${step.node_label ?? step.node_type} FAILED — ${step.error ?? "unknown error"}`,
      });
    }
  }

  if (run.completed_at) {
    lines.push({
      timestamp: run.completed_at,
      level: run.status === "completed" ? "INFO" : "ERROR",
      message: `Run ${run.status.toUpperCase()} — steps=${run.step_count}  tokens=${run.tokens_used}  cost=$${(run.total_cost ?? 0).toFixed(4)}`,
    });
  }

  return lines.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function LogsTab({ agentId, currentRunId }: LogsTabProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(currentRunId ?? null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRuns();
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentRunId) setSelectedRunId(currentRunId);
  }, [currentRunId]);

  useEffect(() => {
    if (selectedRunId) loadSteps(selectedRunId);
  }, [selectedRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps, selectedRunId, isLoading]);

  async function loadRuns() {
    const { data } = await supabase
      .from("agent_runs" as never)
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20) as { data: AgentRun[] | null };

    if (data) {
      setRuns(data);
      if (!selectedRunId && data.length > 0) setSelectedRunId(data[0].id);
    }
  }

  async function loadSteps(runId: string) {
    setIsLoading(true);
    const { data } = await supabase
      .from("run_steps" as never)
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true }) as { data: RunStep[] | null };

    if (data) setSteps(data);
    setIsLoading(false);
  }

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const logs = selectedRun ? runStepsToLogs(steps, selectedRun) : [];

  const handleDownload = () => {
    const text = logs.map((l) => `${formatTs(l.timestamp)}  [${l.level}]  ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${selectedRunId?.slice(0, 8)}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex flex-col h-full", ab.canvas)}>
      <div className={cn("flex items-center gap-3 px-4 py-2", ab.toolbar)}>
        <select
          className={cn("flex-1 text-xs h-7 rounded px-2", ab.input, ab.textForeground)}
          value={selectedRunId ?? ""}
          onChange={(e) => setSelectedRunId(e.target.value)}
        >
          {runs.length === 0 && <option value="">No runs yet</option>}
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.id.slice(0, 8)} — {r.status} — {new Date(r.created_at).toLocaleString()}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadRuns}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        {logs.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 bg-[hsl(240_12%_8%)]">
        <div className="p-4 font-mono text-[11px] leading-5 min-h-full">
          {isLoading && (
            <p className="text-emerald-400/70">$ loading logs…</p>
          )}
          {!isLoading && logs.length === 0 && (
            <p className="text-emerald-400/70">$ no logs for this run — trigger a run to see output</p>
          )}
          {!isLoading && logs.length > 0 && (
            <p className="text-emerald-400/50 mb-2 select-none">$ agent-runner — tail -f</p>
          )}
          {logs.map((line, i) => (
            <div key={i} className="flex gap-2 hover:bg-white/5 rounded px-0.5 -mx-0.5">
              <span className="text-slate-500 shrink-0 select-none tabular-nums">{formatTs(line.timestamp)}</span>
              <span
                className={cn(
                  "shrink-0 w-14 font-semibold",
                  line.level === "ERROR" && "text-red-400",
                  line.level === "WARN" && "text-amber-400",
                  line.level === "INFO" && "text-emerald-400",
                )}
              >
                [{line.level}]
              </span>
              <span className={cn(
                "text-slate-200 break-all",
                line.level === "ERROR" && "text-red-300",
              )}>
                {line.message}
              </span>
            </div>
          ))}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      <div className="px-4 py-1.5 border-t border-[hsl(240_12%_15%)] bg-[hsl(240_12%_10%)] text-[10px] font-mono text-slate-500">
        — {logs.length} lines — agent {agentId.slice(0, 8)}… — last 20 runs
      </div>
    </div>
  );
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 2 });
  } catch {
    return ts;
  }
}
