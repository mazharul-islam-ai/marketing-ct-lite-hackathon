import type {
  CompileArtifacts,
  CompileTask,
  FlowBlueprint,
  FlowJSON,
  PipelinePayload,
  StageResult,
  WorkflowSpec,
} from "./types";
import { getServiceClient, logPlatformUsage, mergeJobArtifacts } from "./supabase";
import { callLlmJson, resolveCompilerApiKey } from "./llm";

function toolchainSummary(configured: string[], tables: string[]): string {
  return `Integrations: ${configured.join(", ") || "none"}\nTables: ${tables.join(", ") || "none"}`;
}

export async function runExtractIntent(payload: PipelinePayload): Promise<StageResult<WorkflowSpec>> {
  const supabase = getServiceClient();
  const llm = await resolveCompilerApiKey(supabase);

  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("integration_type")
    .eq("is_active", true);
  const configured = (integrations ?? []).map((r: { integration_type: string }) => r.integration_type);

  const { data: ds } = await supabase
    .from("organization_integrations")
    .select("config")
    .eq("integration_type", "agent_builder_data_sources")
    .eq("is_active", true)
    .maybeSingle();
  const tables = (ds?.config as { enabled_tables?: string[] })?.enabled_tables ?? [];

  const system = `Extract WorkflowSpec JSON from user request. Toolchain:\n${toolchainSummary(configured, tables)}`;
  const { result, usage } = await callLlmJson<WorkflowSpec>(
    llm.provider, llm.model, llm.apiKey, system, payload.prompt,
  );

  await logPlatformUsage({
    user_id: payload.user_id,
    agent_id: payload.agent_id,
    provider: llm.provider,
    model: llm.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    stage: "i420-compile-multi-01-extract-intent",
    compile_job_id: payload.compile_job_id,
  });

  await mergeJobArtifacts(payload.compile_job_id, { spec: result });

  if (result.clarification_needed) {
    return { ok: false, clarification: result.user_message ?? result.open_questions[0] ?? "Could you clarify?" };
  }
  return { ok: true, data: result, usage };
}

export async function runPlanArchitecture(
  payload: PipelinePayload,
  spec: WorkflowSpec,
  allowedNodes: string[],
): Promise<StageResult<FlowBlueprint>> {
  const supabase = getServiceClient();
  const llm = await resolveCompilerApiKey(supabase);
  const system = `Plan FlowBlueprint JSON. Allowed nodes: ${allowedNodes.join(", ")}`;
  const { result, usage } = await callLlmJson<FlowBlueprint>(
    llm.provider, llm.model, llm.apiKey, system, JSON.stringify(spec, null, 2),
  );

  await logPlatformUsage({
    user_id: payload.user_id,
    agent_id: payload.agent_id,
    provider: llm.provider,
    model: llm.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    stage: "i420-compile-multi-02-plan-architecture",
    compile_job_id: payload.compile_job_id,
  });

  await mergeJobArtifacts(payload.compile_job_id, { blueprint: result });
  return { ok: true, data: result, usage };
}

export async function runDecomposeTasks(
  payload: PipelinePayload,
  blueprint: FlowBlueprint,
): Promise<StageResult<CompileTask[]>> {
  const supabase = getServiceClient();
  const llm = await resolveCompilerApiKey(supabase);
  const system = "Decompose blueprint into CompileTask[] JSON array.";
  const { result, usage } = await callLlmJson<CompileTask[] | { tasks: CompileTask[] }>(
    llm.provider, llm.model, llm.apiKey, system, JSON.stringify(blueprint, null, 2),
  );

  const tasks = Array.isArray(result) ? result : (result as { tasks: CompileTask[] }).tasks ?? [];

  await logPlatformUsage({
    user_id: payload.user_id,
    agent_id: payload.agent_id,
    provider: llm.provider,
    model: llm.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    stage: "i420-compile-multi-03-decompose-tasks",
    compile_job_id: payload.compile_job_id,
  });

  await mergeJobArtifacts(payload.compile_job_id, { tasks });
  return { ok: true, data: tasks, usage };
}

export async function runAssembleFlow(
  payload: PipelinePayload,
  blueprint: FlowBlueprint,
  tasks: CompileTask[],
  allowedNodes: string[],
  currentFlow: FlowJSON | null,
): Promise<StageResult<{ flow: FlowJSON; user_message: string }>> {
  const supabase = getServiceClient();
  const llm = await resolveCompilerApiKey(supabase);
  const system = `Assemble flow_json. Allowed: ${allowedNodes.join(", ")}. Return { user_message, flow }`;
  const userContent = JSON.stringify({
    blueprint,
    tasks,
    current_flow: currentFlow,
    prompt: payload.prompt,
    action: payload.action,
  });
  const { result, usage } = await callLlmJson<{ flow: FlowJSON; user_message: string }>(
    llm.provider, llm.model, llm.apiKey, system, userContent,
  );

  await logPlatformUsage({
    user_id: payload.user_id,
    agent_id: payload.agent_id,
    provider: llm.provider,
    model: llm.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    stage: "i420-compile-multi-04-assemble-flow",
    compile_job_id: payload.compile_job_id,
  });

  return { ok: true, data: result, usage };
}

export function runValidateFlow(flow: FlowJSON, allowedNodes: string[]): StageResult<FlowJSON> {
  if (!flow || typeof flow !== "object") {
    return { ok: false, error: "Flow must be an object" };
  }
  if (!Array.isArray(flow.steps)) return { ok: false, error: "steps must be an array" };
  if (!Array.isArray(flow.edges)) return { ok: false, error: "edges must be an array" };

  const allNodes = [...(flow.trigger ? [flow.trigger] : []), ...flow.steps];
  if (allNodes.length > 20) return { ok: false, error: "Flow exceeds maximum of 20 nodes" };

  const allowed = new Set(allowedNodes);
  for (const node of allNodes) {
    const type = String(node.type ?? "");
    if (!allowed.has(type)) {
      return { ok: false, error: `Node type "${type}" is not allowed` };
    }
    if (!node.id || !node.label) {
      return { ok: false, error: "Node missing id or label" };
    }
  }

  const nodeIds = new Set(allNodes.map((n) => String(n.id)));
  for (const edge of flow.edges) {
    if (!nodeIds.has(String(edge.source)) || !nodeIds.has(String(edge.target))) {
      return { ok: false, error: `Edge references unknown node: ${edge.source} → ${edge.target}` };
    }
  }

  return { ok: true, data: flow };
}

export async function runRepairFlow(
  payload: PipelinePayload,
  blueprint: FlowBlueprint,
  flow: FlowJSON,
  validationError: string,
): Promise<StageResult<FlowJSON>> {
  const supabase = getServiceClient();
  const llm = await resolveCompilerApiKey(supabase);
  const system = `Fix workflow JSON. Error: ${validationError}. Return { flow: {...} }`;
  const { result, usage } = await callLlmJson<{ flow: FlowJSON }>(
    llm.provider, llm.model, llm.apiKey, system, JSON.stringify({ blueprint, flow }),
  );

  await logPlatformUsage({
    user_id: payload.user_id,
    agent_id: payload.agent_id,
    provider: llm.provider,
    model: llm.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    stage: "i420-compile-multi-06-repair-flow",
    compile_job_id: payload.compile_job_id,
  });

  return { ok: true, data: result.flow, usage };
}

export async function loadPipelineContext(payload: PipelinePayload) {
  const supabase = getServiceClient();
  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("integration_type")
    .eq("is_active", true);
  const configured = new Set((integrations ?? []).map((r: { integration_type: string }) => r.integration_type));

  const ALWAYS = [
    "cron_trigger", "webhook_trigger", "manual_trigger", "db_trigger", "crm_event_trigger",
    "condition", "switch", "loop", "delay", "custom_llm", "db_query", "db_write",
    "dashboard_write", "report_generate",
  ];
  const allowed = new Set<string>(ALWAYS);
  if (configured.has("openai")) allowed.add("openai_llm");
  if (configured.has("google_gemini")) allowed.add("gemini_llm");
  if (configured.has("anthropic")) allowed.add("anthropic_llm");
  if (configured.has("slack")) { allowed.add("slack_notify"); allowed.add("slack_fetch_messages"); }
  if (configured.has("gmail")) allowed.add("gmail_fetch_unread");
  if (configured.has("sendgrid") || configured.has("resend")) {
    allowed.add("email_send"); allowed.add("email_output");
  }
  allowed.add("mcp_tool");
  allowed.add("api_call");

  const { data: agent } = await supabase
    .from("agents")
    .select("current_version_id")
    .eq("id", payload.agent_id)
    .single();

  let currentFlow: FlowJSON | null = null;
  if (agent?.current_version_id) {
    const { data: version } = await supabase
      .from("agent_versions")
      .select("flow_json")
      .eq("id", agent.current_version_id)
      .single();
    currentFlow = (version?.flow_json as FlowJSON) ?? null;
  }

  const { data: job } = await supabase
    .from("compile_jobs")
    .select("compile_artifacts")
    .eq("id", payload.compile_job_id)
    .single();

  return {
    supabase,
    allowedNodes: [...allowed],
    currentFlow,
    artifacts: (job?.compile_artifacts ?? {}) as CompileArtifacts,
  };
}

export async function saveCompiledVersion(
  payload: PipelinePayload,
  flow: FlowJSON,
  userMessage: string,
  artifacts: CompileArtifacts,
) {
  const supabase = getServiceClient();

  const nextVersion = await supabase
    .rpc("next_agent_version", { p_agent_id: payload.agent_id })
    .then((r) => r.data ?? 1);

  const { data: newVersion, error } = await supabase
    .from("agent_versions")
    .insert({
      agent_id: payload.agent_id,
      version: nextVersion,
      flow_json: flow,
      compile_artifacts: artifacts,
      published_by: payload.user_id,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("agents")
    .update({ current_version_id: newVersion.id, updated_at: new Date().toISOString() })
    .eq("id", payload.agent_id);

  const { data: session } = await supabase
    .from("builder_sessions")
    .select("chat_history")
    .eq("agent_id", payload.agent_id)
    .eq("user_id", payload.user_id)
    .maybeSingle();

  const chatHistory = [
  ...(session?.chat_history ?? []),
  { role: "user", content: payload.prompt },
  { role: "assistant", content: userMessage, message_type: "success" },
  ];

  await supabase.from("builder_sessions").upsert({
    agent_id: payload.agent_id,
    user_id: payload.user_id,
    chat_history: chatHistory.slice(-50),
    compile_artifacts: artifacts,
    last_active: new Date().toISOString(),
  }, { onConflict: "agent_id,user_id" });

  return { version_id: newVersion.id as string, version: nextVersion as number };
}
