import type { FlowJSON, FlowNode, NodeCategory, NodeType } from "./types";
import { getCategoryDef, getNodeDef } from "./types";
import { isLlmNodeType } from "./extractFlowModels";

export interface FlowStepItem {
  id: string;
  label: string;
  type: NodeType;
  category: NodeCategory;
  icon: string;
  chipBg: string;
  chipText: string;
  modelSubtitle?: string;
  stepIndex: number;
}

export interface TruncatedFlowSteps {
  visible: FlowStepItem[];
  overflowCount: number;
  overflowLabels: string[];
}

const DEFAULT_CHIP_BG = "bg-[hsl(40_20%_96%)] border-[hsl(35_15%_88%)]";
const DEFAULT_CHIP_TEXT = "text-[hsl(30_6%_40%)]";

function truncateLabel(label: string, max = 12): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function modelFromNode(node: FlowNode): string | undefined {
  const raw = node.config?.model;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return undefined;
}

function stepFromNode(node: FlowNode, stepIndex: number): FlowStepItem {
  const def = getNodeDef(node.type);
  const category = def?.category ?? "tool";
  const categoryDef = getCategoryDef(category);
  const displayLabel = node.label?.trim() || def?.label || node.type;

  return {
    id: node.id,
    label: truncateLabel(displayLabel),
    type: node.type,
    category,
    icon: categoryDef?.icon ?? "⬜",
    chipBg: categoryDef?.bgColor ?? DEFAULT_CHIP_BG,
    chipText: categoryDef?.color ?? DEFAULT_CHIP_TEXT,
    modelSubtitle: isLlmNodeType(node.type) ? modelFromNode(node) : undefined,
    stepIndex,
  };
}

/** Flatten trigger + steps into ordered strip items. */
export function buildFlowSteps(flowJson: FlowJSON | null): FlowStepItem[] {
  if (!flowJson) return [];

  const nodes: FlowNode[] = [
    ...(flowJson.trigger ? [flowJson.trigger] : []),
    ...flowJson.steps,
  ];

  return nodes.map((node, index) => stepFromNode(node, index + 1));
}

export function truncateSteps(steps: FlowStepItem[], max = 4): TruncatedFlowSteps {
  if (steps.length <= max) {
    return { visible: steps, overflowCount: 0, overflowLabels: [] };
  }

  const visible = steps.slice(0, max);
  const hidden = steps.slice(max);

  return {
    visible,
    overflowCount: hidden.length,
    overflowLabels: hidden.map((s) => s.label),
  };
}

/** Full label for tooltip (not truncated). */
export function fullStepLabel(node: FlowNode): string {
  const def = getNodeDef(node.type);
  return node.label?.trim() || def?.label || node.type;
}
