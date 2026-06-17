import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Play, Square, Loader2, Globe, ChevronRight,
  CheckCircle2, MoreHorizontal, Archive, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DesignTab } from "./tabs/DesignTab";
import { RuntimeTab } from "./tabs/RuntimeTab";
import { JsonTab } from "./tabs/JsonTab";
import { LogsTab } from "./tabs/LogsTab";
import { VersionsTab } from "./tabs/VersionsTab";
import { useFlowRun } from "./hooks/useFlowRun";
import { PublishModal } from "./PublishModal";
import type { AgentVisibility } from "./types";
import type { Agent, AgentVersion, FlowJSON } from "./types";

type StudioTab = "design" | "runtime" | "json" | "logs" | "versions";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "design",   label: "Design" },
  { id: "runtime",  label: "Runtime" },
  { id: "json",     label: "JSON" },
  { id: "logs",     label: "Logs" },
  { id: "versions", label: "Versions" },
];

export default function AgentBuilderStudio() {
  const { agentId: agentIdParam } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isNew = !agentIdParam || agentIdParam === "new";
  const [liveAgentId, setLiveAgentId] = useState<string | null>(isNew ? null : (agentIdParam ?? null));

  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentName, setAgentName] = useState("");
  const [currentFlow, setCurrentFlow] = useState<FlowJSON | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>("design");
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [nodeRunStatuses] = useState<Record<string, { status: string; cost?: number; tokens?: number }>>({});
  const [currentNodeId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const { currentRun, isTriggering, triggerRun, cancelRun, clearRun } = useFlowRun();

  const initialPromptRef = useRef<string | null>(
    (location.state as { initialPrompt?: string } | null)?.initialPrompt ?? null,
  );
  const [designTabKey, setDesignTabKey] = useState(0);

  useEffect(() => {
    if (isNew) return;
    const id = agentIdParam;
    if (!id) return;

    async function load() {
      const { data: agentData } = await supabase
        .from("agents" as never)
        .select("*")
        .eq("id", id)
        .single() as { data: Agent | null };

      if (!agentData) {
        toast.error("Agent not found");
        navigate("/adminpanel/agent-builder");
        return;
      }

      setAgent(agentData);
      setAgentName(agentData.name);
      setCurrentVersionId(agentData.current_version_id);
      setLiveAgentId(agentData.id);

      if (agentData.current_version_id) {
        const { data: version } = await supabase
          .from("agent_versions" as never)
          .select("flow_json")
          .eq("id", agentData.current_version_id)
          .single() as { data: { flow_json: FlowJSON } | null };

        if (version?.flow_json) setCurrentFlow(version.flow_json);
      }
    }

    load();
  }, [agentIdParam, isNew, navigate]);

  useEffect(() => {
    if (currentRun?.status === "running" || currentRun?.status === "queued") {
      setActiveTab("runtime");
    }
  }, [currentRun?.status]);

  const handleAgentCreated = useCallback((newAgentId: string, name: string) => {
    setLiveAgentId(newAgentId);
    setAgentName(name);
    navigate(`/adminpanel/agent-builder/${newAgentId}`, { replace: true });
    setDesignTabKey((k) => k + 1);
  }, [navigate]);

  const handleSave = useCallback(async () => {
    if (!liveAgentId || !agentName.trim()) return;
    setIsSaving(true);
    try {
      await supabase
        .from("agents" as never)
        .update({ name: agentName, updated_at: new Date().toISOString() })
        .eq("id", liveAgentId);
      toast.success("Saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [liveAgentId, agentName]);

  const handleRun = useCallback(async () => {
    if (!liveAgentId) return;
    clearRun();
    const runId = await triggerRun(liveAgentId, currentVersionId ?? undefined, "manual");
    if (!runId) toast.error("Failed to start run");
  }, [liveAgentId, currentVersionId, triggerRun, clearRun]);

  const handlePublish = useCallback(async (visibility: AgentVisibility) => {
    if (!liveAgentId) return;
    const { data, error } = await supabase
      .from("agents" as never)
      .update({ status: "published", visibility, updated_at: new Date().toISOString() })
      .eq("id", liveAgentId)
      .select("public_token")
      .single() as { data: { public_token: string } | null; error: unknown };

    if (error) {
      toast.error("Publish failed");
      return;
    }

    setAgent((prev) => prev ? { ...prev, status: "published" } : prev);
    toast.success("Agent published");

    if (visibility !== "public") {
      setShowPublishModal(false);
    }

    return visibility === "public" && data ? { publicToken: data.public_token } : undefined;
  }, [liveAgentId]);

  const handleArchive = useCallback(async () => {
    if (!liveAgentId) return;
    await supabase
      .from("agents" as never)
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", liveAgentId);
    toast.success("Archived");
    navigate("/adminpanel/agent-builder");
  }, [liveAgentId, navigate]);

  const handleRollback = useCallback((version: AgentVersion) => {
    setCurrentFlow(version.flow_json);
    setCurrentVersionId(version.id);
  }, []);

  const handleJsonApply = useCallback((flow: FlowJSON) => {
    setCurrentFlow(flow);
    toast.success("Flow updated from JSON");
    setActiveTab("design");
  }, []);

  const isRunActive = currentRun?.status === "running" || currentRun?.status === "queued";
  const agentStatus = agent?.status ?? "draft";

  const statusColors = {
    published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    draft:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
    archived:  "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const statusDot = {
    published: "bg-emerald-400",
    draft:     "bg-amber-400",
    archived:  "bg-slate-500",
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ── Top gradient accent ── */}
      <div className="h-px w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600 shrink-0" />

      {/* ── Dark IDE Header ── */}
      <div className="flex items-center gap-0 px-3 h-11 border-b border-slate-800 bg-slate-950 shrink-0">

        {/* Breadcrumb + editable name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={() => navigate("/adminpanel/agent-builder")}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap shrink-0"
          >
            Agents
          </button>
          <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
          {isEditingName ? (
            <input
              autoFocus
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setIsEditingName(false); }}
              className="text-xs font-semibold text-white bg-slate-800 border border-violet-500/50 rounded px-2 py-0.5 outline-none max-w-56 min-w-20"
              placeholder="Untitled Agent"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs font-semibold text-slate-200 hover:text-white truncate max-w-56 text-left hover:bg-slate-800 rounded px-1.5 py-0.5 transition-colors"
              title="Click to rename"
            >
              {agentName || "Untitled Agent"}
            </button>
          )}

          {/* Status badge */}
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
            statusColors[agentStatus as keyof typeof statusColors] ?? statusColors.draft,
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot[agentStatus as keyof typeof statusDot] ?? statusDot.draft)} />
            {agentStatus}
          </span>
        </div>

        {/* ── Tab bar (centred) ── */}
        <div className="flex items-center gap-0.5 mx-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-3 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
                activeTab === tab.id
                  ? "bg-slate-800 text-violet-300"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
              )}
              {tab.id === "runtime" && isRunActive && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block align-middle animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* ── Right actions ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Save */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] gap-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={handleSave}
            disabled={isSaving || !liveAgentId}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save
          </Button>

          {/* Run / Stop */}
          {isRunActive ? (
            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/50"
              onClick={() => currentRun && cancelRun(currentRun.id)}
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 text-white shadow-md shadow-violet-900/40"
              onClick={handleRun}
              disabled={isTriggering || !currentVersionId || !liveAgentId}
            >
              {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </Button>
          )}

          {/* Publish */}
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-700 hover:bg-emerald-600 text-white border-0"
            onClick={() => setShowPublishModal(true)}
            disabled={!currentVersionId || !liveAgentId}
          >
            <Globe className="w-3 h-3" />
            Publish
          </Button>

          {/* Overflow: clone, archive */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-200 hover:bg-slate-800"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs min-w-[140px]">
              <DropdownMenuItem className="gap-2">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive} className="gap-2 text-slate-500">
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tab content (full remaining height) ── */}
      <div className="flex-1 overflow-hidden bg-white">
        {activeTab === "design" && (
          <DesignTab
            key={designTabKey}
            agentId={liveAgentId}
            agentName={agentName || "Untitled Agent"}
            initialFlowJson={currentFlow}
            onFlowChange={setCurrentFlow}
            nodeRunStatuses={nodeRunStatuses}
            currentNodeId={currentNodeId}
            onAgentCreated={handleAgentCreated}
            initialPrompt={initialPromptRef.current ?? undefined}
          />
        )}
        {activeTab === "runtime" && (
          <RuntimeTab
            currentRun={currentRun}
            onCancelRun={currentRun ? () => cancelRun(currentRun.id) : undefined}
          />
        )}
        {activeTab === "json" && (
          <JsonTab flowJson={currentFlow} onApply={handleJsonApply} />
        )}
        {activeTab === "logs" && liveAgentId && (
          <LogsTab agentId={liveAgentId} currentRunId={currentRun?.id} />
        )}
        {activeTab === "versions" && liveAgentId && (
          <VersionsTab
            agentId={liveAgentId}
            currentVersionId={currentVersionId}
            onRollback={handleRollback}
          />
        )}
      </div>

      {showPublishModal && agent && (
        <PublishModal
          agent={agent}
          currentVersionId={currentVersionId}
          onPublish={handlePublish}
          onClose={() => setShowPublishModal(false)}
        />
      )}

    </div>
  );
}
