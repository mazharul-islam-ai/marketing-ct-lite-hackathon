import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Play, Square, Loader2, Globe, ChevronRight,
  CheckCircle2, MoreHorizontal, Archive, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DesignTab } from "./tabs/DesignTab";
import { RuntimeTab } from "./tabs/RuntimeTab";
import { JsonTab } from "./tabs/JsonTab";
import { LogsTab } from "./tabs/LogsTab";
import { VersionsTab } from "./tabs/VersionsTab";
import { useFlowRun } from "./hooks/useFlowRun";
import { useAutoSaveDraft } from "./hooks/useAutoSaveDraft";
import { PublishModal } from "./PublishModal";
import { ab } from "./agentBuilderTheme";
import type { AgentVisibility } from "./types";
import type { Agent, AgentVersion, FlowJSON } from "./types";
import { extractCronFromFlow, computeNextRunAt } from "@/lib/automationSchedule";

type StudioTab = "design" | "runtime" | "json" | "logs" | "versions";

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
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(
    () => initialPromptRef.current,
  );
  const [isCompiling, setIsCompiling] = useState(false);

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
  }, [navigate]);

  const handleInitialPromptConsumed = useCallback(() => {
    initialPromptRef.current = null;
    setPendingInitialPrompt(null);
  }, []);

  const handleCompileComplete = useCallback((versionId: string) => {
    setCurrentVersionId(versionId);
  }, []);

  const handleVersionUpdated = useCallback((versionId: string) => {
    setCurrentVersionId(versionId);
  }, []);

  const { saveStatus: draftSaveStatus } = useAutoSaveDraft(
    liveAgentId,
    currentVersionId,
    currentFlow,
    { isCompiling },
  );

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

    const cronExpression = extractCronFromFlow(currentFlow);
    if (cronExpression) {
      const nextRunAt = computeNextRunAt(cronExpression).toISOString();
      const { data: existing } = await supabase
        .from("automations" as never)
        .select("id")
        .eq("agent_id", liveAgentId)
        .maybeSingle() as { data: { id: string } | null };

      if (existing?.id) {
        await supabase
          .from("automations" as never)
          .update({
            cron_expression: cronExpression,
            is_active: true,
            next_run_at: nextRunAt,
            trigger_type: "cron",
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("automations" as never).insert({
          agent_id: liveAgentId,
          trigger_type: "cron",
          cron_expression: cronExpression,
          is_active: true,
          next_run_at: nextRunAt,
        });
      }
    }

    setAgent((prev) => prev ? { ...prev, status: "published" } : prev);
    toast.success(cronExpression ? "Agent published — automation scheduled" : "Agent published");

    if (visibility !== "public") {
      setShowPublishModal(false);
    }

    return visibility === "public" && data ? { publicToken: data.public_token } : undefined;
  }, [liveAgentId, currentFlow]);

  const handleArchive = useCallback(async () => {
    if (!liveAgentId) return;
    await supabase
      .from("agents" as never)
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", liveAgentId);
    await supabase
      .from("automations" as never)
      .update({ is_active: false })
      .eq("agent_id", liveAgentId);
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
    published: "bg-emerald-50 text-emerald-700 border-emerald-200",
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-muted text-muted-foreground border-border",
  };
  const statusDot = {
    published: "bg-emerald-500",
    draft: "bg-amber-500",
    archived: "bg-muted-foreground",
  };

  return (
    <div className={ab.studioShell}>
      <div className={ab.studioHeader}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={() => navigate("/adminpanel/agent-builder")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
          >
            Agents
          </button>
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          {isEditingName ? (
            <input
              autoFocus
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setIsEditingName(false); }}
              className={cn("text-xs font-semibold rounded px-2 py-0.5 outline-none max-w-56 min-w-20", ab.input, ab.textForeground)}
              placeholder="Untitled Agent"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className={cn("text-xs font-semibold truncate max-w-56 text-left rounded px-1.5 py-0.5 transition-colors hover:bg-[hsl(250_25%_94%)]", ab.textForeground)}
              title="Click to rename"
            >
              {agentName || "Untitled Agent"}
            </button>
          )}

          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
            statusColors[agentStatus as keyof typeof statusColors] ?? statusColors.draft,
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot[agentStatus as keyof typeof statusDot] ?? statusDot.draft)} />
            {agentStatus}
          </span>

          {draftSaveStatus === "saving" && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", ab.textMuted)}>Saving draft…</span>
          )}
          {draftSaveStatus === "saved" && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", ab.accentText)}>Draft saved</span>
          )}
          {draftSaveStatus === "error" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-red-600">Save failed</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-[11px] gap-1"
            onClick={handleSave}
            disabled={isSaving || !liveAgentId}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save
          </Button>

          {isRunActive ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1"
              onClick={() => currentRun && cancelRun(currentRun.id)}
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className={cn("h-7 px-2.5 text-[11px] gap-1", ab.accentBtn)}
                  onClick={handleRun}
                  disabled={isTriggering || isCompiling || !currentVersionId || !liveAgentId}
                >
                  {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                Runs execute on Trigger.dev — see Runtime tab for report output (mode=report).
              </TooltipContent>
            </Tooltip>
          )}

          <div className="flex items-center gap-1.5">
            {agentStatus === "draft" && (
              <span className={cn("text-[10px] hidden sm:inline", ab.textMuted)}>
                Publish as Workspace to show on /ai-agents
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-[11px] gap-1"
              onClick={() => setShowPublishModal(true)}
              disabled={!currentVersionId || !liveAgentId}
            >
              <Globe className="w-3 h-3" />
              Publish
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs min-w-[140px]">
              <DropdownMenuItem className="gap-2">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive} className="gap-2 text-muted-foreground">
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StudioTab)} className="flex flex-col flex-1 overflow-hidden">
        <div className={ab.studioTabs}>
          <TabsList className="h-9 bg-transparent p-0 gap-1 overflow-x-auto">
            <TabsTrigger value="design" className={cn("text-xs data-[state=active]:bg-[hsl(248_40%_96%)] data-[state=active]:text-[hsl(248_45%_42%)]", ab.textMuted)}>Design</TabsTrigger>
            <TabsTrigger value="runtime" className={cn("text-xs data-[state=active]:bg-[hsl(248_40%_96%)] data-[state=active]:text-[hsl(248_45%_42%)]", ab.textMuted)}>
              Runtime
              {isRunActive && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(248_50%_62%)] inline-block align-middle animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="json" className={cn("text-xs data-[state=active]:bg-[hsl(248_40%_96%)] data-[state=active]:text-[hsl(248_45%_42%)]", ab.textMuted)}>JSON</TabsTrigger>
            <TabsTrigger value="logs" className={cn("text-xs data-[state=active]:bg-[hsl(248_40%_96%)] data-[state=active]:text-[hsl(248_45%_42%)]", ab.textMuted)}>Logs</TabsTrigger>
            <TabsTrigger value="versions" className={cn("text-xs data-[state=active]:bg-[hsl(248_40%_96%)] data-[state=active]:text-[hsl(248_45%_42%)]", ab.textMuted)}>Versions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="design"
          forceMount
          className={cn("flex-1 overflow-hidden m-0 mt-0", activeTab !== "design" && "hidden")}
        >
          <DesignTab
            agentId={liveAgentId}
            agentName={agentName || "Untitled Agent"}
            initialFlowJson={currentFlow}
            onFlowChange={setCurrentFlow}
            nodeRunStatuses={nodeRunStatuses}
            currentNodeId={currentNodeId}
            onAgentCreated={handleAgentCreated}
            onCompileComplete={handleCompileComplete}
            onVersionUpdated={handleVersionUpdated}
            onCompilingChange={setIsCompiling}
            initialPrompt={pendingInitialPrompt ?? undefined}
            onInitialPromptConsumed={handleInitialPromptConsumed}
          />
        </TabsContent>
        <TabsContent value="runtime" className="flex-1 overflow-hidden m-0 mt-0">
          <RuntimeTab
            currentRun={currentRun}
            onCancelRun={currentRun ? () => cancelRun(currentRun.id) : undefined}
          />
        </TabsContent>
        <TabsContent value="json" className="flex-1 overflow-hidden m-0 mt-0">
          <JsonTab flowJson={currentFlow} onApply={handleJsonApply} />
        </TabsContent>
        <TabsContent value="logs" className="flex-1 overflow-hidden m-0 mt-0">
          {liveAgentId ? (
            <LogsTab agentId={liveAgentId} currentRunId={currentRun?.id} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Save the agent first to view logs
            </div>
          )}
        </TabsContent>
        <TabsContent value="versions" className="flex-1 overflow-hidden m-0 mt-0">
          {liveAgentId ? (
            <VersionsTab
              agentId={liveAgentId}
              currentVersionId={currentVersionId}
              onRollback={handleRollback}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Save the agent first to view versions
            </div>
          )}
        </TabsContent>
      </Tabs>

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
