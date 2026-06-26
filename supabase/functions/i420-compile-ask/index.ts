import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { COMPILE_PHASES } from '../_shared/agent-builder-integrations.ts'
import { runAskCompile } from '../_shared/compiler/ask.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json() as { prompt: string; agent_id: string; stream?: boolean }
    const useStream = body?.stream === true
    const authHeader = req.headers.get('Authorization') ?? ''

    if (useStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (phase: keyof typeof COMPILE_PHASES) => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'status', phase, label: COMPILE_PHASES[phase] })}\n\n`,
            ))
          }
          try {
            const result = await runAskCompile(emit, body, authHeader)
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

    const result = await runAskCompile(() => {}, body, authHeader)
    if ('status' in result && result.status) {
      return new Response(JSON.stringify(result), {
        status: result.status as number,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('i420-compile-ask error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
