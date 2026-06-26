import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { COMPILE_PHASES, STAGE_TO_PHASE } from '../_shared/agent-builder-integrations.ts'
import { createCompileJob } from '../_shared/compiler/job-store.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const TRIGGER_SECRET_KEY = Deno.env.get('TRIGGER_SECRET_KEY') ?? ''
const TRIGGER_COMPILE_URL = 'https://api.trigger.dev/api/v3/tasks/i420-compile-multi-run/trigger'

function stageToLabel(stageId: string | null): string {
  if (!stageId) return COMPILE_PHASES.thinking
  const phase = STAGE_TO_PHASE[stageId]
  if (phase && phase in COMPILE_PHASES) {
    return COMPILE_PHASES[phase as keyof typeof COMPILE_PHASES]
  }
  return COMPILE_PHASES.thinking
}

async function pollCompileJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  emit: (phase: string, label: string) => void,
  maxMs = 300_000,
): Promise<Record<string, unknown>> {
  const start = Date.now()
  let lastStage: string | null = null

  while (Date.now() - start < maxMs) {
    const { data: job } = await supabase
      .from('compile_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (!job) throw new Error('Compile job not found')

    if (job.current_stage !== lastStage) {
      lastStage = job.current_stage
      const phase = job.current_stage
        ? (STAGE_TO_PHASE[job.current_stage] ?? 'thinking')
        : 'thinking'
      emit(phase, stageToLabel(job.current_stage))
    }

    if (job.status === 'completed') {
      emit('saving_version', COMPILE_PHASES.saving_version)
      return {
        success: true,
        flow_json: job.flow_json,
        version_id: job.version_id,
        version: job.version_number,
        user_message: job.user_message,
        ai_message: job.user_message,
        compile_job_id: jobId,
        compiler: { mode: 'multi_stage' },
      }
    }

    if (job.status === 'clarification') {
      return {
        success: false,
        needs_clarification: true,
        question: job.user_message,
        user_message: job.user_message,
        message_type: 'clarification',
        compile_job_id: jobId,
      }
    }

    if (job.status === 'failed') {
      return {
        success: false,
        message: job.error_message ?? 'Compile failed',
        compile_job_id: jobId,
      }
    }

    await new Promise((r) => setTimeout(r, 1500))
  }

  throw new Error('Compile timed out waiting for multi-stage pipeline')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json() as {
      prompt: string
      agent_id: string
      action?: string
      stream?: boolean
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!body.prompt || !body.agent_id) {
      return new Response(JSON.stringify({ error: 'prompt and agent_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const jobId = await createCompileJob(supabase, {
      agent_id: body.agent_id,
      user_id: user.id,
      prompt: body.prompt,
      action: body.action,
    })

    if (!TRIGGER_SECRET_KEY) {
      return new Response(JSON.stringify({
        error: 'TRIGGER_SECRET_KEY not configured — cannot run multi-stage compiler',
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const triggerRes = await fetch(TRIGGER_COMPILE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TRIGGER_SECRET_KEY}`,
      },
      body: JSON.stringify({
        payload: {
          compile_job_id: jobId,
          agent_id: body.agent_id,
          user_id: user.id,
          prompt: body.prompt,
          action: body.action ?? 'generate',
        },
      }),
    })

    if (!triggerRes.ok) {
      const errText = await triggerRes.text()
      await supabase.from('compile_jobs').update({
        status: 'failed',
        error_message: errText,
      }).eq('id', jobId)
      throw new Error(`Trigger.dev error: ${errText}`)
    }

    const runCompile = async (emit: (phase: string, label: string) => void) => {
      emit('checking_provider', COMPILE_PHASES.checking_provider)
      emit('loading_integrations', COMPILE_PHASES.loading_integrations)
      emit('loading_context', COMPILE_PHASES.loading_context)
      emit('extracting_intent', COMPILE_PHASES.extracting_intent)

      const result = await pollCompileJob(supabase, jobId, emit)

      if (result.success && result.flow_json) {
        const { data: session } = await supabase
          .from('builder_sessions')
          .select('chat_history')
          .eq('agent_id', body.agent_id)
          .eq('user_id', user.id)
          .maybeSingle()

        const chatHistory = [
          ...(session?.chat_history ?? []),
          { role: 'user', content: body.prompt },
          {
            role: 'assistant',
            content: String(result.user_message ?? 'Flow updated.'),
            message_type: 'success',
          },
        ]
        return { ...result, chat_history: chatHistory.slice(-50) }
      }

      if (result.needs_clarification) {
        const { data: session } = await supabase
          .from('builder_sessions')
          .select('chat_history')
          .eq('agent_id', body.agent_id)
          .eq('user_id', user.id)
          .maybeSingle()
        const chatHistory = [
          ...(session?.chat_history ?? []),
          { role: 'user', content: body.prompt },
          {
            role: 'assistant',
            content: String(result.question),
            message_type: 'clarification',
          },
        ]
        await supabase.from('builder_sessions').upsert({
          agent_id: body.agent_id,
          user_id: user.id,
          chat_history: chatHistory.slice(-50),
          last_active: new Date().toISOString(),
        }, { onConflict: 'agent_id,user_id' })
        return { ...result, chat_history: chatHistory.slice(-50) }
      }

      return result
    }

    if (body.stream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (phase: string, label: string) => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'status', phase, label })}\n\n`,
            ))
          }
          try {
            const result = await runCompile(emit)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', ...result })}\n\n`))
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'result',
              success: false,
              error: error instanceof Error ? error.message : 'Internal error',
            })}\n\n`))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const result = await runCompile(() => {})
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('i420-compile-multi-start error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
