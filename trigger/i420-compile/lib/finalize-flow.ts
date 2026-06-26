import type { FlowJSON, WorkflowSpec } from "./types";
import type { ConversationState } from "./conversation-state";
import { isChatDbOnlyIntent, userExcludedIntegration } from "./conversation-state";
import { normalizeFlowJSON } from "./normalize-flow";

const LLM_NODE_TYPES = new Set(["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"]);
const SLACK_TYPES = new Set(["slack_notify", "slack_fetch_messages"]);
const GMAIL_TYPES = new Set(["gmail_fetch_unread"]);

const CHAT_LLM_PROMPT = "User question: {{message}}\n\nData:\n{{rows}}";
const CHAT_LLM_SYSTEM =
  "Answer the user question using the provided context JSON. Be concise and helpful. Do not ask the user to supply data that is already in the context.";

export interface FinalizeContext {
  spec: WorkflowSpec;
  enabledTables: string[];
  allowedNodes: string[];
  conversationState: ConversationState;
  configuredIntegrations: Set<string>;
}

export function pickPreferredLlmType(configured: Set<string>, allowedNodes: string[]): string {
  const order = [
    { integration: "openai", type: "openai_llm" },
    { integration: "google_gemini", type: "gemini_llm" },
    { integration: "anthropic", type: "anthropic_llm" },
  ];
  for (const { integration, type } of order) {
    if (configured.has(integration) && allowedNodes.includes(type)) return type;
  }
  if (allowedNodes.includes("custom_llm")) return "custom_llm";
  return "openai_llm";
}

export function validateDbQueryTables(
  flow: FlowJSON,
  enabledTables: string[],
): { valid: boolean; error?: string } {
  const allNodes = [...(flow.trigger ? [flow.trigger] : []), ...flow.steps];
  const dbNodes = allNodes.filter((n) => n.type === "db_query");
  if (dbNodes.length === 0) return { valid: true };
  if (enabledTables.length === 0) {
    return { valid: false, error: "db_query requires enabled data sources in Settings." };
  }
  const enabledSet = new Set(enabledTables);
  for (const node of dbNodes) {
    const table = String((node.config as Record<string, unknown>)?.table ?? "").trim();
    if (!table) return { valid: false, error: "db_query node missing config.table" };
    if (!enabledSet.has(table)) {
      return { valid: false, error: `db_query table "${table}" is not enabled. Enabled: ${enabledTables.join(", ")}` };
    }
  }
  return { valid: true };
}

export function stampFlowExecutionMetadata(flow: FlowJSON): FlowJSON {
  const isCron = flow.trigger?.type === "cron_trigger";
  const isManual = !flow.trigger || flow.trigger.type === "manual_trigger";
  const hasLlm = flow.steps.some((s) => LLM_NODE_TYPES.has(String(s.type)));
  const hasSwitchChat =
    flow.steps.some((s) => s.type === "switch") &&
    flow.edges.some((e) => String(e.condition ?? "").toLowerCase() === "chat");
  const hasReportEdge = flow.edges.some((e) => String(e.condition ?? "").toLowerCase() === "report");
  const hasReportGenerate = flow.steps.some((s) => s.type === "report_generate");
  const supportsReport = hasReportEdge || hasReportGenerate || !!isCron;
  const supportsChat = !isCron && (hasSwitchChat || (isManual && hasLlm));

  return {
    ...flow,
    metadata: {
      supports_chat: supportsChat,
      supports_report: supportsReport,
    },
  };
}

function shouldStripSlack(spec: WorkflowSpec, state: ConversationState): boolean {
  if (userExcludedIntegration(state, "slack")) return true;
  const chatOnly = spec.modes?.chat && !spec.modes?.report;
  const slackRequired = spec.integrations_required?.some((i) => /slack/i.test(i));
  if (chatOnly && !slackRequired && (isChatDbOnlyIntent(state) || spec.workflow_type === "chat_agent")) {
    return true;
  }
  return false;
}

function shouldStripGmail(spec: WorkflowSpec, state: ConversationState): boolean {
  if (userExcludedIntegration(state, "gmail")) return true;
  const chatOnly = spec.modes?.chat && !spec.modes?.report;
  return chatOnly && spec.workflow_type === "chat_agent";
}

export function enforceChatDbAgentShape(
  flow: FlowJSON,
  spec: WorkflowSpec,
  llmType: string,
  enabledTables: string[],
  conversationState?: ConversationState,
): FlowJSON {
  const chatOnly = spec.modes?.chat && !spec.modes?.report;
  if (!chatOnly && spec.workflow_type !== "chat_agent") return flow;

  let steps = [...flow.steps];
  let edges = [...flow.edges];
  let trigger = flow.trigger;

  const state: ConversationState = conversationState ?? {
    workflowHints: [],
    workflowHint: null,
    resolvedParams: {},
    userExclusions: [],
  };
  if (spec.workflow_type === "chat_agent" && !state.workflowHints.includes("chat")) {
    state.workflowHints.push("chat");
  }
  if (spec.data_sources?.tables?.length && !state.workflowHints.includes("db")) {
    state.workflowHints.push("db");
  }

  const stripTypes = new Set<string>();
  if (shouldStripSlack(spec, state)) SLACK_TYPES.forEach((t) => stripTypes.add(t));
  if (shouldStripGmail(spec, state)) GMAIL_TYPES.forEach((t) => stripTypes.add(t));

  if (stripTypes.size > 0) {
    const removed = new Set(steps.filter((s) => stripTypes.has(String(s.type))).map((s) => String(s.id)));
    steps = steps.filter((s) => !stripTypes.has(String(s.type)));
    edges = edges.filter((e) => !removed.has(String(e.source)) && !removed.has(String(e.target)));
  }

  const hasLlm = steps.some((s) => LLM_NODE_TYPES.has(String(s.type)));
  const hasDb = steps.some((s) => s.type === "db_query");
  const needsRebuild = chatOnly && (!hasLlm || !hasDb || stripTypes.size > 0);

  if (needsRebuild) {
    const table = spec.data_sources?.tables?.[0]
      ?? enabledTables.find((t) => /client/i.test(t))
      ?? enabledTables[0]
      ?? "clients";

    trigger = {
      id: "n1",
      type: "manual_trigger",
      label: "Start",
      config: {},
      position: { x: 0, y: 200 },
    };
    steps = [
      {
        id: "n2",
        type: "db_query",
        label: `Query ${table}`,
        config: { table, limit: 50 },
        position: { x: 220, y: 200 },
      },
      {
        id: "n3",
        type: llmType,
        label: "Chat response",
        config: {
          prompt: CHAT_LLM_PROMPT,
          system_prompt: CHAT_LLM_SYSTEM,
        },
        position: { x: 440, y: 200 },
      },
    ];
    edges = [
      { id: "e1", source: "n1", target: "n2", condition: "" },
      { id: "e2", source: "n2", target: "n3", condition: "" },
    ];
  } else if (hasLlm) {
    steps = steps.map((step) => {
      if (!LLM_NODE_TYPES.has(String(step.type))) return step;
      const config = { ...(step.config as Record<string, unknown> ?? {}) };
      const prompt = String(config.prompt ?? "");
      if (!prompt.includes("{{message}}")) config.prompt = CHAT_LLM_PROMPT;
      const system = String(config.system_prompt ?? "");
      if (!system || system.length < 30) config.system_prompt = CHAT_LLM_SYSTEM;
      return { ...step, config };
    });
  }

  return { ...flow, trigger, steps, edges };
}

export function buildFlowSummaryMessage(flow: FlowJSON): string {
  const nodeCount = flow.steps.length + (flow.trigger ? 1 : 0);
  const parts = [`Built a ${nodeCount}-node flow on the canvas.`];
  const tools = flow.steps.filter((s) =>
    ["db_query", "openai_llm", "gemini_llm", "anthropic_llm", "custom_llm", "slack_notify"].includes(String(s.type)),
  );
  if (tools.length) {
    parts.push(`Steps: ${tools.map((t) => t.label ?? t.type).join(" → ")}.`);
  }
  parts.push("Click Run or Chat to test, or tell me what to change.");
  return parts.join(" ");
}

export function finalizeCompiledFlow(flow: FlowJSON, ctx: FinalizeContext): FlowJSON {
  let result = normalizeFlowJSON(flow);
  const llmType = pickPreferredLlmType(ctx.configuredIntegrations, ctx.allowedNodes);
  result = enforceChatDbAgentShape(result, ctx.spec, llmType, ctx.enabledTables, ctx.conversationState);
  result = normalizeFlowJSON(result);
  result = stampFlowExecutionMetadata(result);
  return result;
}

export function validateChatAgentRules(
  flow: FlowJSON,
  spec?: WorkflowSpec,
): { valid: boolean; error?: string } {
  if (!spec?.modes?.chat || spec.modes.report) return { valid: true };

  const hasLlm = flow.steps.some((s) => LLM_NODE_TYPES.has(String(s.type)));
  if (!hasLlm) {
    return { valid: false, error: "Chat-only agent must include an LLM node (openai_llm, custom_llm, etc.)" };
  }

  const hasSlackFetch = flow.steps.some((s) => s.type === "slack_fetch_messages");
  if (hasSlackFetch && spec.workflow_type === "chat_agent") {
    return { valid: false, error: "Chat agents must not use slack_fetch_messages as chat input — use LLM node instead" };
  }

  return { valid: true };
}
