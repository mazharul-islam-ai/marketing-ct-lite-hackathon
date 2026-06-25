import type { RunStep } from "@/pages/adminpanel/agent-builder/types";

const LLM_STEP_TYPES = ["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"];

const FETCH_STEP_TYPES = [
  "db_query",
  "mcp_tool",
  "slack_fetch_messages",
  "gmail_fetch_unread",
  "api_call",
];

export function looksLikeEmptyDataReply(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("don't have information") ||
    lower.includes("do not have information") ||
    lower.includes("cannot provide") ||
    lower.includes("no data") ||
    lower.includes("no information")
  );
}

/** Tool-agnostic diagnostic hints when chat reply lacks expected data */
export function getChatDataDiagnostic(steps: RunStep[]): string | null {
  const fetchSteps = steps.filter((s) => FETCH_STEP_TYPES.includes(s.node_type));
  const llmStep = steps.find((s) => LLM_STEP_TYPES.includes(s.node_type));
  const llmInput = llmStep?.input as Record<string, unknown> | undefined;

  if (fetchSteps.length === 0 && steps.length <= 3) {
    return "No data-fetch steps ran. Recompile the agent so the chat path includes db_query, mcp_tool, or other fetch nodes — or redeploy Trigger.dev after runtime updates.";
  }

  for (const step of fetchSteps) {
    const output = step.output as Record<string, unknown> | undefined;
    if (step.status === "failed") {
      if (step.node_type === "mcp_tool") {
        return "MCP tool call failed. Check i420 Settings → MCP Servers (server active, tools synced).";
      }
      if (step.node_type === "db_query") {
        return "Database query failed. Enable the table in i420 Settings → Data Sources and verify RLS/data.";
      }
      if (step.node_type === "slack_fetch_messages") {
        return "Slack fetch failed. Invite the bot to the channel and verify the channel ID.";
      }
      if (step.node_type === "gmail_fetch_unread") {
        return "Gmail fetch failed. Verify Gmail integration is connected in Integrations Hub.";
      }
      return `Step "${step.node_label}" failed — check Logs for details.`;
    }

    if (step.node_type === "db_query") {
      const count = typeof output?.count === "number" ? output.count : 0;
      const rowCount = Array.isArray(llmInput?.rows) ? llmInput.rows.length : 0;
      if (count === 0 && rowCount === 0) {
        return "No rows returned from the database. Check that the table has data and data sources are enabled in i420 Settings.";
      }
    }

    if (step.node_type === "mcp_tool") {
      const executed = output?.executed === true;
      const hasResult = output?.result != null || output?.content != null;
      if (executed && !hasResult) {
        return "MCP tool ran but returned empty data. Verify tool arguments and Control Tower MCP connectivity.";
      }
    }

    if (step.node_type === "slack_fetch_messages") {
      const msgCount = Array.isArray(output?.messages) ? output.messages.length : 0;
      if (msgCount === 0) {
        return "Slack returned no messages. Check channel ID and bot membership.";
      }
    }

    if (step.node_type === "gmail_fetch_unread") {
      const emailCount = Array.isArray(output?.emails) ? output.emails.length : 0;
      if (emailCount === 0) {
        return "Gmail returned no unread emails.";
      }
    }
  }

  return null;
}
