import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function updateJobStage(jobId: string, stageId: string) {
  const supabase = getServiceClient();
  await supabase
    .from("compile_jobs")
    .update({ current_stage: stageId, status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function mergeJobArtifacts(jobId: string, patch: Record<string, unknown>) {
  const supabase = getServiceClient();
  const { data } = await supabase.from("compile_jobs").select("compile_artifacts").eq("id", jobId).single();
  const merged = { ...(data?.compile_artifacts as object ?? {}), ...patch, updated_at: new Date().toISOString() };
  await supabase.from("compile_jobs").update({ compile_artifacts: merged }).eq("id", jobId);
  return merged;
}

export async function logPlatformUsage(params: {
  user_id: string
  agent_id: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  stage: string
  compile_job_id: string
}) {
  const supabase = getServiceClient();
  const total = params.promptTokens + params.completionTokens;
  try {
    await supabase.from("i420_platform_usage").insert({
      user_id: params.user_id,
      agent_id: params.agent_id,
      source: "compile",
      action: "multi_stage",
      provider: params.provider,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: total,
      cost_usd: 0,
      metadata: { compiler: "multi", stage: params.stage, compile_job_id: params.compile_job_id },
    });
  } catch {
    // non-fatal
  }
}
