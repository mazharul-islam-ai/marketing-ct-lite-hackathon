import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { CompileArtifacts, FlowJSON } from './types.ts'
import { STAGE_TO_PHASE } from './types.ts'

export async function createCompileJob(
  supabase: ReturnType<typeof createClient>,
  params: {
    agent_id: string
    user_id: string
    prompt: string
    action?: string
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('compile_jobs')
    .insert({
      agent_id: params.agent_id,
      user_id: params.user_id,
      prompt: params.prompt,
      action: params.action ?? 'generate',
      status: 'queued',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateCompileJobStage(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  stageId: string,
): Promise<void> {
  await supabase
    .from('compile_jobs')
    .update({
      current_stage: stageId,
      status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function mergeCompileJobArtifacts(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  patch: Partial<CompileArtifacts>,
): Promise<CompileArtifacts> {
  const { data } = await supabase
    .from('compile_jobs')
    .select('compile_artifacts')
    .eq('id', jobId)
    .single()

  const merged = {
    ...((data?.compile_artifacts ?? {}) as CompileArtifacts),
    ...patch,
    updated_at: new Date().toISOString(),
  }

  await supabase
    .from('compile_jobs')
    .update({ compile_artifacts: merged, updated_at: new Date().toISOString() })
    .eq('id', jobId)

  return merged
}

export async function completeCompileJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  result: {
    success: boolean
    flow_json?: FlowJSON
    user_message?: string
    version_id?: string
    version_number?: number
    compile_artifacts?: CompileArtifacts
    error_message?: string
    status?: 'completed' | 'failed' | 'clarification'
  },
): Promise<void> {
  await supabase
    .from('compile_jobs')
    .update({
      status: result.status ?? (result.success ? 'completed' : 'failed'),
      flow_json: result.flow_json ?? null,
      user_message: result.user_message ?? null,
      version_id: result.version_id ?? null,
      version_number: result.version_number ?? null,
      compile_artifacts: result.compile_artifacts ?? {},
      error_message: result.error_message ?? null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export function stageIdToPhase(stageId: string): string | undefined {
  return STAGE_TO_PHASE[stageId]
}

export async function persistSessionArtifacts(
  supabase: ReturnType<typeof createClient>,
  agent_id: string,
  user_id: string,
  artifacts: CompileArtifacts,
  chatHistory: Array<{ role: string; content: string }>,
): Promise<void> {
  await supabase
    .from('builder_sessions')
    .upsert({
      agent_id,
      user_id,
      chat_history: chatHistory.slice(-50),
      compile_artifacts: artifacts,
      last_active: new Date().toISOString(),
    }, { onConflict: 'agent_id,user_id' })
}
