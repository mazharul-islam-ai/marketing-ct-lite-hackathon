import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, DollarSign, Zap, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ab } from "./agentBuilderTheme";

interface PlatformUsageRow {
  id: string;
  user_id: string;
  agent_id: string | null;
  source: string;
  action: string | null;
  provider: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AgentNameRow {
  id: string;
  name: string;
}

const formatUsd = (value: number) =>
  value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(value >= 1 ? 2 : 4)}`;

const formatNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
};

const getDateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function sumCost(rows: PlatformUsageRow[], sinceMs: number) {
  const since = Date.now() - sinceMs;
  return rows
    .filter((r) => new Date(r.created_at).getTime() >= since)
    .reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}

export function PlatformCostsPanel() {
  const usageQuery = useQuery({
    queryKey: ["i420", "platform-usage"],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("i420_platform_usage" as never)
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500) as { data: PlatformUsageRow[] | null; error: Error | null };

      if (error) throw error;
      return data ?? [];
    },
  });

  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of usageQuery.data ?? []) {
      if (row.agent_id) ids.add(row.agent_id);
    }
    return [...ids];
  }, [usageQuery.data]);

  const agentsQuery = useQuery({
    queryKey: ["i420", "platform-usage-agents", agentIds],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents" as never)
        .select("id, name")
        .in("id", agentIds) as { data: AgentNameRow[] | null; error: Error | null };

      if (error) throw error;
      return Object.fromEntries((data ?? []).map((a) => [a.id, a.name]));
    },
  });

  const rows = usageQuery.data ?? [];
  const agentNames = agentsQuery.data ?? {};

  const summary = useMemo(() => ({
    today: sumCost(rows, 86400000),
    week: sumCost(rows, 7 * 86400000),
    month: sumCost(rows, 30 * 86400000),
    totalCalls: rows.length,
    totalTokens: rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0),
  }), [rows]);

  const dailyChart = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = getDateKey(row.created_at);
      byDay.set(key, (byDay.get(key) ?? 0) + Number(row.cost_usd ?? 0));
    }
    return [...byDay.entries()]
      .map(([date, cost]) => ({ date, cost: Number(cost.toFixed(6)) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [rows]);

  const modelBreakdown = useMemo(() => {
    const map = new Map<string, { provider: string; model: string; calls: number; tokens: number; cost: number }>();
    for (const row of rows) {
      const provider = row.provider ?? "unknown";
      const model = row.model ?? "unknown";
      const key = `${provider}::${model}`;
      const existing = map.get(key) ?? { provider, model, calls: 0, tokens: 0, cost: 0 };
      existing.calls += 1;
      existing.tokens += row.total_tokens ?? 0;
      existing.cost += Number(row.cost_usd ?? 0);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [rows]);

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, { source: string; calls: number; cost: number }>();
    for (const row of rows) {
      const source = row.source ?? "unknown";
      const existing = map.get(source) ?? { source, calls: 0, cost: 0 };
      existing.calls += 1;
      existing.cost += Number(row.cost_usd ?? 0);
      map.set(source, existing);
    }
    return [...map.values()];
  }, [rows]);

  if (usageQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading platform costs…
      </div>
    );
  }

  if (usageQuery.isError) {
    return (
      <div className="max-w-3xl rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load platform costs. Ensure migration <code>i420_platform_usage</code> is applied.
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6" data-tour="i420-tour-costs">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">i420 platform costs</p>
        <p>
          Tracks Design chat / flow compilation and future Settings AI usage.
          Agent and automation <strong>execution</strong> costs appear on each agent&apos;s Runtime and Logs tabs.
        </p>
        <pre className="text-[10px] leading-relaxed text-muted-foreground/90 whitespace-pre-wrap font-mono mt-2">
{`User → i420-compile → i420_platform_usage → Costs tab (here)
Agent runs / automations → agent_runs → Runtime / Logs (not here)`}
        </pre>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today", value: summary.today, icon: DollarSign },
          { label: "Last 7 days", value: summary.week, icon: DollarSign },
          { label: "Last 30 days", value: summary.month, icon: DollarSign },
          { label: "Total tokens (90d)", value: summary.totalTokens, icon: Zap, isTokens: true },
        ].map(({ label, value, icon: Icon, isTokens }) => (
          <div key={label} className={cn("rounded-xl border p-4", ab.agentCard)}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
            <p className="text-xl font-semibold tabular-nums">
              {isTokens ? formatNumber(value) : formatUsd(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn("rounded-xl border p-4", ab.agentCard)}>
          <h3 className="text-sm font-medium mb-3">Daily spend (30 days)</h3>
          {dailyChart.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No compile usage yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={ab.chartGrid} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ab.chartAxis }} />
                <YAxis tick={{ fontSize: 10, fill: ab.chartAxis }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [formatUsd(v), "Cost"]} />
                <Area type="monotone" dataKey="cost" stroke={ab.chartLine} fill={ab.chartLine} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={cn("rounded-xl border p-4", ab.agentCard)}>
          <h3 className="text-sm font-medium mb-3">By source</h3>
          <div className="space-y-2">
            {sourceBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data yet.</p>
            ) : sourceBreakdown.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-xs">
                <span className="capitalize">{s.source}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.calls} calls · {formatUsd(s.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("rounded-xl border p-4", ab.agentCard)}>
        <h3 className="text-sm font-medium mb-3">By model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4 text-right">Calls</th>
                <th className="pb-2 pr-4 text-right">Tokens</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {modelBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Compile a flow in Design chat to start tracking costs.
                  </td>
                </tr>
              ) : modelBreakdown.map((m) => (
                <tr key={`${m.provider}-${m.model}`} className="border-b border-border/40">
                  <td className="py-2 pr-4">{m.provider}</td>
                  <td className="py-2 pr-4 font-mono text-[11px]">{m.model}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{m.calls}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(m.tokens)}</td>
                  <td className="py-2 text-right tabular-nums">{formatUsd(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn("rounded-xl border p-4", ab.agentCard)}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Recent compile events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Agent</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Model</th>
                <th className="pb-2 pr-4 text-right">Tokens</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row) => (
                <tr key={row.id} className="border-b border-border/40">
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 max-w-[140px] truncate">
                    {row.agent_id ? (agentNames[row.agent_id] ?? row.agent_id.slice(0, 8)) : "—"}
                  </td>
                  <td className="py-2 pr-4">{row.action ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-[10px]">{row.model ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(row.total_tokens ?? 0)}</td>
                  <td className="py-2 text-right tabular-nums">{formatUsd(Number(row.cost_usd ?? 0))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No platform usage recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
