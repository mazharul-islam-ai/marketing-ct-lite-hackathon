import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { loadCompilerMode } from '../_shared/compiler/compiler-config.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function forwardTo(target: string, req: Request): Promise<Response> {
  const headers = new Headers(req.headers)
  headers.delete('host')
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${target}`, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
  })
  const responseHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    responseHeaders.set(key, value)
  }
  return new Response(response.body, { status: response.status, headers: responseHeaders })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { mode } = await loadCompilerMode(supabase)
    const target = mode === 'multi_stage' ? 'i420-compile-multi-start' : 'i420-compile-single'
    return await forwardTo(target, req)
  } catch (error) {
    console.error('i420-compile router error:', error)
    return await forwardTo('i420-compile-single', req)
  }
})
