import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { AgentFlowCanvas } from "../panels/AgentFlowCanvas";
import { BuilderChat } from "../panels/BuilderChat";
import { NodeInspector } from "../panels/NodeInspector";
import { NodeEditTabs } from "../panels/NodeEditTabs";
import { AgentCard } from "../panels/AgentCard";
import { AutomationCard } from "../panels/AutomationCard";
import { StudioWelcomeCanvas } from "../panels/StudioWelcomeCanvas";
import { CanvasToolbar, type CanvasViewMode } from "../panels/CanvasToolbar";
import { useBuilderSession } from "../hooks/useBuilderSession";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowJSON, FlowNode, AgentRun } from "../types";
import { ab } from "../agentBuilderTheme";
import { I420 } from "../i420Brand";
import { CanvasBackground } from "../three/CanvasBackground";
import { FlowPreviewSceneLayer } from "../three/FlowPreviewSceneLayer";
import { extractCronFromFlow } from "@/lib/automationSchedule";

interface DesignTabProps {
  agentId: string | null;
  agentName: string;
  agentDescription?: string | null;
  agentStatus?: "draft" | "published" | "archived";
  initialFlowJson: FlowJSON | null;
  onFlowChange: (flow: FlowJSON) => void;
  nodeRunStatuses?: Record<string, { status: string; cost?: number; tokens?: number }>;
  currentNodeId?: string | null;
  onAgentCreated?: (newAgentId: string, name: string) => void;
  onCompileComplete?: (versionId: string, version: number) => void;
  onVersionUpdated?: (versionId: string, version: number) => void;
  onCompilingChange?: (isCompiling: boolean) => void;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
  // Run state (passed from Studio)
  currentRun?: AgentRun | null;
  isRunActive?: boolean;
  isTriggering?: boolean;
  canRun?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  versionNumber?: number;
}

export function DesignTab({
  agentId,
  agentName,
  agentDescription,
  agentStatus = "draft",
  initialFlowJson,
  onFlowChange,
  nodeRunStatuses,
  currentNodeId,
  onAgentCreated,
  onCompileComplete,
  onVersionUpdated,
  onCompilingChange,
  initialPrompt,
  onInitialPromptConsumed,
  currentRun = null,
  isRunActive = false,
  isTriggering = false,
  canRun = false,
  onRun,
  onStop,
  versionNumber,
}: DesignTabProps) {
  const [flowJson, setFlowJson] = useState<FlowJSON | null>(initialFlowJson);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>("card");
  const [cardEditOpen, setCardEditOpen] = useState(false);

  const firedInitialPromptRef = useRef(false);
  const sendPromptRef = useRef<(prompt: string, action?: "generate" | "improve" | "add_tool") => Promise<FlowJSON | null>>(async () => null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  const handleFlowUpdate = useCallback(
    (newFlow: FlowJSON) => {
      setFlowJson(newFlow);
      onFlowChange(newFlow);
    },
    [onFlowChange],
  );

  const { chatHistory, isCompiling, compileStatus, error, sendPrompt, clearError } = useBuilderSession(
    agentId,
    handleFlowUpdate,
    {
      onAgentCreated,
      onCompileComplete,
      onVersionUpdated,
    },
  );

  sendPromptRef.current = sendPrompt;

  useEffect(() => {
    onCompilingChange?.(isCompiling);
  }, [isCompiling, onCompilingChange]);

  useEffect(() => {
    if (initialFlowJson) {
      setFlowJson(initialFlowJson);
    }
  }, [initialFlowJson]);

  useEffect(() => {
    if (!initialPrompt || firedInitialPromptRef.current) return;

    const lastUser = [...chatHistory].reverse().find((m) => m.role === "user");
    if (lastUser?.content === initialPrompt) {
      firedInitialPromptRef.current = true;
      onInitialPromptConsumed?.();
      return;
    }

    firedInitialPromptRef.current = true;
    onInitialPromptConsumed?.();
    sendPromptRef.current(initialPrompt, "generate");
  }, [initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCanvasFlowChange = useCallback(
    (updated: FlowJSON) => {
      setFlowJson(updated);
      onFlowChange(updated);
    },
    [onFlowChange],
  );

  const handleNodeSave = useCallback(
    (nodeId: string, updates: { label?: string; config?: Record<string, unknown> }) => {
      if (!flowJson) return;
      const updateNode = (n: FlowNode): FlowNode =>
        n.id === nodeId ? { ...n, ...updates } : n;
      const updated: FlowJSON = {
        ...flowJson,
        trigger: flowJson.trigger ? updateNode(flowJson.trigger) : null,
        steps: flowJson.steps.map(updateNode),
      };
      setFlowJson(updated);
      onFlowChange(updated);
      // Only clear selectedNode in flow mode (card mode saves without closing)
      if (canvasViewMode === "flow") setSelectedNode(null);
    },
    [flowJson, onFlowChange, canvasViewMode],
  );

  useEffect(() => {
    if (canvasViewMode === "flow") {
      setCardEditOpen(false);
    }
  }, [canvasViewMode]);

  const handleCanvasViewModeChange = useCallback((mode: CanvasViewMode) => {
    setCanvasViewMode(mode);
  }, []);

  const handleCardEditToggle = useCallback(() => {
    setCardEditOpen((open) => !open);
  }, []);

  const handleCardEditClose = useCallback(() => {
    setCardEditOpen(false);
  }, []);

  function toggleLeft() {
    if (leftCollapsed) {
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }

  // Determine if this is an automation (has cron trigger)
  const isAutomation = flowJson?.trigger?.type === "cron_trigger" ||
    !!(extractCronFromFlow(flowJson));

  const handleRun = () => onRun?.();
  const handleStop = () => onStop?.();

  const isEmptyStudio =
    !flowJson?.trigger &&
    (flowJson?.steps?.length ?? 0) === 0 &&
    chatHistory.length === 0 &&
    !isCompiling;

  const handleExampleClick = useCallback(
    (prompt: string) => {
      void sendPrompt(prompt, "generate");
    },
    [sendPrompt],
  );

  return (
    <div className="h-full min-h-0 overflow-hidden relative flex flex-col">
      <PanelGroup direction="horizontal" className="h-full min-h-0 flex-1">
        {/* ── Left: AI Chat ──────────────────────────────────────────────── */}
        <Panel
          ref={leftPanelRef}
          defaultSize={22}
          minSize={12}
          collapsible
          collapsedSize={3}
          onCollapse={() => setLeftCollapsed(true)}
          onExpand={() => setLeftCollapsed(false)}
          className="relative flex flex-col overflow-hidden"
        >
          {leftCollapsed ? (
            <div
              className={cn(
                "flex-1 flex flex-col items-center gap-3 py-4 border-r cursor-pointer transition-colors bg-[hsl(40_25%_99%)] border-[hsl(35_15%_88%)] hover:bg-[hsl(40_20%_96%)]",
                ab.borderSoft,
              )}
              onClick={toggleLeft}
              title="Expand chat panel"
            >
              <Sparkles className={cn("w-4 h-4", ab.accentText)} />
              <div className="flex-1 flex items-center">
                <span
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {I420.name}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          ) : (
            <>
              <BuilderChat
                chatHistory={chatHistory}
                isCompiling={isCompiling}
                compileStatus={compileStatus}
                error={error}
                onClearError={clearError}
                onSendPrompt={sendPrompt}
                agentName={agentName}
              />
              <button
                onClick={toggleLeft}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 right-0 z-10 w-5 h-10 flex items-center justify-center rounded-r transition-colors shadow-sm border",
                  ab.surfaceElevated, ab.textMuted, "hover:text-[hsl(18_45%_38%)]",
                )}
                title="Collapse chat panel"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </>
          )}
        </Panel>

        <PanelResizeHandle className="relative w-1 bg-transparent hover:bg-[hsl(18_52%_52%/0.12)] active:bg-[hsl(18_52%_52%/0.2)] transition-colors cursor-col-resize group">
          <div className="absolute inset-y-0 left-0 w-px bg-[hsl(35_15%_88%)] group-hover:bg-[hsl(18_52%_52%/0.4)] transition-colors" />
        </PanelResizeHandle>

        {/* ── Right: Canvas ───────────────────────────────────────────────── */}
        <Panel defaultSize={78} minSize={30} className="flex flex-col overflow-hidden min-w-0">
          {/* View toggle toolbar */}
          <CanvasToolbar
            mode={canvasViewMode}
            onModeChange={handleCanvasViewModeChange}
            isRunActive={isRunActive}
          />

          {/* Canvas content */}
          <div className={cn("flex-1 overflow-hidden relative", ab.canvas)}>
            <CanvasBackground
              variant="studio"
              running={isRunActive}
              className="absolute inset-0 z-0"
            />
            {canvasViewMode === "card" ? (
              /* ── Card view ───────────────────────────────────────────── */
              <div className="absolute inset-0 overflow-auto h-full z-[1]">
                {isRunActive && (
                  <div className="absolute inset-0 pointer-events-none bg-[hsl(18_52%_52%/0.02)] animate-pulse" />
                )}
                <div className="h-full min-h-0 flex flex-col">
                  {isEmptyStudio ? (
                    <StudioWelcomeCanvas onExampleClick={handleExampleClick} />
                  ) : (
                    <div className="flex flex-col items-center justify-start pt-6 pb-8 px-8 min-h-full">
                      {isAutomation ? (
                        <AutomationCard
                          agentName={agentName}
                          agentDescription={agentDescription}
                          agentStatus={agentStatus}
                          flowJson={flowJson}
                          currentRun={currentRun}
                          isRunActive={isRunActive}
                          isTriggering={isTriggering}
                          canRun={canRun}
                          isEditOpen={cardEditOpen}
                          onEditToggle={handleCardEditToggle}
                          onRun={handleRun}
                          onStop={handleStop}
                          versionNumber={versionNumber}
                        />
                      ) : (
                        <AgentCard
                          agentName={agentName}
                          agentDescription={agentDescription}
                          agentStatus={agentStatus}
                          flowJson={flowJson}
                          currentRun={currentRun}
                          isRunActive={isRunActive}
                          isTriggering={isTriggering}
                          canRun={canRun}
                          isEditOpen={cardEditOpen}
                          onEditToggle={handleCardEditToggle}
                          onRun={handleRun}
                          onStop={handleStop}
                          versionNumber={versionNumber}
                        />
                      )}

                      {/* Workflow 3D preview — below card with visual separation */}
                      {flowJson && (flowJson.trigger || flowJson.steps.length > 0) && (
                        <div className="mt-5 w-full max-w-[520px] space-y-1.5">
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest text-center select-none">
                            Workflow
                          </p>
                          <FlowPreviewSceneLayer
                            flowJson={flowJson}
                            variant={isAutomation ? "automation" : "agent"}
                            isRunActive={isRunActive}
                            className="h-24"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Flow view ───────────────────────────────────────────── */
              <div className="absolute inset-0 z-[1]">
                <AgentFlowCanvas
                flowJson={flowJson}
                onFlowChange={handleCanvasFlowChange}
                onNodeSelect={setSelectedNode}
                nodeRunStatuses={nodeRunStatuses}
                currentNodeId={currentNodeId}
                isRunActive={isRunActive}
              />
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* Card edit slide-in — right drawer in card mode */}
      {canvasViewMode === "card" && (
        <>
          {cardEditOpen && (
            <div
              className="absolute inset-0 z-10"
              onClick={handleCardEditClose}
            />
          )}
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-96 z-20 shadow-2xl border-l",
              ab.surfaceElevated,
              "transition-transform duration-200 ease-in-out",
              cardEditOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            {flowJson && cardEditOpen && (
              <NodeEditTabs
                flowJson={flowJson}
                onNodeSave={handleNodeSave}
                onClose={handleCardEditClose}
              />
            )}
          </div>
        </>
      )}

      {/* Node inspector slide-in — only active in flow mode */}
      {canvasViewMode === "flow" && (
        <>
          {selectedNode && (
            <div
              className="absolute inset-0 z-10"
              onClick={() => setSelectedNode(null)}
            />
          )}
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-80 z-20 shadow-2xl",
              "transition-transform duration-200 ease-in-out",
              selectedNode ? "translate-x-0" : "translate-x-full",
            )}
          >
            <NodeInspector
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onSave={handleNodeSave}
              runOutput={
                selectedNode && nodeRunStatuses?.[selectedNode.id]
                  ? ({ status: nodeRunStatuses[selectedNode.id].status } as Record<string, unknown>)
                  : undefined
              }
              runStatus={selectedNode ? nodeRunStatuses?.[selectedNode.id]?.status : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
