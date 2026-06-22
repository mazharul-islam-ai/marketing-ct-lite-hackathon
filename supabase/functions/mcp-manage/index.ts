import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { encryptValue, decryptValue } from '../_shared/encryption.ts'
import { testMcpConnection, type McpServerConnection } from '../_shared/mcp-client.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface McpServerRow {
  id: string
  name: string
  description: string | null
  transport: string
  url: string
  auth_type: string
  auth_token_encrypted: string | null
  auth_header_name: string | null
  status: string
  status_message: string | null
  is_active: boolean
  last_sync_at: string | null
  created_at: string
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: 'Unauthorized', status: 401 as const }

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = (roleRow as { role?: string } | null)?.role
  if (!role || !['super_admin', 'manager'].includes(role)) {
    return { error: 'Forbidden', status: 403 as const }
  }

  return { user, adminClient }
}

async function connectionFromServer(server: McpServerRow): Promise<McpServerConnection> {
  let authToken: string | undefined
  if (server.auth_token_encrypted) {
    authToken = await decryptValue(server.auth_token_encrypted)
  }
  return {
    url: server.url,
    authType: (server.auth_type as McpServerConnection['authType']) ?? 'none',
    authToken,
    authHeaderName: server.auth_header_name ?? 'Authorization',
  }
}

async function syncTools(adminClient: ReturnType<typeof createClient>, server: McpServerRow) {
  const connection = await connectionFromServer(server)
  const test = await testMcpConnection(connection)

  if (!test.ok) {
    await adminClient
      .from('mcp_servers')
      .update({ status: 'error', status_message: test.error ?? 'Connection failed' })
      .eq('id', server.id)
    return { ok: false, error: test.error, tools: [] }
  }

  await adminClient.from('mcp_server_tools').delete().eq('server_id', server.id)

  if (test.tools.length > 0) {
    await adminClient.from('mcp_server_tools').insert(
      test.tools.map((t) => ({
        server_id: server.id,
        tool_name: t.name,
        description: t.description ?? null,
        input_schema: t.inputSchema ?? {},
      })),
    )
  }

  await adminClient
    .from('mcp_servers')
    .update({
      status: 'connected',
      status_message: null,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', server.id)

  return { ok: true, tools: test.tools }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const auth = await requireAdmin(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { user, adminClient } = auth

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (req.method === 'GET') {
      const { data: servers, error } = await adminClient
        .from('mcp_servers_safe')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const { data: tools } = await adminClient
        .from('mcp_server_tools')
        .select('server_id, tool_name, description, input_schema, synced_at')

      return new Response(JSON.stringify({ servers: servers ?? [], tools: tools ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = req.method === 'POST' ? await req.json() : {}

    if (action === 'create' || body.action === 'create') {
      const { name, url: serverUrl, description, auth_type, auth_token, auth_header_name, transport } = body
      if (!name || !serverUrl) {
        return new Response(JSON.stringify({ error: 'name and url are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let auth_token_encrypted: string | null = null
      if (auth_token && auth_type && auth_type !== 'none') {
        auth_token_encrypted = await encryptValue(String(auth_token))
      }

      const { data: server, error } = await adminClient
        .from('mcp_servers')
        .insert({
          name: String(name),
          description: description ? String(description) : null,
          url: String(serverUrl),
          transport: transport ?? 'http',
          auth_type: auth_type ?? 'none',
          auth_token_encrypted,
          auth_header_name: auth_header_name ?? 'Authorization',
          created_by: user.id,
          status: 'pending',
        })
        .select('*')
        .single()

      if (error) throw error

      const sync = await syncTools(adminClient, server as McpServerRow)
      const { auth_token_encrypted: _omit, ...safe } = server as McpServerRow & { auth_token_encrypted?: string }

      return new Response(JSON.stringify({ server: safe, sync }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'sync' || body.action === 'sync') {
      const serverId = body.server_id ?? url.searchParams.get('server_id')
      if (!serverId) {
        return new Response(JSON.stringify({ error: 'server_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: server, error } = await adminClient
        .from('mcp_servers')
        .select('*')
        .eq('id', serverId)
        .single()

      if (error || !server) throw error ?? new Error('Server not found')

      const sync = await syncTools(adminClient, server as McpServerRow)
      return new Response(JSON.stringify({ sync }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete' || body.action === 'delete') {
      const serverId = body.server_id
      if (!serverId) {
        return new Response(JSON.stringify({ error: 'server_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await adminClient.from('mcp_servers').delete().eq('id', serverId)
      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'test' || body.action === 'test') {
      const connection: McpServerConnection = {
        url: String(body.url),
        authType: body.auth_type ?? 'none',
        authToken: body.auth_token ? String(body.auth_token) : undefined,
        authHeaderName: body.auth_header_name ?? 'Authorization',
      }
      const result = await testMcpConnection(connection)
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
