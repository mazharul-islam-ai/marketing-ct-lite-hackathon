/**
 * Phase 6 — Intelligence Studio foundation
 *
 * Future `agentic_reasoning` node will run an observe → decide → act loop
 * using only configured integrations from organization_integrations.
 * See .agent/System/features/agent-builder-automations.md
 */
export const INTELLIGENCE_STUDIO_PHASE = 6 as const;

export const AGENTIC_RUNTIME_STATUSES = [
  "observing_data",
  "retrieving_tools",
  "deciding_action",
  "executing_tool",
] as const;

export type AgenticRuntimeStatus = typeof AGENTIC_RUNTIME_STATUSES[number];
