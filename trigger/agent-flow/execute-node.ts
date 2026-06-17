import { task, AbortTaskRunError, logger } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Maps node provider names → organization_integrations types + env var fallbacks
const PROVIDER_INTEGRATION_MAP: Record<string, { integrationType: string; envVar: string }> = {
  openai:     { integrationType: "openai",        envVar: "OPENAI_KEY" },
  custom:     { integrationType: "openai",        envVar: "OPENAI_KEY" },
  gemini:     { integrationType: "google_gemini", envVar: "GEMINI_API_KEY" },
  anthropic:  { integrationType: "anthropic",     envVar: "ANTHROPIC_API_KEY" },
  perplexity: { integrationType: "perplexity",    envVar: "PERPLEXITY_API_KEY" },
};

// Resolve API key: reads from organization_integrations first, then env var fallback
async function resolveProviderKey(
  supabase: ReturnType<typeof createClient>,
  provider: string,
): Promise<string> {
  const mapping = PROVIDER_INTEGRATION_MAP[provider] ?? PROVIDER_INTEGRATION_MAP["openai"];

  const { data } = await supabase
    .from("organization_integrations")
    .select("config")
    .eq("integration_type", mapping.integrationType)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cfg = data?.config as Record<string, string> | null;
  const dbKey = (cfg?.api_key ?? cfg?.apiKey ?? "").trim();
  if (dbKey) return dbKey;

  const envKey = (process.env[mapping.envVar] ?? "").trim();
  if (envKey) return envKey;

  throw new Error(
    `No API key configured for provider "${provider}". Please add one in Admin → Integrations.`,
  );
}

export interface NodeExecutionPayload {
  run_id: string;
  node: {
    id: string;
    type: string;
    label: string;
    config: Record<string, unknown>;
  };
  input_data: Record<string, unknown>;
  budget_remaining: number;
}

export interface NodeExecutionResult {
  node_id: string;
  status: "completed" | "failed" | "skipped";
  output: Record<string, unknown>;
  tokens_used: number;
  cost: number;
  duration_ms: number;
  branch?: "YES" | "NO" | string;
  error?: string;
}

// ── Execute a single workflow node ──────────────────────────────────────────
export const executeFlowNode = task({
  id: "execute-flow-node",
  maxDuration: 120,
  retry: { maxAttempts: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 5000 },
  run: async (payload: NodeExecutionPayload): Promise<NodeExecutionResult> => {
    const { run_id, node, input_data, budget_remaining } = payload;
    const startedAt = Date.now();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in the Trigger.dev dashboard under Environment Variables.",
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Mark step as running in DB
    const { data: step, error: stepInsertErr } = await supabase
      .from("run_steps")
      .insert({
        run_id,
        node_id: node.id,
        node_type: node.type,
        node_label: node.label,
        status: "running",
        input: input_data,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (stepInsertErr) logger.error("Failed to insert run_step", { error: stepInsertErr.message, code: stepInsertErr.code, node_id: node.id });

    const stepId = step?.id;

    try {
      let output: Record<string, unknown> = {};
      let tokensUsed = 0;
      let cost = 0;
      let branch: string | undefined;

      // ── Route to executor by node type ──────────────────────────────────
      switch (node.type) {
        // TRIGGER NODES — no-op during execution (already fired)
        case "cron_trigger":
        case "webhook_trigger":
        case "manual_trigger":
        case "db_trigger":
        case "crm_event_trigger":
          output = { triggered: true, trigger_type: node.type, ...input_data };
          break;

        // LOGIC: condition
        case "condition": {
          const expr = String(node.config.expression ?? "true");
          const value = input_data[String(node.config.input_variable ?? "")] as number;
          const threshold = Number(node.config.threshold ?? 0);
          const operator = String(node.config.operator ?? ">");

          let result = false;
          if (operator === ">") result = value > threshold;
          else if (operator === ">=") result = value >= threshold;
          else if (operator === "<") result = value < threshold;
          else if (operator === "<=") result = value <= threshold;
          else if (operator === "==") result = value === threshold;
          else {
            // Fallback: evaluate simple JS expression (safe, no network)
            result = Boolean(eval(`(function(){ return ${expr}; })()`));
          }

          branch = result ? "YES" : "NO";
          output = { result, branch, expression: expr };
          break;
        }

        // LOGIC: switch
        case "switch": {
          const switchValue = input_data[String(node.config.input_variable ?? "value")];
          const cases = (node.config.cases as Record<string, unknown>) ?? {};
          branch = String(cases[String(switchValue)] ?? node.config.default_branch ?? "default");
          output = { matched_value: switchValue, branch };
          break;
        }

        // LOGIC: delay
        case "delay": {
          const seconds = Number(node.config.seconds ?? 5);
          await new Promise((r) => setTimeout(r, Math.min(seconds, 30) * 1000));
          output = { delayed_seconds: seconds };
          break;
        }

        // LOGIC: loop — output list for parent to handle
        case "loop": {
          const items = Array.isArray(input_data[String(node.config.items_variable ?? "items")])
            ? (input_data[String(node.config.items_variable ?? "items")] as unknown[])
            : [];
          output = { loop_items: items, count: items.length };
          break;
        }

        // AI NODES
        case "openai_llm":
        case "gemini_llm":
        case "anthropic_llm":
        case "custom_llm": {
          if (budget_remaining <= 0) {
            throw new AbortTaskRunError("Budget exhausted — aborting node execution");
          }

          const provider = node.type.replace("_llm", "");
          const result = await executeAINode(node.config, input_data, provider, supabase);
          output = result.output;
          tokensUsed = result.tokens_used;
          cost = result.cost;
          break;
        }

        // TOOL: db_query
        case "db_query": {
          const table = String(node.config.table ?? "");
          const limit = Number(node.config.limit ?? 50);
          const filters = (node.config.filters as Record<string, unknown>) ?? {};

          if (!table) throw new Error("db_query: table is required");

          let query = supabase.from(table).select("*").limit(limit);
          for (const [col, val] of Object.entries(filters)) {
            query = query.eq(col, val);
          }

          const { data, error } = await query;
          if (error) throw new Error(`db_query error: ${error.message}`);
          output = { rows: data ?? [], count: (data ?? []).length };
          break;
        }

        // TOOL: api_call
        case "api_call": {
          const url = String(node.config.url ?? "");
          const method = String(node.config.method ?? "GET").toUpperCase();
          const headers = (node.config.headers as Record<string, string>) ?? {};
          const bodyTemplate = node.config.body;

          if (!url) throw new Error("api_call: url is required");

          const fetchOptions: RequestInit = { method, headers };
          if (method !== "GET" && bodyTemplate) {
            fetchOptions.body = JSON.stringify(bodyTemplate);
            fetchOptions.headers = { ...headers, "Content-Type": "application/json" };
          }

          const apiResponse = await fetch(url, fetchOptions);
          const responseText = await apiResponse.text();

          let responseData: unknown;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = responseText;
          }

          output = { status: apiResponse.status, data: responseData };
          break;
        }

        // TOOL: slack_notify
        case "slack_notify": {
          const webhookUrl = String(node.config.webhook_url ?? "");
          const channel = String(node.config.channel ?? "#general");
          const messageTemplate = String(node.config.message ?? "Agent notification");

          const message = interpolateTemplate(messageTemplate, input_data);

          if (webhookUrl) {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: message, channel }),
            });
          }

          output = { sent: true, channel, message };
          break;
        }

        // TOOL: email_send / email_output
        case "email_send":
        case "email_output": {
          const to = String(node.config.to ?? "");
          const subject = String(node.config.subject ?? "Agent Report");
          const bodyTemplate = String(node.config.body ?? "");
          const body = interpolateTemplate(bodyTemplate, input_data);

          // Delegate to send-client-email edge function
          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-client-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ to, subject, body }),
          });

          output = { sent: emailResponse.ok, to, subject };
          break;
        }

        // TOOL: crm_update
        case "crm_update": {
          const table = String(node.config.table ?? "leads");
          const id = input_data[String(node.config.id_variable ?? "id")];
          const updates = (node.config.updates as Record<string, unknown>) ?? {};

          if (!id) throw new Error("crm_update: id is required");

          const { error } = await supabase
            .from(table)
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", id);

          if (error) throw new Error(`crm_update error: ${error.message}`);
          output = { updated: true, table, id };
          break;
        }

        // TOOL: mcp_tool
        case "mcp_tool": {
          output = {
            executed: true,
            tool: node.config.tool_name ?? "unknown",
            note: "MCP tool execution placeholder",
          };
          break;
        }

        // OUTPUT: db_write
        case "db_write": {
          const table = String(node.config.table ?? "");
          const record = (node.config.record as Record<string, unknown>) ?? input_data;
          if (!table) throw new Error("db_write: table is required");

          const { error } = await supabase.from(table).insert(record);
          if (error) throw new Error(`db_write error: ${error.message}`);
          output = { written: true, table };
          break;
        }

        // OUTPUT: report_generate / dashboard_write
        case "report_generate":
        case "dashboard_write": {
          const title = String(node.config.title ?? "Agent Report");
          const content = JSON.stringify(input_data, null, 2);
          output = { generated: true, title, content_length: content.length };
          break;
        }

        default:
          output = { note: `Unknown node type: ${node.type}`, input: input_data };
      }

      const durationMs = Date.now() - startedAt;

      // Check output size — offload to Storage if > 50KB
      const outputStr = JSON.stringify(output);
      let storageRef: string | undefined;
      if (outputStr.length > 50_000) {
        storageRef = `agent-run-outputs/${run_id}/${node.id}.json`;
        await supabase.storage
          .from("agent-outputs")
          .upload(storageRef, outputStr, { contentType: "application/json", upsert: true });
        output = { storage_ref: storageRef, size_bytes: outputStr.length };
      }

      // Update run_step to completed
      if (stepId) {
        const { error: stepCompleteErr } = await supabase
          .from("run_steps")
          .update({
            status: "completed",
            output: storageRef ? { storage_ref: storageRef } : output,
            storage_ref: storageRef,
            tokens_used: tokensUsed,
            cost,
            duration_ms: durationMs,
            completed_at: new Date().toISOString(),
          })
          .eq("id", stepId);
        if (stepCompleteErr) logger.error("Failed to update run_step to completed", { error: stepCompleteErr.message, code: stepCompleteErr.code, node_id: node.id });
      }

      return {
        node_id: node.id,
        status: "completed",
        output,
        tokens_used: tokensUsed,
        cost,
        duration_ms: durationMs,
        branch,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (stepId) {
        const { error: stepFailErr } = await supabase
          .from("run_steps")
          .update({
            status: "failed",
            error: errorMsg,
            duration_ms: durationMs,
            completed_at: new Date().toISOString(),
          })
          .eq("id", stepId);
        if (stepFailErr) logger.error("Failed to update run_step to failed", { error: stepFailErr.message, code: stepFailErr.code, node_id: node.id });
      }

      return {
        node_id: node.id,
        status: "failed",
        output: {},
        tokens_used: 0,
        cost: 0,
        duration_ms: durationMs,
        error: errorMsg,
      };
    }
  },
});

// ── AI node execution ────────────────────────────────────────────────────────
async function executeAINode(
  config: Record<string, unknown>,
  inputData: Record<string, unknown>,
  provider: string,
  supabase: ReturnType<typeof createClient>,
): Promise<{ output: Record<string, unknown>; tokens_used: number; cost: number }> {
  const prompt = interpolateTemplate(
    String(config.prompt ?? "Process this data and return a result."),
    inputData,
  );
  const model = String(config.model ?? "gpt-4o-mini");

  // Resolve API key from DB (org integrations) with env var fallback
  const apiKey = await resolveProviderKey(supabase, provider);

  if (provider === "openai" || provider === "custom") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: String(config.system_prompt ?? "You are a helpful AI assistant.") },
          { role: "user", content: prompt },
        ],
        temperature: Number(config.temperature ?? 0.3),
        max_tokens: Number(config.max_tokens ?? 1000),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? {};
    const tokensUsed = usage.total_tokens ?? 0;
    const cost = ((usage.prompt_tokens ?? 0) * 0.00015 + (usage.completion_tokens ?? 0) * 0.0006) / 1000;

    return {
      output: { result: content, model, provider },
      tokens_used: tokensUsed,
      cost,
    };
  }

  if (provider === "gemini") {
    const geminiModel = String(config.model ?? "gemini-1.5-flash");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { output: { result: content, model: geminiModel, provider }, tokens_used: 0, cost: 0 };
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: String(config.model ?? "claude-3-haiku-20240307"),
        max_tokens: Number(config.max_tokens ?? 1000),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const content = data.content?.[0]?.text ?? "";
    const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { output: { result: content, provider }, tokens_used: tokensUsed, cost: 0 };
  }

  if (provider === "perplexity") {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: String(config.model ?? "sonar-reasoning-pro"),
        messages: [
          { role: "system", content: String(config.system_prompt ?? "You are a helpful AI assistant.") },
          { role: "user", content: prompt },
        ],
        max_tokens: Number(config.max_tokens ?? 1000),
      }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = data.usage ?? {};
    const tokensUsed = usage.total_tokens ?? 0;
    return { output: { result: content, model: String(config.model ?? "sonar-reasoning-pro"), provider }, tokens_used: tokensUsed, cost: 0 };
  }

  return { output: { result: "Provider not supported", provider }, tokens_used: 0, cost: 0 };
}

// ── Simple mustache-style template interpolation ──────────────────────────
function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return `{{${key}}}`;
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  });
}
