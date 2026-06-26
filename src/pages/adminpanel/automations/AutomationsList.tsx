import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Play, Pause, Loader2, Clock, Bot, ChevronRight,
  CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { I420_ROUTES } from "@/lib/i420Routes";
import type { Agent, AgentRun } from "../agent-builder/types";
import { I420 } from "../agent-builder/i420Brand";

interface AutomationRow {
  agent: Agent;
  automation: {
    id: string;
    cron_expression: string | null;
    is_active: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
  } | null;
  lastRun: AgentRun | null;
}

export default function AutomationsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAutomations();
  }, []);

  async function loadAutomations() {
    setIsLoading(true);
    try {
      const { data: agents } = await supabase
        .from("agents" as never)
        .select("*")
        .eq("status", "published")
        .order("updated_at", { ascending: false }) as { data: Agent[] | null };

      if (!agents?.length) {
        setRows([]);
        return;
      }

      const enriched: AutomationRow[] = await Promise.all(
        agents.map(async (agent) => {
          const { data: automation } = await supabase
            .from("automations" as never)
            .select("*")
            .eq("agent_id", agent.id)
            .maybeSingle() as { data: AutomationRow["automation"] };

          const { data: runs } = await supabase
            .from("agent_runs" as never)
            .select("*")
            .eq("agent_id", agent.id)
            .order("created_at", { ascending: false })
            .limit(1) as { data: AgentRun[] | null };

          return { agent, automation, lastRun: runs?.[0] ?? null };
        }),
      );

      setRows(enriched.filter((r) => r.automation?.is_active || r.automation?.cron_expression));
    } finally {
      setIsLoading(false);
    }
  }

  async function togglePause(agentId: string, automationId: string, currentlyActive: boolean) {
    await supabase
      .from("automations" as never)
      .update({ is_active: !currentlyActive })
      .eq("id", automationId);
    toast.success(currentlyActive ? "Automation paused" : "Automation resumed");
    loadAutomations();
  }

  async function quickRun(agentId: string) {
    const { error } = await supabase.functions.invoke("trigger-flow-run", {
      body: { agent_id: agentId, trigger_type: "manual" },
    });
    if (error) toast.error("Run failed");
    else toast.success("Run started");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-tour="i420-tour-automations-list">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Automations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Published agents with active schedules
          </p>
        </div>
        <Button asChild variant="outline" size="sm" data-tour="i420-tour-automation-logs">
          <Link to={I420_ROUTES.automationLogs}>View Logs</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No scheduled automations yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Publish an agent with a Schedule trigger in{" "}
            <Link to={I420_ROUTES.root} className="text-violet-600 hover:underline">{I420.studioLabel}</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ agent, automation, lastRun }) => (
            <div
              key={agent.id}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <button
                  className="text-sm font-semibold text-slate-900 hover:text-violet-600 truncate block text-left"
                  onClick={() => navigate(I420_ROUTES.agent(agent.id))}
                >
                  {agent.name}
                </button>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {automation?.cron_expression ?? "—"}
                  </span>
                  {automation?.next_run_at && (
                    <span>Next: {new Date(automation.next_run_at).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {lastRun && (
                  <span className={cn(
                    "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                    lastRun.status === "completed" && "bg-emerald-50 text-emerald-700",
                    lastRun.status === "failed" && "bg-red-50 text-red-700",
                    (lastRun.status === "running" || lastRun.status === "queued") && "bg-blue-50 text-blue-700",
                  )}>
                    {lastRun.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                    {lastRun.status === "failed" && <XCircle className="w-3 h-3" />}
                    {(lastRun.status === "running" || lastRun.status === "queued") && <Loader2 className="w-3 h-3 animate-spin" />}
                    {lastRun.status}
                  </span>
                )}

                <Badge variant={automation?.is_active ? "default" : "secondary"} className="text-[10px]">
                  {automation?.is_active ? "Active" : "Paused"}
                </Badge>

                {automation && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => togglePause(agent.id, automation.id, automation.is_active)}
                  >
                    {automation.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                )}

                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quickRun(agent.id)}>
                  <Play className="w-3 h-3" /> Run
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => navigate(I420_ROUTES.agent(agent.id))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
