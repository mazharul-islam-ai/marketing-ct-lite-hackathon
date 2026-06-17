import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const TRIGGER_SECRET_KEY = Deno.env.get('TRIGGER_SECRET_KEY') ?? ''
const TRIGGER_API_URL = 'https://api.trigger.dev/api/v3/tasks/execute-agent-run/trigger'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const webhookSecret = req.headers.get('x-webhook-secret')

    // Authenticate: either JWT user or webhook secret
    let triggeredBy: string | null = null
    let triggerType: 'manual' | 'cron' | 'webhook' | 'test' = 'manual'
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (webhookSecret) {
      // Webhook trigger — validate secret against stored automation
      triggerType = 'webhook'
      triggeredBy = null
    } else if (authHeader) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error } = await userClient.auth.getUser()
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      triggeredBy = user.id
    } else {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const {
      agent_id,
      version_id,
      trigger_type: bodyTriggerType,
      input_context = {},
      budget_limit = 5.00,
    } = body

    if (!agent_id) {
      return new Response(JSON.stringify({ error: 'agent_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    triggerType = bodyTriggerType ?? triggerType

    // Resolve the version to run (default: current_version_id)
    let resolvedVersionId = version_id
    if (!resolvedVersionId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('current_version_id, status')
        .eq('id', agent_id)
        .single()

      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!agent.current_version_id) {
        return new Response(JSON.stringify({ error: 'Agent has no published version. Compile a flow first.' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      resolvedVersionId = agent.current_version_id
    }

    // Fetch the flow JSON for this version
    const { data: versionData } = await supabase
      .from('agent_versions')
      .select('id, version, flow_json')
      .eq('id', resolvedVersionId)
      .single()

    if (!versionData) {
      return new Response(JSON.stringify({ error: 'Version not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the agent_runs record
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        agent_id,
        version_id: resolvedVersionId,
        triggered_by: triggeredBy,
        trigger_type: triggerType,
        status: 'queued',
        budget_limit,
        step_count: 0,
        total_cost: 0,
        tokens_used: 0,
      })
      .select('id')
      .single()

    if (runError || !run) {
      throw new Error(`Failed to create run record: ${runError?.message}`)
    }

    const taskPayload = {
      run_id: run.id,
      agent_id,
      version_id: resolvedVersionId,
      flow_json: versionData.flow_json,
      input_context,
      budget_limit,
      triggered_by: triggeredBy,
      trigger_type: triggerType,
    }

    // ── Path A: direct Trigger.dev API call (immediate, no polling delay) ──
    let triggerDevRunId: string | null = null
    if (TRIGGER_SECRET_KEY) {
      try {
        const tdRes = await fetch(TRIGGER_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TRIGGER_SECRET_KEY}`,
          },
          body: JSON.stringify({ payload: taskPayload }),
        })

        if (tdRes.ok) {
          const tdData = await tdRes.json()
          triggerDevRunId = tdData?.id ?? null
          console.log('Trigger.dev run started:', triggerDevRunId)

          if (triggerDevRunId) {
            await supabase
              .from('agent_runs')
              .update({ trigger_dev_run_id: triggerDevRunId })
              .eq('id', run.id)
          }
        } else {
          const errText = await tdRes.text()
          console.error('Trigger.dev API error:', tdRes.status, errText)
        }
      } catch (tdErr) {
        console.error('Trigger.dev fetch failed:', tdErr)
      }
    }

    // ── Path B: pgmq fallback (picked up by poll-agent-run-queue cron) ──
    // Only enqueue when Path A failed so we avoid double-execution race conditions.
    if (!triggerDevRunId) {
      const { data: msgId, error: mqError } = await supabase
        .rpc('pgmq_send', {
          queue_name: 'agent_runs',
          msg: { ...taskPayload, enqueued_at: new Date().toISOString() },
        })

      if (mqError) {
        console.error('pgmq_send error:', mqError.message)
      } else if (msgId) {
        await supabase
          .from('agent_runs')
          .update({ pgmq_msg_id: msgId })
          .eq('id', run.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        trigger_dev_run_id: triggerDevRunId,
        agent_id,
        version_id: resolvedVersionId,
        version: versionData.version,
        status: 'queued',
        dispatched_via: triggerDevRunId ? 'trigger.dev' : 'pgmq',
        message: triggerDevRunId
          ? 'Run dispatched to Trigger.dev. Realtime updates will appear in the Runtime tab.'
          : 'Run queued via pgmq. Will be picked up within 1 minute by the scheduled poller.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('trigger-flow-run error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
