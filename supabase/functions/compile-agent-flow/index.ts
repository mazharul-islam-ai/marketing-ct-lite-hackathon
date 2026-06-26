/**
 * @deprecated Use i420-compile-single or i420-compile router.
 * Thin proxy for backward compatibility during frontend cutover.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const targetUrl = `${SUPABASE_URL}/functions/v1/i420-compile-single`
  const headers = new Headers(req.headers)
  headers.delete('host')

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    })

    const responseHeaders = new Headers(response.headers)
    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('compile-agent-flow proxy error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy failed' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
