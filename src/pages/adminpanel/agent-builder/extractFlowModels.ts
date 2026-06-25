import type { FlowJSON, FlowNode, NodeType } from "./types";

export const LLM_NODE_TYPES: NodeType[] = [
  "openai_llm",
  "gemini_llm",
  "anthropic_llm",
  "custom_llm",
];

const PROVIDER_BY_TYPE: Partial<Record<NodeType, string>> = {
  openai_llm: "OpenAI",
  gemini_llm: "Gemini",
  anthropic_llm: "Claude",
  custom_llm: "Custom",
};

export interface FlowModelEntry {
  model: string;
  provider: string;
  nodeId: string;
  nodeLabel: string;
}

function isLlmNode(node: FlowNode): boolean {
  return LLM_NODE_TYPES.includes(node.type);
}

function modelFromNode(node: FlowNode): string | null {
  const raw = node.config?.model;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

/** Deduped LLM models used in a flow (trigger + steps). */
export function extractFlowModels(flowJson: FlowJSON | null): FlowModelEntry[] {
  if (!flowJson) return [];

  const allNodes: FlowNode[] = [
    ...(flowJson.trigger ? [flowJson.trigger] : []),
    ...flowJson.steps,
  ];

  const seen = new Set<string>();
  const result: FlowModelEntry[] = [];

  for (const node of allNodes) {
    if (!isLlmNode(node)) continue;
    const model = modelFromNode(node);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    result.push({
      model,
      provider: PROVIDER_BY_TYPE[node.type] ?? "AI",
      nodeId: node.id,
      nodeLabel: node.label,
    });
  }

  return result;
}

export function shortModelLabel(model: string, max = 14): string {
  if (model.length <= max) return model;
  return `${model.slice(0, max - 1)}…`;
}

export function isLlmNodeType(type: NodeType): boolean {
  return LLM_NODE_TYPES.includes(type);
}
