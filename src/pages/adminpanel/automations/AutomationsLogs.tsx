import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun } from "../agent-builder/types";

interface RunWithAgent extends AgentRun {
  agent_name?: string;
}

export default function AutomationsLogs() {
  const [runs, setRuns] = useState<RunWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadLogs();
  }, [statusFilter]);

  async function loadLogs() {
    setIsLoading(true);
    try {
      const { data: automations } = await supabase
        .from("automations" as never)
        .select("agent_id")
        .eq("is_active" as never, true) as { data: { agent_id: string }[] | null };

      const agentIds = [...new Set((automations ?? []).map((a) => a.agent_id))];

      let query = supabase
        .from("agent_runs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (agentIds.length > 0) {
        query = query.in("agent_id", agentIds);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: runsData } = await query as { data: AgentRun[] | null };

      if (!runsData?.length) {
        setRuns([]);
        return;
      }

      const uniqueAgentIds = [...new Set(runsData.map((r) => r.agent_id))];
      const { data: agents } = await supabase
        .from("agents" as never)
        .select("id, name")
        .in("id", uniqueAgentIds) as { data: { id: string; name: string }[] | null };

      const nameMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

      setRuns(runsData.map((r) => ({ ...r, agent_name: nameMap.get(r.agent_id) ?? "Unknown" })));
    } finally {
      setIsLoading(false);
    }
  }

  function downloadLogs() {
    const lines = runs.map((r) =>
      `[${new Date(r.created_at).toISOString()}] ${r.agent_name} | ${r.status} | steps=${r.step_count} | cost=$${(r.total_cost ?? 0).toFixed(4)} | ${r.error_message ?? ""}`,
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automation-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Run history across all scheduled automations</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button asChild variant="outline" size="sm">
            <Link to="/adminpanel/automations">All Automations</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-20">No automation runs yet.</p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Time</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Automation</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Trigger</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Steps</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{run.agent_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium capitalize ${
                      run.status === "completed" ? "text-emerald-600" :
                      run.status === "failed" ? "text-red-600" : "text-blue-600"
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{run.trigger_type}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{run.step_count}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">${(run.total_cost ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
