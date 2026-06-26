// trigger-public-agent-run
// Allows unauthenticated (anon) users to trigger a run on a public-visibility agent.
// Authentication is performed via public_token (UUID) rather than a user JWT.
// JWT verification is disabled for this function — add to supabase/config.toml:
//   [functions.trigger-public-agent-run]
//   verify_jwt = false

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TRIGGER_SECRET_KEY = Deno.env.get('TRIGGER_SECRET_KEY') ?? ''
const TRIGGER_API_URL = 'https://api.trigger.dev/api/v3/tasks/i420-run-execute/trigger'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const body = await req.json()
    const { public_token, version_id, budget_limit = 2.0 } = body

    if (!public_token) {
      return new Response(JSON.stringify({ error: 'public_token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify agent exists, is public, and is published
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, current_version_id, status, visibility')
      .eq('public_token', public_token)
      .single()

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (agent.visibility !== 'public') {
      return new Response(JSON.stringify({ error: 'Agent is not public' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (agent.status !== 'published') {
      return new Response(JSON.stringify({ error: 'Agent is not published' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve version
    const resolvedVersionId = version_id ?? agent.current_version_id

    if (!resolvedVersionId) {
      return new Response(JSON.stringify({ error: 'Agent has no compiled version' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch flow JSON
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

    // Create agent_runs record — triggered_by is NULL for anon runs
    const { data: run, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        agent_id: agent.id,
        version_id: resolvedVersionId,
        triggered_by: null,
        trigger_type: 'manual',
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
      agent_id: agent.id,
      version_id: resolvedVersionId,
      flow_json: versionData.flow_json,
      input_context: {},
      budget_limit,
      triggered_by: null,
      trigger_type: 'manual',
    }

    // Dispatch to Trigger.dev if key is available
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
        } else {
          console.error('Trigger.dev API error:', tdRes.status, await tdRes.text())
        }
      } catch (tdErr) {
        console.error('Trigger.dev fetch failed:', tdErr)
      }
    }

    // ── Path B: pgmq fallback — only used when Path A (direct Trigger.dev) failed ──
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
        agent_id: agent.id,
        version_id: resolvedVersionId,
        status: 'queued',
        dispatched_via: triggerDevRunId ? 'trigger.dev' : 'pgmq',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('trigger-public-agent-run error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
