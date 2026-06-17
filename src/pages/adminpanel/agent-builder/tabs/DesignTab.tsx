import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { AgentFlowCanvas } from "../panels/AgentFlowCanvas";
import { BuilderChat } from "../panels/BuilderChat";
import { NodeInspector } from "../panels/NodeInspector";
import { useBuilderSession } from "../hooks/useBuilderSession";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowJSON, FlowNode } from "../types";

interface DesignTabProps {
  agentId: string | null;
  agentName: string;
  initialFlowJson: FlowJSON | null;
  onFlowChange: (flow: FlowJSON) => void;
  nodeRunStatuses?: Record<string, { status: string; cost?: number; tokens?: number }>;
  currentNodeId?: string | null;
  onAgentCreated?: (newAgentId: string, name: string) => void;
  initialPrompt?: string;
}

export function DesignTab({
  agentId,
  agentName,
  initialFlowJson,
  onFlowChange,
  nodeRunStatuses,
  currentNodeId,
  onAgentCreated,
  initialPrompt,
}: DesignTabProps) {
  const [flowJson, setFlowJson] = useState<FlowJSON | null>(initialFlowJson);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const firedInitialPromptRef = useRef(false);

  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  const handleFlowUpdate = useCallback(
    (newFlow: FlowJSON) => {
      setFlowJson(newFlow);
      onFlowChange(newFlow);
    },
    [onFlowChange],
  );

  const { chatHistory, isCompiling, sendPrompt } = useBuilderSession(
    agentId,
    handleFlowUpdate,
    onAgentCreated,
  );

  // Sync canvas when parent loads flow from DB or compile resolves after a remount
  useEffect(() => {
    if (initialFlowJson) {
      setFlowJson(initialFlowJson);
    }
  }, [initialFlowJson]);

  useEffect(() => {
    if (initialPrompt && !firedInitialPromptRef.current) {
      firedInitialPromptRef.current = true;
      sendPrompt(initialPrompt, "generate");
    }
  }, [initialPrompt, sendPrompt]);

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
        {/* ── Left panel (BuilderChat) ── */}
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
            /* Collapsed left icon rail */
            <div
              className="flex-1 flex flex-col items-center gap-3 py-4 bg-slate-900 border-r border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={toggleLeft}
              title="Expand chat panel"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <div className="flex-1 flex items-center">
                <span
                  className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  AI Chat
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          ) : (
            <>
              <BuilderChat
                chatHistory={chatHistory}
                isCompiling={isCompiling}
                onSendPrompt={sendPrompt}
                agentName={agentName}
              />
              {/* Collapse toggle — right edge of left panel */}
              <button
                onClick={toggleLeft}
                className="absolute top-1/2 -translate-y-1/2 right-0 z-10 w-5 h-10 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-r text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-md"
                title="Collapse chat panel"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </>
          )}
        </Panel>

        {/* Resize handle between left and center */}
        <PanelResizeHandle className="relative w-1 bg-transparent hover:bg-violet-500/30 active:bg-violet-500/50 transition-colors cursor-col-resize group">
          <div className="absolute inset-y-0 left-0 w-px bg-slate-700/40 group-hover:bg-violet-400 transition-colors" />
        </PanelResizeHandle>

        {/* ── Centre (Canvas) — takes all remaining space ── */}
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

      {/* ── Node Inspector slide-in drawer ── */}
      {/* Backdrop: closes drawer when clicking outside */}
      {selectedNode && (
        <div
          className="absolute inset-0 z-10"
          onClick={() => setSelectedNode(null)}
        />
      )}

      {/* Drawer panel */}
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
