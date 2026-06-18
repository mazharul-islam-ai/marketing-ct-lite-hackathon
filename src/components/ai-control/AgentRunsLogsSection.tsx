import { useState, useEffect } from "react";
import { Loader2, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun } from "@/pages/adminpanel/agent-builder/types";

interface UnifiedLogRow {
  id: string;
  source: "builder" | "legacy";
  agent_name: string;
  created_at: string;
  status: string;
  trigger_type: string;
  tokens_used: number;
  total_cost: number;
  step_count: number | null;
  error_message: string | null;
}

interface LegacyAgentRun {
  id: string;
  agent_id: string | null;
  status: string | null;
  category: string | null;
  total_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export default function AgentRunsLogsSection() {
  const [runs, setRuns] = useState<UnifiedLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    loadLogs();
  }, [statusFilter, sourceFilter]);

  async function loadLogs() {
    setIsLoading(true);
    try {
      const rows: UnifiedLogRow[] = [];

      if (sourceFilter === "all" || sourceFilter === "builder") {
        let builderQuery = supabase
          .from("agent_runs" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (statusFilter !== "all") {
          builderQuery = builderQuery.eq("status", statusFilter);
        }

        const { data: builderRuns } = await builderQuery as { data: AgentRun[] | null };

        if (builderRuns?.length) {
          const agentIds = [...new Set(builderRuns.map((r) => r.agent_id))];
          const { data: agents } = await supabase
            .from("agents" as never)
            .select("id, name")
            .in("id", agentIds) as { data: { id: string; name: string }[] | null };

          const nameMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

          for (const run of builderRuns) {
            rows.push({
              id: run.id,
              source: "builder",
              agent_name: nameMap.get(run.agent_id) ?? "Unknown",
              created_at: run.created_at,
              status: run.status,
              trigger_type: run.trigger_type,
              tokens_used: run.tokens_used ?? 0,
              total_cost: run.total_cost ?? 0,
              step_count: run.step_count,
              error_message: run.error_message,
            });
          }
        }
      }

      if (sourceFilter === "all" || sourceFilter === "legacy") {
        let legacyQuery = supabase
          .from("ai_agent_runs")
          .select("id, agent_id, status, category, total_tokens, cost_usd, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (statusFilter !== "all") {
          legacyQuery = legacyQuery.eq("status", statusFilter);
        }

        const { data: legacyRuns } = await legacyQuery as { data: LegacyAgentRun[] | null };

        if (legacyRuns?.length) {
          const agentIds = [...new Set(legacyRuns.map((r) => r.agent_id).filter(Boolean))] as string[];
          const { data: agents } = agentIds.length
            ? await supabase.from("ai_agents").select("id, name").in("id", agentIds)
            : { data: [] as { id: string; name: string }[] };

          const nameMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

          for (const run of legacyRuns) {
            rows.push({
              id: run.id,
              source: "legacy",
              agent_name: run.agent_id ? (nameMap.get(run.agent_id) ?? "Unknown") : "Unknown",
              created_at: run.created_at,
              status: run.status ?? "unknown",
              trigger_type: run.category ?? "legacy",
              tokens_used: run.total_tokens ?? 0,
              total_cost: run.cost_usd ?? 0,
              step_count: null,
              error_message: null,
            });
          }
        }
      }

      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRuns(rows.slice(0, 200));
    } finally {
      setIsLoading(false);
    }
  }

  function downloadLogs() {
    const lines = runs.map((r) =>
      `[${new Date(r.created_at).toISOString()}] [${r.source}] ${r.agent_name} | ${r.status} | trigger=${r.trigger_type} | tokens=${r.tokens_used} | cost=$${r.total_cost.toFixed(4)}${r.step_count != null ? ` | steps=${r.step_count}` : ""} | ${r.error_message ?? ""}`,
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Agent Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Execution history across Agent Builder and legacy AI agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="builder">Agent Builder</SelectItem>
              <SelectItem value="legacy">Legacy AI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={downloadLogs} disabled={!runs.length}>
            <Download className="w-3 h-3" /> Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-20">No agent runs yet.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Time</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Agent</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Trigger</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Steps</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Tokens</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={`${run.source}-${run.id}`} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {run.source === "builder" ? "Builder" : "Legacy"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{run.agent_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium capitalize ${
                      run.status === "completed" ? "text-emerald-600" :
                      run.status === "failed" ? "text-red-600" : "text-blue-600"
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{run.trigger_type}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {run.step_count != null ? run.step_count : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{run.tokens_used}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">${run.total_cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
