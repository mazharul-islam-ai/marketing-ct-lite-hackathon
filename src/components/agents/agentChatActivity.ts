import type { RunStep } from "@/pages/adminpanel/agent-builder/types";
import type { ChatActivityStep, ChatReference } from "./agentChatTypes";

export const LLM_STEP_TYPES = ["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"];

export const FETCH_STEP_TYPES = [
  "db_query",
  "mcp_tool",
  "slack_fetch_messages",
  "gmail_fetch_unread",
  "api_call",
];

const SKIP_ACTIVITY_TYPES = new Set(["manual_trigger", "switch"]);

function truncate(text: string, max = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function stringifyPreview(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return truncate(value);
  try {
    return truncate(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function getActivityLabel(nodeType: string): string | null {
  if (LLM_STEP_TYPES.includes(nodeType)) return "Thinking…";
  if (nodeType === "db_query") return "Searching database…";
  if (nodeType === "mcp_tool") return "Calling tool…";
  if (nodeType === "slack_fetch_messages") return "Fetching Slack messages…";
  if (nodeType === "gmail_fetch_unread") return "Checking Gmail…";
  if (nodeType === "api_call") return "Fetching data…";
  if (nodeType === "switch") return "Routing…";
  return null;
}

export function mapRunStepToActivity(step: RunStep): ChatActivityStep | null {
  if (SKIP_ACTIVITY_TYPES.has(step.node_type)) return null;

  const label = getActivityLabel(step.node_type);
  if (!label) return null;

  const input = step.input as Record<string, unknown> | undefined;
  let detail = step.node_label ?? undefined;

  if (step.node_type === "mcp_tool") {
    detail = String(input?.tool ?? input?.tool_name ?? step.node_label ?? "MCP tool");
  } else if (step.node_type === "db_query") {
    detail = String(input?.table ?? step.node_label ?? "database");
  } else if (step.node_type === "api_call") {
    const method = input?.method ?? "GET";
    const url = input?.url ?? step.node_label;
    detail = url ? `${method} ${url}` : String(step.node_label ?? "API");
  }

  return {
    id: step.id,
    label,
    detail,
    status: step.status,
    nodeType: step.node_type,
  };
}

export function mapRunStepsToActivity(steps: RunStep[]): ChatActivityStep[] {
  return steps
    .map(mapRunStepToActivity)
    .filter((s): s is ChatActivityStep => s != null);
}

export function extractReferencesFromSteps(steps: RunStep[]): ChatReference[] {
  const refs: ChatReference[] = [];

  for (const step of steps) {
    if (step.status !== "completed") continue;

    const input = step.input as Record<string, unknown> | undefined;
    const output = step.output as Record<string, unknown> | undefined;

    if (step.node_type === "db_query") {
      const table = String(input?.table ?? step.node_label ?? "Database");
      const count =
        typeof output?.count === "number"
          ? output.count
          : Array.isArray(output?.rows)
            ? output.rows.length
            : undefined;
      refs.push({
        id: step.id,
        title: `Database · ${table}`,
        meta: count != null ? `${count} row${count === 1 ? "" : "s"}` : undefined,
        snippet: stringifyPreview(output?.rows ?? output?.sample),
      });
    } else if (step.node_type === "mcp_tool") {
      const tool = String(input?.tool ?? input?.tool_name ?? output?.tool ?? "MCP tool");
      refs.push({
        id: step.id,
        title: `Control Tower MCP · ${tool}`,
        meta: output?.executed === true ? "Executed" : undefined,
        snippet: stringifyPreview(output?.result ?? output?.content ?? output?.data),
      });
    } else if (step.node_type === "slack_fetch_messages") {
      const channel = String(input?.channel ?? input?.channel_id ?? "Slack");
      const msgCount = Array.isArray(output?.messages) ? output.messages.length : undefined;
      refs.push({
        id: step.id,
        title: `Slack · ${channel}`,
        meta: msgCount != null ? `${msgCount} message${msgCount === 1 ? "" : "s"}` : undefined,
        snippet: stringifyPreview(output?.messages?.[0]),
      });
    } else if (step.node_type === "gmail_fetch_unread") {
      const emailCount = Array.isArray(output?.emails) ? output.emails.length : undefined;
      refs.push({
        id: step.id,
        title: "Gmail · Unread",
        meta: emailCount != null ? `${emailCount} email${emailCount === 1 ? "" : "s"}` : undefined,
        snippet: stringifyPreview(output?.emails?.[0]),
      });
    } else if (step.node_type === "api_call") {
      const method = String(input?.method ?? "GET");
      const url = String(input?.url ?? step.node_label ?? "API");
      refs.push({
        id: step.id,
        title: `API · ${method} ${url}`,
        snippet: stringifyPreview(output?.body ?? output?.data ?? output?.response),
      });
    }

    if (refs.length >= 5) break;
  }

  return refs;
}
