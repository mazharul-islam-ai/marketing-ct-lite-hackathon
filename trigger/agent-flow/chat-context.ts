import { logger } from "@trigger.dev/sdk";
import type { createClient } from "@supabase/supabase-js";

export const LLM_NODE_TYPES = new Set([
  "openai_llm",
  "gemini_llm",
  "anthropic_llm",
  "custom_llm",
]);

export const CHAT_LLM_PROMPT = "User question: {{message}}\n\nData:\n{{rows}}";
export const CHAT_LLM_SYSTEM =
  "Answer the user question using the provided data JSON. Be concise and helpful. When data rows are provided, use them directly — do not say you lack information.";

export interface DbQueryNodeConfig {
  table?: string;
  limit?: number;
  filters?: Record<string, unknown>;
  order_by?: string;
  order_asc?: boolean;
}

interface FlowNodeLike {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

/** Cap rows for chat prompts to avoid token overflow */
export function compactRowsForChat(rows: unknown[], message: string): unknown[] {
  if (!rows.length) return rows;
  const msg = message.toLowerCase();
  if (/\bfirst\b/.test(msg)) return rows.slice(0, 1);
  return rows.slice(0, 10);
}

/** Set template aliases: clients, data, records, first_client, message variants */
export function applyRowAliases(ctx: Record<string, unknown>): Record<string, unknown> {
  const message = String(ctx.message ?? ctx.user_message ?? ctx.chat_message ?? "");

  if (!ctx.message) {
    ctx.message = message;
  }

  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  const compact = compactRowsForChat(rows, message);

  const result: Record<string, unknown> = {
    ...ctx,
    message,
    user_message: message,
    chat_message: message,
    rows: compact,
    count: compact.length,
    clients: compact,
    data: compact,
    records: compact,
  };

  if (compact.length > 0) {
    result.first_row = compact[0];
    result.first_client = compact[0];
  }

  return result;
}

/** Normalize message aliases and resolve rows from execution context */
export function enrichLlmContext(
  inputData: Record<string, unknown>,
): Record<string, unknown> {
  const ctx = { ...inputData };

  if (!ctx.message) {
    ctx.message = ctx.user_message ?? ctx.chat_message ?? "";
  }

  if (!Array.isArray(ctx.rows) || ctx.rows.length === 0) {
    for (const val of Object.values(ctx)) {
      if (
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Array.isArray((val as Record<string, unknown>).rows)
      ) {
        ctx.rows = (val as Record<string, unknown>).rows;
        if ((val as Record<string, unknown>).count != null) {
          ctx.count = (val as Record<string, unknown>).count;
        }
        break;
      }
    }
  }

  if (!Array.isArray(ctx.rows) || ctx.rows.length === 0) {
    for (const [key, val] of Object.entries(ctx)) {
      if (
        key.endsWith("_output") &&
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Array.isArray((val as Record<string, unknown>).rows)
      ) {
        ctx.rows = (val as Record<string, unknown>).rows;
        if ((val as Record<string, unknown>).count != null) {
          ctx.count = (val as Record<string, unknown>).count;
        }
        break;
      }
    }
  }

  // Slack fetch outputs { messages, count, channel } — wire for LLM {{messages}} templates
  if (!Array.isArray(ctx.messages) || ctx.messages.length === 0) {
    for (const val of Object.values(ctx)) {
      if (
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Array.isArray((val as Record<string, unknown>).messages)
      ) {
        ctx.messages = (val as Record<string, unknown>).messages;
        if ((val as Record<string, unknown>).count != null) {
          ctx.message_count = (val as Record<string, unknown>).count;
        }
        if ((val as Record<string, unknown>).channel != null) {
          ctx.channel = (val as Record<string, unknown>).channel;
        }
        break;
      }
    }
  }

  if (!Array.isArray(ctx.messages) || ctx.messages.length === 0) {
    for (const [key, val] of Object.entries(ctx)) {
      if (
        key.endsWith("_output") &&
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        Array.isArray((val as Record<string, unknown>).messages)
      ) {
        ctx.messages = (val as Record<string, unknown>).messages;
        if ((val as Record<string, unknown>).count != null) {
          ctx.message_count = (val as Record<string, unknown>).count;
        }
        if ((val as Record<string, unknown>).channel != null) {
          ctx.channel = (val as Record<string, unknown>).channel;
        }
        break;
      }
    }
  }

  return applyRowAliases(ctx);
}

/** Run a Supabase SELECT (shared by db_query node and chat prefetch) */
export async function runDbQuery(
  supabase: ReturnType<typeof createClient>,
  config: DbQueryNodeConfig,
): Promise<{ rows: unknown[]; count: number }> {
  const table = String(config.table ?? "");
  const limit = Number(config.limit ?? 50);
  const filters = config.filters ?? {};
  let orderBy = String(config.order_by ?? "");
  const orderAsc = config.order_asc !== false;

  if (!orderBy && table === "clients") {
    orderBy = "created_at";
  }

  if (!table) return { rows: [], count: 0 };

  let query = supabase.from(table).select("*");
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  if (orderBy) {
    query = query.order(orderBy, { ascending: orderAsc });
  }
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`db_query error: ${error.message}`);

  const rows = data ?? [];
  return { rows, count: rows.length };
}

/** Run a db_query using node config (for chat auto-prefetch) */
export async function prefetchDbRows(
  supabase: ReturnType<typeof createClient>,
  config: DbQueryNodeConfig,
): Promise<{ rows: unknown[]; count: number }> {
  return runDbQuery(supabase, config);
}

/** Ensure chat-mode LLM nodes have message + rows before execution */
export async function ensureChatContext(
  ctx: Record<string, unknown>,
  flowSteps: FlowNodeLike[],
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  let enriched = enrichLlmContext(ctx);

  if (enriched.mode !== "chat") return enriched;

  if (Array.isArray(enriched.rows) && enriched.rows.length > 0) {
    return applyRowAliases(enriched);
  }

  const dbNode = flowSteps.find((s) => s.type === "db_query");
  if (!dbNode) {
    logger.warn("ensureChatContext: no db_query node in flow for chat prefetch");
    return enriched;
  }

  try {
    const { rows, count } = await runDbQuery(
      supabase,
      dbNode.config as DbQueryNodeConfig,
    );
    logger.info("ensureChatContext: prefetched rows for chat", {
      count,
      table: (dbNode.config as DbQueryNodeConfig).table,
    });
    enriched = applyRowAliases({
      ...enriched,
      rows,
      count,
      chat_prefetch: true,
    });
    return enriched;
  } catch (err) {
    logger.warn("ensureChatContext: prefetch failed", {
      error: err instanceof Error ? err.message : String(err),
      table: (dbNode.config as DbQueryNodeConfig).table,
    });
    return enriched;
  }
}

/** Append recent chat_history to the user prompt when present */
export function buildLlmUserPrompt(
  template: string,
  ctx: Record<string, unknown>,
): string {
  let prompt = template;

  const history = ctx.chat_history;
  if (Array.isArray(history) && history.length > 0) {
    const lines = history
      .slice(-10)
      .map((m) => {
        const entry = m as { role?: string; content?: string };
        const role = entry.role === "assistant" ? "Assistant" : "User";
        return `${role}: ${entry.content ?? ""}`;
      })
      .join("\n");
    prompt = `Conversation history:\n${lines}\n\n${prompt}`;
  }

  return prompt;
}

/** Append Slack/email payload when the template omits standard placeholders. */
export function ensureDataInLlmPrompt(
  template: string,
  ctx: Record<string, unknown>,
): string {
  const hasPlaceholder = /\{\{(messages|rows|data|records|emails)\}\}/.test(template);
  if (hasPlaceholder) return template;

  const messages = Array.isArray(ctx.messages) ? ctx.messages : [];
  if (messages.length > 0) {
    return `${template}\n\nSlack messages (JSON):\n${JSON.stringify(messages, null, 2)}`;
  }

  const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
  if (rows.length > 0) {
    return `${template}\n\nData rows (JSON):\n${JSON.stringify(rows, null, 2)}`;
  }

  const emails = Array.isArray(ctx.emails) ? ctx.emails : [];
  if (emails.length > 0) {
    return `${template}\n\nEmails (JSON):\n${JSON.stringify(emails, null, 2)}`;
  }

  return template;
}
