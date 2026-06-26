import type { WorkflowSpec } from "./types";
import type { ConversationState } from "./conversation-state";
import { buildResolvedContextBlock } from "./conversation-state";

const WORKFLOW_SPEC_SCHEMA = `Return WorkflowSpec JSON:
{
  "workflow_type": "chat_agent" | "db_report" | "slack_digest" | "gmail_summary" | "hybrid" | "custom",
  "trigger": { "kind": "manual" | "cron" | "webhook", "schedule?": "cron expr", "timezone_label?": "..." },
  "modes": { "report": boolean, "chat": boolean },
  "integrations_required": string[],
  "data_sources": { "tables": string[], "excluded": boolean },
  "outputs": string[],
  "clarification_needed": boolean,
  "open_questions": string[],
  "user_message?": string
}

When user wants chat that queries database: workflow_type=chat_agent, modes={chat:true, report:false}, data_sources.tables includes relevant tables (e.g. clients), integrations_required should NOT include slack unless user asked for Slack.`;

const STRUCTURAL_RULES = `STRUCTURAL RULES:
1. trigger id n1; steps n2, n3...; steps and edges MUST be JSON arrays.
2. Chat-only agents: manual_trigger → fetch/tool (db_query etc.) → LLM (openai_llm/gemini_llm/anthropic_llm/custom_llm).
3. Do NOT use slack_fetch_messages as a chat UI substitute — chat runs via the agent card Chat button + LLM node.
4. Do NOT add Slack nodes for chat+database requests unless user explicitly asked for Slack.
5. db_query config.table MUST be one of the enabled tables listed.
6. Chat-path LLM config.prompt MUST include {{message}} and upstream data e.g. {{rows}}.
7. Maximum 20 nodes.
8. MCP list tools (list_okrs, list_*): use config.arguments: {} unless user provides explicit filter IDs. Never use {{template}} placeholders for integer filters.`;

const CHAT_DB_EXAMPLE = `CHAT + DB EXAMPLE (3 nodes):
manual_trigger (n1) → db_query table "clients" (n2) → openai_llm (n3)
LLM prompt: "User question: {{message}}\\n\\nData:\\n{{rows}}"`;

export function buildExtractIntentSystemPrompt(
  configured: string[],
  enabledTables: string[],
  resolvedContext?: string,
): string {
  const parts = [
    "Extract user intent into WorkflowSpec JSON for i420 workflow compiler.",
    WORKFLOW_SPEC_SCHEMA,
    `Toolchain integrations: ${configured.join(", ") || "none"}`,
    `Enabled database tables: ${enabledTables.join(", ") || "none"}`,
    "If user says chat + database/clients: set chat_agent, modes.chat=true, modes.report=false.",
  ];
  if (resolvedContext) parts.push(resolvedContext);
  return parts.join("\n\n");
}

export function buildPlanArchitectureSystemPrompt(
  spec: WorkflowSpec,
  allowedNodes: string[],
): string {
  const chatOnly = spec.modes?.chat && !spec.modes?.report;
  const parts = [
    "Plan FlowBlueprint JSON with trigger_node and branches.",
    `Allowed nodes: ${allowedNodes.join(", ")}`,
    `Workflow spec: ${JSON.stringify(spec)}`,
  ];
  if (chatOnly) {
    parts.push("Chat-only: single linear branch manual_trigger → db_query → LLM. No Slack branch.");
  }
  return parts.join("\n\n");
}

export function buildAssembleSystemPrompt(
  spec: WorkflowSpec,
  allowedNodes: string[],
  enabledTables: string[],
  conversationState?: ConversationState,
): string {
  const resolved = conversationState ? buildResolvedContextBlock(conversationState) : "";
  const chatOnly = spec.modes?.chat && !spec.modes?.report;

  const parts = [
    "Assemble flow_json for i420 Studio. Return { user_message, flow }.",
    STRUCTURAL_RULES,
    CHAT_DB_EXAMPLE,
    `Allowed nodes: ${allowedNodes.join(", ")}`,
    `Enabled tables: ${enabledTables.join(", ") || "none"}`,
    `Workflow spec: ${JSON.stringify(spec)}`,
  ];
  if (chatOnly) {
    parts.push(
      "This is CHAT-ONLY: build manual_trigger → db_query → LLM only. No slack_notify, slack_fetch_messages, or report_generate.",
      "For MCP list tools (list_okrs, list_*): use config.arguments: {} unless user provides explicit filter IDs.",
    );
  }
  if (resolved) parts.push(resolved);
  return parts.join("\n\n");
}

export function buildRepairSystemPrompt(
  validationError: string,
  allowedNodes: string[],
  spec?: WorkflowSpec,
): string {
  const parts = [
    "Fix workflow JSON to pass validation.",
    "CRITICAL: flow.steps and flow.edges MUST be JSON arrays, NOT objects.",
    'Return { "flow": { "trigger", "steps": [], "edges": [] } }',
    `Validation error: ${validationError}`,
    `Allowed nodes: ${allowedNodes.join(", ")}`,
  ];
  if (spec?.modes?.chat && !spec?.modes?.report) {
    parts.push("Chat-only: manual_trigger → db_query → LLM. Remove Slack nodes unless required.");
  }
  return parts.join("\n\n");
}
