import type { FlowJSON } from "./types";

export function getFlowCapabilities(flow: FlowJSON | null | undefined) {
  if (!flow) {
    return { hasChat: false, hasReport: false };
  }

  const hasSwitchChat =
    flow.steps.some((s) => s.type === "switch") &&
    flow.edges.some((e) => e.condition?.toLowerCase() === "chat");

  const hasReport =
    flow.edges.some((e) => e.condition?.toLowerCase() === "report") ||
    flow.steps.some((s) => s.type === "report_generate");

  return { hasChat: hasSwitchChat, hasReport };
}
