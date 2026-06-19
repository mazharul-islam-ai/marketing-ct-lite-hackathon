import type { createClient } from "@supabase/supabase-js";

export const LLM_NODE_TYPES = new Set([
  "openai_llm",
  "gemini_llm",
  "anthropic_llm",
  "custom_llm",
]);

interface DbQueryNodeConfig {
  table?: string;
  limit?: number;
  filters?: Record<string, unknown>;
}

interface FlowNodeLike {
  id: string;
  type: string;
  config: Record<string, unknown>;
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

  return ctx;
}

/** Run a db_query using node config (for chat auto-prefetch) */
export async function prefetchDbRows(
  supabase: ReturnType<typeof createClient>,
  config: DbQueryNodeConfig,
): Promise<{ rows: unknown[]; count: number }> {
  const table = String(config.table ?? "");
  const limit = Number(config.limit ?? 50);
  const filters = config.filters ?? {};

  if (!table) return { rows: [], count: 0 };

  let query = supabase.from(table).select("*").limit(limit);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }

  const { data, error } = await query;
  if (error) throw new Error(`chat prefetch db_query error: ${error.message}`);

  const rows = data ?? [];
  return { rows, count: rows.length };
}

/** Ensure chat-mode LLM nodes have message + rows before execution */
export async function ensureChatContext(
  ctx: Record<string, unknown>,
  flowSteps: FlowNodeLike[],
  supabase: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  const enriched = enrichLlmContext(ctx);

  if (enriched.mode !== "chat") return enriched;
  if (Array.isArray(enriched.rows) && enriched.rows.length > 0) return enriched;

  const dbNode = flowSteps.find((s) => s.type === "db_query");
  if (!dbNode) return enriched;

  try {
    const { rows, count } = await prefetchDbRows(
      supabase,
      dbNode.config as DbQueryNodeConfig,
    );
    return { ...enriched, rows, count };
  } catch {
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
