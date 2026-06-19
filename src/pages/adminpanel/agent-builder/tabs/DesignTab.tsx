import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { AgentFlowCanvas } from "../panels/AgentFlowCanvas";
import { BuilderChat } from "../panels/BuilderChat";
import { NodeInspector } from "../panels/NodeInspector";
import { useBuilderSession } from "../hooks/useBuilderSession";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowJSON, FlowNode } from "../types";
import { ab } from "../agentBuilderTheme";

interface DesignTabProps {
  agentId: string | null;
  agentName: string;
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
}

export function DesignTab({
  agentId,
  agentName,
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
}: DesignTabProps) {
  const [flowJson, setFlowJson] = useState<FlowJSON | null>(initialFlowJson);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
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
      setSelectedNode(null);
    },
    [flowJson, onFlowChange],
  );

  function toggleLeft() {
    if (leftCollapsed) {
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }

  return (
    <div className="h-full overflow-hidden relative">
      <PanelGroup direction="horizontal" className="h-full">
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
              className={cn("flex-1 flex flex-col items-center gap-3 py-4 border-r cursor-pointer transition-colors bg-[hsl(250_28%_96%)] border-[hsl(250_18%_90%)] hover:bg-[hsl(250_25%_94%)]", ab.borderSoft)}
              onClick={toggleLeft}
              title="Expand chat panel"
            >
              <Sparkles className={cn("w-4 h-4", ab.accentText)} />
              <div className="flex-1 flex items-center">
                <span
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  AI Chat
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
                className={cn("absolute top-1/2 -translate-y-1/2 right-0 z-10 w-5 h-10 flex items-center justify-center rounded-r transition-colors shadow-sm border", ab.surfaceElevated, ab.textMuted, "hover:text-[hsl(248_45%_42%)]")}
                title="Collapse chat panel"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </>
          )}
        </Panel>

        <PanelResizeHandle className="relative w-1 bg-transparent hover:bg-[hsl(248_45%_70%/0.15)] active:bg-[hsl(248_45%_70%/0.25)] transition-colors cursor-col-resize group">
          <div className="absolute inset-y-0 left-0 w-px bg-[hsl(250_18%_90%)] group-hover:bg-[hsl(248_45%_70%/0.5)] transition-colors" />
        </PanelResizeHandle>

        <Panel defaultSize={78} minSize={30} className="flex flex-col overflow-hidden min-w-0">
          <AgentFlowCanvas
            flowJson={flowJson}
            onFlowChange={handleCanvasFlowChange}
            onNodeSelect={setSelectedNode}
            nodeRunStatuses={nodeRunStatuses}
            currentNodeId={currentNodeId}
          />
        </Panel>
      </PanelGroup>

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
    </div>
  );
}
