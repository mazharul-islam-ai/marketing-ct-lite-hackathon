import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Play, Copy, Archive, Edit2, Search, Bot,
  CheckCircle2, Clock, XCircle, Loader2, MoreHorizontal,
  Trash2, AlertTriangle, Sparkles, ArrowRight, Zap, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Agent, AgentRun } from "./types";

interface AgentWithStats extends Agent {
  last_run?: AgentRun | null;
  cost_today?: number;
}

const PROMPT_TEMPLATES = [
  "Daily unread email summary delivered by email at 8am",
  "Analyze CRM leads every morning, send hot leads to Slack",
  "Monitor brand mentions, generate weekly summary reports",
  "Sync ActiveCollab tasks and notify the team on Slack",
  "Send weekly client performance summaries via email",
  "Generate LinkedIn content for new product launches",
];

export default function AgentBuilderList() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [deleteTarget, setDeleteTarget] = useState<AgentWithStats | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Chatbox state
  const [chatInput, setChatInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setIsLoading(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents" as never)
        .select("*")
        .order("updated_at", { ascending: false }) as { data: Agent[] | null };

      if (!agentsData) return;

      const enriched: AgentWithStats[] = await Promise.all(
        agentsData.map(async (agent) => {
          const { data: runs } = await supabase
            .from("agent_runs" as never)
            .select("*")
            .eq("agent_id", agent.id)
            .order("created_at", { ascending: false })
            .limit(1) as { data: AgentRun[] | null };

          const { data: todayRuns } = await supabase
            .from("agent_runs" as never)
            .select("total_cost")
            .eq("agent_id", agent.id)
            .gte("created_at", new Date(Date.now() - 86400000).toISOString()) as {
              data: { total_cost: number }[] | null;
            };

          const costToday = todayRuns?.reduce((sum, r) => sum + (r.total_cost ?? 0), 0) ?? 0;
          return { ...agent, last_run: runs?.[0] ?? null, cost_today: costToday };
        }),
      );

      setAgents(enriched);
    } finally {
      setIsLoading(false);
    }
  }

  async function cloneAgent(agent: Agent) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newAgent } = await supabase
      .from("agents" as never)
      .insert({
        name: `${agent.name} (copy)`,
        description: agent.description,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single() as { data: { id: string } | null };

    if (!newAgent) { toast.error("Clone failed"); return; }

    if (agent.current_version_id) {
      const { data: version } = await supabase
        .from("agent_versions" as never)
        .select("flow_json")
        .eq("id", agent.current_version_id)
        .single() as { data: { flow_json: unknown } | null };

      if (version) {
        const { data: newVersion } = await supabase
          .from("agent_versions" as never)
          .insert({ agent_id: newAgent.id, version: 1, flow_json: version.flow_json, published_by: user.id })
          .select("id")
          .single() as { data: { id: string } | null };

        if (newVersion) {
          await supabase
            .from("agents" as never)
            .update({ current_version_id: newVersion.id })
            .eq("id", newAgent.id);
        }
      }
    }

    toast.success("Agent cloned");
    loadAgents();
  }

  async function archiveAgent(agentId: string) {
    await supabase
      .from("agents" as never)
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", agentId);
    toast.success("Agent archived");
    loadAgents();
  }

  async function deleteAgent() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("agents" as never)
        .delete()
        .eq("id", deleteTarget.id) as { error: unknown };

      if (error) throw new Error("Delete failed");
      toast.success(`"${deleteTarget.name}" permanently deleted`);
      setDeleteTarget(null);
      loadAgents();
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  }

  async function runAgent(agent: AgentWithStats) {
    const response = await supabase.functions.invoke("trigger-flow-run", {
      body: { agent_id: agent.id, trigger_type: "manual" },
    });
    if (response.error) { toast.error("Failed to trigger run"); return; }
    toast.success("Run queued");
    loadAgents();
  }

  function handleChatSubmit() {
    const prompt = chatInput.trim();
    if (!prompt) return;
    navigate("/adminpanel/agent-builder/new", { state: { initialPrompt: prompt } });
  }

  function handleTemplateClick(template: string) {
    setChatInput(template);
    textareaRef.current?.focus();
  }

  const filtered = agents.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || a.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {/* ── Hero / Chatbox Section ─────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 px-6 py-12">
        {/* Subtle grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-1/4 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />

        {/* Settings button — top-right corner */}
        <button
          onClick={() => navigate("/adminpanel/agent-builder/settings")}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur border border-white/15 text-slate-300 hover:bg-white/15 hover:text-white transition-all text-xs font-medium"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Settings
        </button>

        <div className="relative max-w-2xl mx-auto text-center">
          {/* Icon + title */}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur mb-4 border border-white/20">
            <Zap className="w-6 h-6 text-violet-300" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            Build{" "}
            <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
              AI Agents
            </span>
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Describe what you want to automate — AI will build the flow for you
          </p>

          {/* Chatbox card */}
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-4 ring-1 ring-violet-500/20 shadow-2xl">
            {/* Prompt chips */}
            <div className="flex flex-wrap gap-2 mb-3 justify-center">
              {PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTemplateClick(t)}
                  className={cn(
                    "text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150",
                    chatInput === t
                      ? "bg-violet-500/30 border-violet-400/60 text-violet-200"
                      : "bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:border-white/25 hover:text-white",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder="Describe the agent you want to build…"
                className="flex-1 min-h-[52px] max-h-[120px] resize-none bg-white/10 border-white/15 text-white placeholder:text-slate-400 text-sm rounded-xl focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30"
              />
              <Button
                onClick={handleChatSubmit}
                disabled={!chatInput.trim()}
                className="h-[52px] px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 text-white font-medium gap-2 shadow-lg shadow-violet-900/40 disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                Build
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* "or" separator + New Agent button */}
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-2 bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl"
            onClick={() => navigate("/adminpanel/agent-builder/new")}
          >
            <Plus className="w-3.5 h-3.5" />
            Start from scratch
          </Button>
        </div>
      </div>

      {/* ── Agent List Section ─────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">Your Agents</h2>
            {!isLoading && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                {filtered.length}
              </span>
            )}
          </div>

          {/* Search + filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="pl-8 h-8 text-xs w-52 rounded-lg"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "published", "draft", "archived"] as const).map((f) => (
                <button
                  key={f}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full capitalize font-medium transition-all duration-150",
                    filter === f
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600",
                  )}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent cards */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {agents.length === 0 ? "No agents yet" : "No agents match your search"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {agents.length === 0 ? "Use the chatbox above to build your first agent" : "Try adjusting your search or filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => navigate(`/adminpanel/agent-builder/${agent.id}`)}
                onRun={() => runAgent(agent)}
                onClone={() => cloneAgent(agent)}
                onArchive={() => archiveAgent(agent.id)}
                onDelete={() => setDeleteTarget(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete Danger Modal ────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-base">Delete agent permanently?</DialogTitle>
            </div>
          </DialogHeader>

          <p className="text-sm text-slate-600 mt-1">
            You are about to permanently delete{" "}
            <span className="font-semibold text-slate-900">"{deleteTarget?.name}"</span>.
          </p>
          <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            This action cannot be undone. All versions, run history, and configuration will be lost.
          </p>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteAgent}
              disabled={isDeleting}
              className="gap-2 rounded-lg"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── AgentCard ──────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onOpen,
  onRun,
  onClone,
  onArchive,
  onDelete,
}: {
  agent: AgentWithStats;
  onOpen: () => void;
  onRun: () => void;
  onClone: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const lastRun = agent.last_run;
  const lastRunTime = lastRun ? formatRelativeTime(lastRun.created_at) : null;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-violet-200 transition-all duration-200 overflow-hidden">
      {/* Top gradient bar per status */}
      <div
        className={cn(
          "h-1 w-full",
          agent.status === "published" && "bg-gradient-to-r from-emerald-400 to-teal-400",
          agent.status === "draft" && "bg-gradient-to-r from-amber-400 to-orange-400",
          agent.status === "archived" && "bg-slate-200",
        )}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <button className="text-left flex-1 min-w-0" onClick={onOpen}>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors truncate">
              {agent.name}
            </p>
            {agent.description && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{agent.description}</p>
            )}
          </button>
          <StatusBadge status={agent.status} />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
          {lastRun && (
            <div className="flex items-center gap-1">
              <RunStatusIcon status={lastRun.status} />
              <span>{lastRunTime}</span>
            </div>
          )}
          {(agent.cost_today ?? 0) > 0 && (
            <span className="text-slate-400">
              ${agent.cost_today!.toFixed(3)}/day
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 rounded-lg hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700"
            onClick={onOpen}
          >
            <Edit2 className="w-3 h-3" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
            onClick={onRun}
            disabled={!agent.current_version_id}
          >
            <Play className="w-3 h-3" />
            Run
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={onClone} className="gap-2">
                <Copy className="w-3.5 h-3.5" /> Clone
              </DropdownMenuItem>
              {agent.status !== "archived" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onArchive} className="gap-2 text-slate-500">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </DropdownMenuItem>
                </>
              )}
              {agent.status === "archived" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    draft: "bg-amber-100 text-amber-700",
    archived: "bg-slate-100 text-slate-500",
  };
  const dot = status === "published" ? "●" : status === "draft" ? "◐" : "○";
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0", map[status] ?? "bg-slate-100 text-slate-600")}>
      {dot} {status}
    </span>
  );
}

function RunStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-3 h-3 text-red-500 shrink-0" />;
  if (status === "running" || status === "queued") return <Loader2 className="w-3 h-3 text-blue-500 shrink-0 animate-spin" />;
  return <Clock className="w-3 h-3 text-slate-300 shrink-0" />;
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
