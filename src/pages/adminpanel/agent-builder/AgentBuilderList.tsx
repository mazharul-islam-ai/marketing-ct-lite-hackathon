import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Play, Copy, Archive, Edit2, Search, Bot,
  CheckCircle2, Clock, XCircle, Loader2, MoreHorizontal,
  Trash2, Sparkles, ArrowRight, Settings2, Check,
  Mail, Users, Radar, ListTodo, BarChart3, Linkedin, Undo2, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
import { I420_ROUTES } from "@/lib/i420Routes";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ab } from "./agentBuilderTheme";
import { I420 } from "./i420Brand";
import { CanvasBackground } from "./three/CanvasBackground";
import { useAgentLifecycle } from "./hooks/useAgentLifecycle";
import type { LucideIcon } from "lucide-react";
import type { Agent, AgentRun, FlowJSON } from "./types";
import { getExecutionCapabilities } from "./flowCapabilities";
import { BuilderAgentChatDialog } from "@/components/agents/BuilderAgentChatDialog";

interface PromptTemplate {
  id: string;
  label: string;
  prompt: string;
  icon: LucideIcon;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "email-digest",
    label: "Email digest",
    prompt: "Daily unread email summary delivered by email at 8am",
    icon: Mail,
  },
  {
    id: "crm-slack",
    label: "CRM → Slack",
    prompt: "Analyze CRM leads every morning, send hot leads to Slack",
    icon: Users,
  },
  {
    id: "brand-mentions",
    label: "Brand mentions",
    prompt: "Monitor brand mentions, generate weekly summary reports",
    icon: Radar,
  },
  {
    id: "activecollab-slack",
    label: "Tasks → Slack",
    prompt: "Sync ActiveCollab tasks and notify the team on Slack",
    icon: ListTodo,
  },
  {
    id: "client-summaries",
    label: "Client summaries",
    prompt: "Send weekly client performance summaries via email",
    icon: BarChart3,
  },
  {
    id: "linkedin-content",
    label: "LinkedIn content",
    prompt: "Generate LinkedIn content for new product launches",
    icon: Linkedin,
  },
];

interface AgentWithStats extends Agent {
  last_run?: AgentRun | null;
  cost_today?: number;
  flow_json?: FlowJSON | null;
}

type LifecycleAction = "unpublish" | "archive" | "delete";

export default function AgentBuilderList() {
  const navigate = useNavigate();
  const { unpublishAgent, archiveAgent, deleteAgent, cloneAgent } = useAgentLifecycle();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [lifecycleTarget, setLifecycleTarget] = useState<{ agent: AgentWithStats; action: LifecycleAction } | null>(null);
  const [isLifecyclePending, setIsLifecyclePending] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [chatAgent, setChatAgent] = useState<AgentWithStats | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const minH = 72;
    const maxH = 144;
    el.style.height = "auto";
    el.style.height = `${Math.max(minH, Math.min(el.scrollHeight, maxH))}px`;
  }, [chatInput]);

  async function loadAgents() {
    setIsLoading(true);
    try {
      const { data: agentsData } = await supabase
        .from("agents" as never)
        .select("*")
        .order("updated_at", { ascending: false }) as { data: Agent[] | null };

      if (!agentsData) return;

      const versionIds = agentsData
        .map((a) => a.current_version_id)
        .filter((id): id is string => Boolean(id));

      let flowByVersion = new Map<string, FlowJSON>();
      if (versionIds.length > 0) {
        const { data: versions } = await supabase
          .from("agent_versions" as never)
          .select("id, flow_json")
          .in("id", versionIds) as { data: { id: string; flow_json: FlowJSON }[] | null };

        flowByVersion = new Map(
          (versions ?? []).map((v) => [v.id, v.flow_json]),
        );
      }

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
          return {
            ...agent,
            last_run: runs?.[0] ?? null,
            cost_today: costToday,
            flow_json: agent.current_version_id
              ? flowByVersion.get(agent.current_version_id) ?? null
              : null,
          };
        }),
      );

      setAgents(enriched);
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmLifecycleAction() {
    if (!lifecycleTarget) return;
    setIsLifecyclePending(true);
    try {
      const { agent, action } = lifecycleTarget;
      let ok = false;
      if (action === "unpublish") ok = await unpublishAgent(agent.id);
      else if (action === "archive") ok = await archiveAgent(agent.id);
      else if (action === "delete") ok = await deleteAgent(agent.id);

      if (ok) {
        setLifecycleTarget(null);
        loadAgents();
      }
    } finally {
      setIsLifecyclePending(false);
    }
  }

  async function runAgent(agent: AgentWithStats) {
    const response = await supabase.functions.invoke("trigger-flow-run", {
      body: {
        agent_id: agent.id,
        version_id: agent.current_version_id ?? undefined,
        trigger_type: "manual",
        input_context: { mode: "report" },
      },
    });
    if (response.error) { toast.error("Failed to trigger run"); return; }
    toast.success("Run queued");
    loadAgents();
  }

  function handleChatSubmit() {
    const prompt = chatInput.trim();
    if (!prompt) return;
    navigate(I420_ROUTES.new, { state: { initialPrompt: prompt } });
  }

  function handleChatInputChange(value: string) {
    setChatInput(value);
    const match = PROMPT_TEMPLATES.find((t) => t.prompt === value);
    setSelectedTemplateId(match?.id ?? null);
  }

  function handleTemplateClick(template: PromptTemplate) {
    setChatInput(template.prompt);
    setSelectedTemplateId(template.id);
    textareaRef.current?.focus();
  }

  const filtered = agents.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || a.status === filter;
    return matchesSearch && matchesFilter;
  });

  const lifecycleCopy = lifecycleTarget?.action === "unpublish"
    ? {
        title: "Move to draft?",
        body: "This removes the agent from /ai-agents and invalidates any public link. Scheduled runs are paused. You can keep editing in i420.",
        confirm: "Move to draft",
        icon: Undo2,
        destructive: false,
      }
    : lifecycleTarget?.action === "archive"
    ? {
        title: "Archive this workflow?",
        body: "It will move to the Archived filter only. You can delete it permanently later.",
        confirm: "Archive",
        icon: Archive,
        destructive: false,
      }
    : {
        title: "Delete permanently?",
        body: "This cannot be undone. All versions, run history, and configuration will be lost.",
        confirm: "Delete permanently",
        icon: Trash2,
        destructive: true,
      };

  return (
    <div className={cn(ab.page, ab.canvas, "rounded-xl p-1 -m-1 relative overflow-hidden")}>
      <CanvasBackground variant="list" className="absolute inset-0 -z-10 opacity-40" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>{I420.studioLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Bot className={cn("h-7 w-7", ab.accentText)} />
          <div>
            <h1 className={cn("text-2xl font-bold tracking-tight", ab.fontHeading, ab.textForeground)}>{I420.studioLabel}</h1>
            <p className={cn("text-xs", ab.textMuted)}>{I420.tagline}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(I420_ROUTES.settings)}>
          <Settings2 className="w-4 h-4" />
          Settings
        </Button>
      </div>

      <div className={cn(ab.composerCompact, ab.surfaceElevated, "space-y-3")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn("text-sm font-semibold", ab.textForeground)}>Create a new workflow</h2>
          <button
            type="button"
            onClick={() => navigate(I420_ROUTES.new)}
            className={cn("inline-flex items-center gap-1 text-xs font-medium hover:underline shrink-0", ab.accentText)}
          >
            <Plus className="w-3 h-3" />
            Start from scratch
          </button>
        </div>

        <div className={cn(ab.promptBar, ab.input)}>
          <Textarea
            ref={textareaRef}
            value={chatInput}
            onChange={(e) => handleChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
              }
            }}
            rows={3}
            placeholder="Describe the agent you want to build…"
            className="flex-1 min-h-[4.5rem] max-h-36 resize-none text-sm leading-6 border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 py-2"
          />
          <Button
            onClick={handleChatSubmit}
            disabled={!chatInput.trim()}
            aria-label={chatInput.trim() ? "Build agent from description" : "Enter a description to build"}
            className={cn("h-9 px-4 gap-1.5 rounded-lg text-xs shrink-0 mb-0.5", ab.accentBtn)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Build
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>

        <p className={cn("text-[10px]", ab.textMuted)}>Enter to build · Shift+Enter for new line</p>

        <div className="space-y-1.5">
          <p className={cn("text-[10px] uppercase tracking-wide font-medium", ab.textMuted)}>Try an idea</p>
          <div className={ab.templateStrip}>
            {PROMPT_TEMPLATES.map((t) => {
              const Icon = t.icon;
              const isActive = selectedTemplateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.prompt}
                  aria-pressed={isActive}
                  onClick={() => handleTemplateClick(t)}
                  className={cn(
                    ab.templateChip,
                    "inline-flex items-center gap-1.5",
                    isActive ? ab.chipActive : ab.chip,
                  )}
                >
                  <Icon className="w-3 h-3 shrink-0 opacity-70" />
                  {t.label}
                  {isActive && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className={cn("text-base font-semibold", ab.fontHeading, ab.textForeground)}>Your workflows</h2>
            {!isLoading && (
              <Badge variant="secondary" className={cn("text-xs", ab.accentMuted, ab.accentText)}>
                {filtered.length}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="pl-8 h-8 text-xs w-52"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "published", "draft", "archived"] as const).map((f) => (
                <button
                  key={f}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full capitalize font-medium transition-all duration-150",
                    filter === f ? ab.filterActive : ab.filterInactive,
                  )}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center py-20", ab.emptyState)}>
            <div className="w-16 h-16 rounded-2xl bg-[hsl(18_40%_94%)] flex items-center justify-center mb-4">
              <Bot className={cn("w-8 h-8", ab.accentText)} />
            </div>
            <p className="text-sm font-medium text-foreground">
              {agents.length === 0 ? "No agents yet" : "No agents match your search"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {agents.length === 0 ? "Use the prompt composer above to build your first agent" : "Try adjusting your search or filter"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => navigate(I420_ROUTES.agent(agent.id))}
                onRun={() => runAgent(agent)}
                onChat={() => setChatAgent(agent)}
                onClone={() => cloneAgent(agent).then(() => loadAgents())}
                onUnpublish={() => setLifecycleTarget({ agent, action: "unpublish" })}
                onArchive={() => setLifecycleTarget({ agent, action: "archive" })}
                onDelete={() => setLifecycleTarget({ agent, action: "delete" })}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!lifecycleTarget} onOpenChange={(open) => !open && setLifecycleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                lifecycleCopy.destructive ? "bg-red-100" : "bg-amber-100",
              )}>
                {lifecycleTarget && (
                  <lifecycleCopy.icon className={cn("w-5 h-5", lifecycleCopy.destructive ? "text-red-600" : "text-amber-700")} />
                )}
              </div>
              <DialogTitle className="text-base">{lifecycleCopy.title}</DialogTitle>
            </div>
          </DialogHeader>

          {lifecycleTarget && (
            <>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-semibold text-slate-900">"{lifecycleTarget.agent.name}"</span>
                {" — "}
                {lifecycleCopy.body}
              </p>
              {lifecycleCopy.destructive && (
                <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  Permanent deletion requires super admin permissions.
                </p>
              )}
            </>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setLifecycleTarget(null)}
              disabled={isLifecyclePending}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant={lifecycleCopy.destructive ? "destructive" : "default"}
              className={cn("gap-2 rounded-lg", !lifecycleCopy.destructive && ab.accentBtn)}
              onClick={confirmLifecycleAction}
              disabled={isLifecyclePending}
            >
              {isLifecyclePending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <lifecycleCopy.icon className="w-3.5 h-3.5" />
              )}
              {lifecycleCopy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {chatAgent && (
        <BuilderAgentChatDialog
          agentId={chatAgent.id}
          agentName={chatAgent.name}
          versionId={chatAgent.current_version_id}
          onClose={() => setChatAgent(null)}
        />
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onOpen,
  onRun,
  onChat,
  onClone,
  onUnpublish,
  onArchive,
  onDelete,
}: {
  agent: AgentWithStats;
  onOpen: () => void;
  onRun: () => void;
  onChat: () => void;
  onClone: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const lastRun = agent.last_run;
  const lastRunTime = lastRun ? formatRelativeTime(lastRun.created_at) : null;
  const isArchived = agent.status === "archived";
  const hasVersion = Boolean(agent.current_version_id);
  const { hasChat, hasReport, isDualMode, isChatOnly } = getExecutionCapabilities(
    agent.flow_json,
  );

  return (
    <div className={cn(
      "group relative rounded-2xl border transition-all duration-200 overflow-hidden",
      ab.agentCard,
      ab.listCard3d,
    )}>
      <div
        className={cn(
          "h-1 w-full",
          agent.status === "published" && "bg-[hsl(18_52%_52%)]",
          agent.status === "draft" && "bg-[hsl(35_25%_75%)]",
          agent.status === "archived" && "bg-slate-200",
        )}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button className="text-left flex-1 min-w-0" onClick={onOpen}>
            <p className={cn("text-sm font-semibold group-hover:text-[hsl(18_45%_38%)] transition-colors truncate", ab.textForeground)}>
              {agent.name}
            </p>
            {agent.description && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{agent.description}</p>
            )}
          </button>
          <StatusBadge status={agent.status} />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {hasChat && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-violet-200 text-violet-700 bg-violet-50">
              Chat
            </Badge>
          )}
          {hasReport && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald-200 text-emerald-700 bg-emerald-50">
              Report
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
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

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[hsl(35_15%_88%)]">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 hover:bg-[hsl(18_35%_95%)] hover:border-[hsl(18_30%_80%)] hover:text-[hsl(18_45%_38%)]"
            onClick={onOpen}
          >
            <Edit2 className="w-3 h-3" />
            Open
          </Button>
          {!isArchived && hasChat && (
            <Button
              variant={isChatOnly ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1 h-7 text-xs gap-1 rounded-lg",
                isChatOnly
                  ? cn(ab.accentBtn, "border-0")
                  : "hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700",
              )}
              onClick={onChat}
              disabled={!hasVersion}
            >
              <MessageSquare className="w-3 h-3" />
              Chat
            </Button>
          )}
          {!isArchived && hasReport && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs gap-1 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
              onClick={onRun}
              disabled={!hasVersion}
            >
              <Play className="w-3 h-3" />
              {isDualMode ? "Report" : "Run"}
            </Button>
          )}
          {!isArchived && !hasChat && !hasReport && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs gap-1 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
              onClick={onRun}
              disabled={!hasVersion}
            >
              <Play className="w-3 h-3" />
              Run
            </Button>
          )}

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
              {agent.status === "published" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onUnpublish} className="gap-2">
                    <Undo2 className="w-3.5 h-3.5" /> Move to draft
                  </DropdownMenuItem>
                </>
              )}
              {agent.status === "draft" && (
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
