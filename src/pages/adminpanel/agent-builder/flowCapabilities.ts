import type { FlowJSON } from "./types";

const LLM_NODE_TYPES = new Set([
  "openai_llm",
  "gemini_llm",
  "anthropic_llm",
  "custom_llm",
]);

export type ExecutionCapabilities = {
  hasChat: boolean;
  hasReport: boolean;
  isDualMode: boolean;
  isChatOnly: boolean;
  isReportOnly: boolean;
};

function isCronFlow(flow: FlowJSON): boolean {
  return flow.trigger?.type === "cron_trigger";
}

function hasLlmStep(flow: FlowJSON): boolean {
  return flow.steps.some((s) => LLM_NODE_TYPES.has(s.type));
}

function isManualTrigger(flow: FlowJSON): boolean {
  return !flow.trigger || flow.trigger.type === "manual_trigger";
}

function hasSwitchChatEdge(flow: FlowJSON): boolean {
  return (
    flow.steps.some((s) => s.type === "switch") &&
    flow.edges.some((e) => e.condition?.toLowerCase() === "chat")
  );
}

function computeHasReport(flow: FlowJSON): boolean {
  const hasReportEdge = flow.edges.some(
    (e) => e.condition?.toLowerCase() === "report",
  );
  const hasReportGenerate = flow.steps.some((s) => s.type === "report_generate");
  return hasReportEdge || hasReportGenerate || isCronFlow(flow);
}

function computeHasChat(flow: FlowJSON): boolean {
  if (flow.metadata?.supports_chat === true) return true;
  if (flow.metadata?.supports_chat === false) return false;

  if (isCronFlow(flow)) return false;

  if (hasSwitchChatEdge(flow)) return true;

  // Any manual LLM agent supports chat mode (unified Chat + Run model)
  return isManualTrigger(flow) && hasLlmStep(flow);
}

/**
 * Unified execution-mode detection — tool-agnostic.
 * Chat and Run share the same toolchain; mode is determined by flow topology + metadata.
 */
export function getExecutionCapabilities(
  flow: FlowJSON | null | undefined,
): ExecutionCapabilities {
  if (!flow) {
    return {
      hasChat: false,
      hasReport: false,
      isDualMode: false,
      isChatOnly: false,
      isReportOnly: false,
    };
  }

  const hasReport =
    flow.metadata?.supports_report === true ||
    (flow.metadata?.supports_report !== false && computeHasReport(flow));

  const hasChat = computeHasChat(flow);

  return {
    hasChat,
    hasReport,
    isDualMode: hasChat && hasReport,
    isChatOnly: hasChat && !hasReport,
    isReportOnly: hasReport && !hasChat,
  };
}

/** @deprecated Prefer getExecutionCapabilities — kept for existing callers */
export function getFlowCapabilities(flow: FlowJSON | null | undefined) {
  const caps = getExecutionCapabilities(flow);
  return { hasChat: caps.hasChat, hasReport: caps.hasReport };
}
