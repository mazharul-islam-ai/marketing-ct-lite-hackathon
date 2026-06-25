import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Play, Square, Loader2, Globe, ChevronRight,
  CheckCircle2, MoreHorizontal, Archive, Copy, Trash2, Undo2, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAgentLifecycle } from "./hooks/useAgentLifecycle";
import { PublishModal } from "./PublishModal";
import { ab } from "./agentBuilderTheme";
import { I420, flowHasContent } from "./i420Brand";
import type { AgentVisibility } from "./types";
import type { Agent, AgentVersion, FlowJSON } from "./types";
import { I420_ROUTES } from "@/lib/i420Routes";
import { extractCronFromFlow, computeNextRunAt } from "@/lib/automationSchedule";
import { getExecutionCapabilities } from "./flowCapabilities";

type StudioTab = "design" | "runtime" | "json" | "logs" | "versions";
type LifecycleAction = "unpublish" | "archive" | "delete";

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
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [isLifecyclePending, setIsLifecyclePending] = useState(false);

  const { unpublishAgent, archiveAgent, deleteAgent, cloneAgent } = useAgentLifecycle();
  const { currentRun, isTriggering, triggerRun, cancelRun, clearRun } = useFlowRun();

  const initialPromptRef = useRef<string | null>(
    (location.state as { initialPrompt?: string } | null)?.initialPrompt ?? null,
  );
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(
    () => initialPromptRef.current,
  );
  const [isCompiling, setIsCompiling] = useState(false);
  const [cardChatOpen, setCardChatOpen] = useState(false);

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
        navigate(I420_ROUTES.root);
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
    navigate(I420_ROUTES.agent(newAgentId), { replace: true });
  }, [navigate]);

  const handleInitialPromptConsumed = useCallback(() => {
    initialPromptRef.current = null;
    setPendingInitialPrompt(null);
  }, []);

  const handleCompileComplete = useCallback((versionId: string, version: number) => {
    setCurrentVersionId(versionId);
    setCurrentVersionNumber(version);
  }, []);

  const handleVersionUpdated = useCallback((versionId: string, version: number) => {
    setCurrentVersionId(versionId);
    setCurrentVersionNumber(version);
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
    setCardChatOpen(false);
    clearRun();
    const { runId, error } = await triggerRun(liveAgentId, currentVersionId ?? undefined, "manual");
    if (!runId) toast.error(error ?? "Failed to start run");
  }, [liveAgentId, currentVersionId, triggerRun, clearRun]);

  const handleOpenCardChat = useCallback(() => {
    setActiveTab("design");
    setCardChatOpen(true);
  }, []);

  const handleCloseCardChat = useCallback(() => {
    setCardChatOpen(false);
  }, []);

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

  const confirmLifecycleAction = useCallback(async () => {
    if (!liveAgentId || !lifecycleAction) return;
    setIsLifecyclePending(true);
    try {
      let ok = false;
      if (lifecycleAction === "unpublish") {
        ok = await unpublishAgent(liveAgentId);
        if (ok) {
          setAgent((prev) => prev ? { ...prev, status: "draft", visibility: "admin_only" } : prev);
        }
      } else if (lifecycleAction === "archive") {
        ok = await archiveAgent(liveAgentId);
        if (ok) navigate(I420_ROUTES.root);
      } else if (lifecycleAction === "delete") {
        ok = await deleteAgent(liveAgentId);
        if (ok) navigate(I420_ROUTES.root);
      }
      if (ok) setLifecycleAction(null);
    } finally {
      setIsLifecyclePending(false);
    }
  }, [liveAgentId, lifecycleAction, unpublishAgent, archiveAgent, deleteAgent, navigate]);

  const handleDuplicate = useCallback(async () => {
    if (!agent) return;
    const newId = await cloneAgent(agent);
    if (newId) navigate(I420_ROUTES.agent(newId));
  }, [agent, cloneAgent, navigate]);

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
  const isArchived = agentStatus === "archived";

  const lifecycleCopy = lifecycleAction === "unpublish"
    ? {
        title: "Move to draft?",
        body: "This removes the agent from /ai-agents and invalidates any public link. Scheduled runs are paused. You can keep editing in i420.",
        confirm: "Move to draft",
        icon: Undo2,
        destructive: false,
      }
    : lifecycleAction === "archive"
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

  const hasFlow = flowHasContent(currentFlow);
  const executionCaps = getExecutionCapabilities(currentFlow);
  const { hasChat, hasReport, isDualMode, isChatOnly } = executionCaps;
  const canChat = hasChat && !!currentVersionId && !!liveAgentId && hasFlow && !isArchived;
  const isAutomationType =
    hasFlow &&
    (currentFlow?.trigger?.type === "cron_trigger" || !!extractCronFromFlow(currentFlow));

  const runDisabledReason = isCompiling
    ? "Compilation in progress…"
    : !currentVersionId
    ? "No compiled flow yet — describe your automation in the chat first."
    : !hasFlow
    ? "Add nodes to your flow before running."
    : null;

  const displayName = (() => {
    if (!liveAgentId) return I420.newWorkflowLabel;
    if (!hasFlow) return agentName.trim() || I420.newWorkflowLabel;
    return agentName.trim() || I420.newWorkflowLabel;
  })();

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
            onClick={() => navigate(I420_ROUTES.root)}
            className={cn(ab.i420Badge, "hover:opacity-90 transition-opacity shrink-0 cursor-pointer border-0")}
          >
            {I420.name}
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
              placeholder="Name your workflow"
            />
          ) : (
            <button
              onClick={() => liveAgentId && setIsEditingName(true)}
              className={cn(
                "text-xs font-semibold truncate max-w-56 text-left rounded px-1.5 py-0.5 transition-colors",
                liveAgentId && "hover:bg-[hsl(40_20%_96%)]",
                ab.textForeground,
              )}
              title={liveAgentId ? "Click to rename" : undefined}
              disabled={!liveAgentId}
            >
              {displayName}
            </button>
          )}

          {hasFlow && (
            <span className={cn(
              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
              isAutomationType
                ? cn(ab.accentSoft)
                : cn(ab.accentSoft),
            )}>
              {isAutomationType ? "Automation" : "Agent"}
            </span>
          )}

          {liveAgentId && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
              statusColors[agentStatus as keyof typeof statusColors] ?? statusColors.draft,
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot[agentStatus as keyof typeof statusDot] ?? statusDot.draft)} />
              {agentStatus}
            </span>
          )}

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
            <>
              {hasChat && !isAutomationType && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn(
                        "h-7 px-2.5 text-[11px] gap-1",
                        isChatOnly
                          ? ab.accentBtn
                          : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
                      )}
                      onClick={handleOpenCardChat}
                      disabled={!canChat || isCompiling}
                    >
                      <MessageSquare className="w-3 h-3" />
                      Chat
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                    Open inline chat preview on the agent card
                  </TooltipContent>
                </Tooltip>
              )}
              {hasReport && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn(
                        "h-7 px-2.5 text-[11px] gap-1",
                        isDualMode ? "outline" : ab.accentBtn,
                      )}
                      onClick={handleRun}
                      disabled={isTriggering || isCompiling || !currentVersionId || !liveAgentId || !hasFlow || isArchived}
                    >
                      {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      {isDualMode ? "Run Report" : "Run"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                    {runDisabledReason ?? "Run report mode — output appears in the Runtime tab."}
                  </TooltipContent>
                </Tooltip>
              )}
              {!hasChat && !hasReport && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn("h-7 px-2.5 text-[11px] gap-1", ab.accentBtn)}
                      onClick={handleRun}
                      disabled={isTriggering || isCompiling || !currentVersionId || !liveAgentId || !hasFlow || isArchived}
                    >
                      {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Run
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                    {runDisabledReason ?? "Run this automation manually — output appears in the Runtime tab."}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}

          <div className="flex items-center gap-1.5">
            {agentStatus === "draft" && hasFlow && (
              <span className={cn("text-[10px] hidden sm:inline", ab.textMuted)}>
                Publish as Workspace to show on /ai-agents
              </span>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-[11px] gap-1"
              onClick={() => setShowPublishModal(true)}
              disabled={!currentVersionId || !liveAgentId || !hasFlow || isArchived}
            >
              <Globe className="w-3 h-3" />
              Publish
            </Button>
          </div>

          {liveAgentId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs min-w-[140px]">
                <DropdownMenuItem onClick={handleDuplicate} className="gap-2" disabled={!agent}>
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </DropdownMenuItem>
                {agentStatus === "published" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLifecycleAction("unpublish")} className="gap-2">
                      <Undo2 className="w-3.5 h-3.5" /> Move to draft
                    </DropdownMenuItem>
                  </>
                )}
                {agentStatus === "draft" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLifecycleAction("archive")} className="gap-2 text-muted-foreground">
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </DropdownMenuItem>
                  </>
                )}
                {agentStatus === "archived" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setLifecycleAction("delete")}
                      className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StudioTab)} className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <div className={ab.studioTabs}>
          <TabsList className="h-9 bg-transparent p-0 gap-1 overflow-x-auto">
            <TabsTrigger value="design" className={cn("text-xs data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)]", ab.textMuted)}>Design</TabsTrigger>
            <TabsTrigger value="runtime" className={cn("text-xs data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)]", ab.textMuted)}>
              Runtime
              {isRunActive && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(18_52%_52%)] inline-block align-middle animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="json" className={cn("text-xs data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)]", ab.textMuted)}>JSON</TabsTrigger>
            <TabsTrigger value="logs" className={cn("text-xs data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)]", ab.textMuted)}>Logs</TabsTrigger>
            <TabsTrigger value="versions" className={cn("text-xs data-[state=active]:bg-[hsl(18_35%_95%)] data-[state=active]:text-[hsl(18_45%_38%)]", ab.textMuted)}>Versions</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="design"
          forceMount
          className={cn("flex-1 min-h-0 h-full overflow-hidden m-0 mt-0", activeTab !== "design" && "hidden")}
        >
          <DesignTab
            agentId={liveAgentId}
            agentName={displayName}
            agentDescription={agent?.description}
            agentStatus={agentStatus as "draft" | "published" | "archived"}
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
            currentRun={currentRun}
            isRunActive={isRunActive}
            isTriggering={isTriggering}
            canRun={!isCompiling && !!currentVersionId && !!liveAgentId && hasFlow}
            onRun={handleRun}
            onStop={() => currentRun && cancelRun(currentRun.id)}
            versionNumber={currentVersionNumber ?? undefined}
            versionId={currentVersionId}
            cardChatOpen={cardChatOpen}
            onOpenCardChat={handleOpenCardChat}
            onCloseCardChat={handleCloseCardChat}
          />
        </TabsContent>
        <TabsContent value="runtime" className="flex-1 min-h-0 h-full overflow-hidden m-0 mt-0">
          <RuntimeTab
            currentRun={currentRun}
            onCancelRun={currentRun ? () => cancelRun(currentRun.id) : undefined}
          />
        </TabsContent>
        <TabsContent value="json" className="flex-1 min-h-0 h-full overflow-hidden m-0 mt-0">
          <JsonTab flowJson={currentFlow} onApply={handleJsonApply} />
        </TabsContent>
        <TabsContent value="logs" className="flex-1 min-h-0 h-full overflow-hidden m-0 mt-0">
          {liveAgentId ? (
            <LogsTab agentId={liveAgentId} currentRunId={currentRun?.id} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Save the agent first to view logs
            </div>
          )}
        </TabsContent>
        <TabsContent value="versions" className="flex-1 min-h-0 h-full overflow-hidden m-0 mt-0">
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

      <Dialog open={!!lifecycleAction} onOpenChange={(open) => !open && setLifecycleAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                lifecycleCopy.destructive ? "bg-red-100" : "bg-amber-100",
              )}>
                <lifecycleCopy.icon className={cn("w-5 h-5", lifecycleCopy.destructive ? "text-red-600" : "text-amber-700")} />
              </div>
              <DialogTitle className="text-base">{lifecycleCopy.title}</DialogTitle>
            </div>
          </DialogHeader>

          {lifecycleAction && (
            <>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-semibold text-slate-900">"{agentName || displayName}"</span>
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
              onClick={() => setLifecycleAction(null)}
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
    </div>
  );
}
