import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "../nodes/FlowNodeRenderer";
import type { FlowJSON, FlowNode, FlowEdge, NodeType } from "../types";
import { NODE_TYPE_DEFS } from "../types";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";

interface AgentFlowCanvasProps {
  flowJson: FlowJSON | null;
  onFlowChange: (flow: FlowJSON) => void;
  onNodeSelect: (node: FlowNode | null) => void;
  nodeRunStatuses?: Record<string, { status: string; cost?: number; tokens?: number; duration_ms?: number }>;
  currentNodeId?: string | null;
  isRunActive?: boolean;
}

// Convert FlowJSON → ReactFlow nodes+edges
function flowJsonToRF(flow: FlowJSON | null, nodeRunStatuses?: Record<string, { status: string }>): { nodes: Node[]; edges: Edge[] } {
  if (!flow) return { nodes: [], edges: [] };

  const allNodes: FlowNode[] = [
    ...(flow.trigger ? [flow.trigger] : []),
    ...flow.steps,
  ];

  const nodes: Node[] = allNodes.map((n) => ({
    id: n.id,
    type: n.type as string,
    position: n.position,
    data: {
      label: n.label,
      type: n.type,
      config: n.config,
      runStatus: nodeRunStatuses?.[n.id]?.status ?? "pending",
    },
    selectable: true,
    draggable: true,
  }));

  const edges: Edge[] = flow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.condition ?? e.label ?? "",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "#64748b", fontWeight: 600 },
    labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}

// Convert ReactFlow nodes+edges → FlowJSON
function rfToFlowJson(nodes: Node[], edges: Edge[]): FlowJSON {
  const allFlowNodes: FlowNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.data.type as NodeType,
    label: n.data.label as string,
    config: (n.data.config as Record<string, unknown>) ?? {},
    position: { x: n.position.x, y: n.position.y },
  }));

  const flowEdges: FlowEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: typeof e.label === "string" ? e.label : undefined,
    condition: typeof e.label === "string" ? e.label : undefined,
  }));

  const triggerTypes = NODE_TYPE_DEFS.filter((d) => d.category === "trigger").map((d) => d.type);
  const triggerNode = allFlowNodes.find((n) => triggerTypes.includes(n.type));
  const stepNodes = allFlowNodes.filter((n) => !triggerTypes.includes(n.type));

  return {
    trigger: triggerNode ?? null,
    steps: stepNodes,
    edges: flowEdges,
  };
}

export function AgentFlowCanvas({
  flowJson,
  onFlowChange,
  onNodeSelect,
  nodeRunStatuses,
  currentNodeId,
  isRunActive,
}: AgentFlowCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => flowJsonToRF(flowJson, nodeRunStatuses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when flowJson changes from outside (AI compile)
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = flowJsonToRF(flowJson, nodeRunStatuses);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [flowJson, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update node run status indicators
  useEffect(() => {
    if (!nodeRunStatuses) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          runStatus: nodeRunStatuses[n.id]?.status ?? n.data.runStatus ?? "pending",
          isCurrentNode: n.id === currentNodeId,
        },
      })),
    );
  }, [nodeRunStatuses, currentNodeId, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `e${connection.source}-${connection.target}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        animated: false,
      };
      setEdges((eds) => {
        const updated = addEdge(newEdge, eds);
        onFlowChange(rfToFlowJson(nodes, updated));
        return updated;
      });
    },
    [nodes, setEdges, onFlowChange],
  );

  const onNodeDragStop = useCallback(() => {
    onFlowChange(rfToFlowJson(nodes, edges));
  }, [nodes, edges, onFlowChange]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect({
        id: node.id,
        type: node.data.type as NodeType,
        label: node.data.label as string,
        config: (node.data.config as Record<string, unknown>) ?? {},
        position: node.position,
      });
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  if (!flowJson || (flowJson.steps.length === 0 && !flowJson.trigger)) {
    return (
      <div className={cn("flex-1 flex flex-col items-center justify-center select-none", ab.canvas, ab.textMuted)}>
        <div className="text-5xl mb-4 opacity-30">⬡</div>
        <p className="text-sm font-medium">Your flow canvas is empty</p>
        <p className="text-xs mt-1">Type a description in the chat to generate a flow, or drag nodes from the palette</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative">
      {/* Running shimmer overlay */}
      {isRunActive && (
        <>
          <div className="absolute inset-0 pointer-events-none z-10 bg-[hsl(18_52%_52%/0.03)] animate-pulse" />
          <div className="absolute top-0 inset-x-0 h-0.5 pointer-events-none z-10 bg-gradient-to-r from-transparent via-[hsl(18_52%_52%/0.5)] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
        </>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode="Delete"
        className="bg-[hsl(40_33%_97%)]"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(35, 15%, 82%)" />
        <Controls className="bg-[hsl(40_25%_99%)] border border-[hsl(35_15%_88%)] rounded-lg shadow-sm" />
        <MiniMap
          nodeColor={(n) => {
            const type = n.data?.type as string;
            if (type?.includes("trigger")) return "#d4a574";
            if (type?.includes("llm") || type?.includes("ai")) return "#c96442";
            if (type === "condition" || type === "switch") return "#9a8b7a";
            if (type?.includes("slack") || type?.includes("email") || type?.includes("notify")) return "#7a8f7a";
            return "#a89f94";
          }}
          className="bg-[hsl(40_25%_99%)] border border-[hsl(35_15%_88%)] rounded-lg"
          maskColor="rgba(250, 249, 246, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
