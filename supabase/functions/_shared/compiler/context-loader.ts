import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getAllowedNodeTypes,
  extractConversationState,
  type McpToolCatalogEntry,
} from '../agent-builder-integrations.ts'
import type { CompileArtifacts, FlowJSON, StageContext } from './types.ts'
import { resolveCompilerConfig } from './monolith.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export async function loadConfiguredIntegrations(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('integration_type')
    .eq('is_active', true)
  return new Set((data ?? []).map((r: { integration_type: string }) => r.integration_type))
}

export async function loadEnabledDataTables(
  supabase: ReturnType<typeof createClient>,
): Promise<string[]> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('config')
    .eq('integration_type', 'agent_builder_data_sources')
    .eq('is_active', true)
    .maybeSingle()
  const tables = (data as { config?: { enabled_tables?: string[] } } | null)?.config?.enabled_tables
  return Array.isArray(tables) ? tables : []
}

export async function loadMcpToolsCatalog(
  supabase: ReturnType<typeof createClient>,
): Promise<McpToolCatalogEntry[]> {
  const { data: servers } = await supabase
    .from('mcp_servers')
    .select('id, name')
    .eq('is_active', true)
    .eq('status', 'connected')
  if (!servers?.length) return []

  const serverIds = servers.map((s: { id: string }) => s.id)
  const nameById = new Map(servers.map((s: { id: string; name: string }) => [s.id, s.name]))
  const { data: tools } = await supabase
    .from('mcp_server_tools')
    .select('server_id, tool_name, description')
    .in('server_id', serverIds)

  return (tools ?? []).map((t: { server_id: string; tool_name: string; description?: string }) => ({
    server_id: t.server_id,
    server_name: nameById.get(t.server_id) ?? t.server_id,
    tool_name: t.tool_name,
    description: t.description ?? undefined,
  }))
}

export async function loadStageContext(
  agent_id: string,
  user_id: string,
  prompt: string,
  action = 'generate',
): Promise<StageContext> {
  const supabase = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  const configuredTypes = await loadConfiguredIntegrations(supabase)
  const enabledTables = await loadEnabledDataTables(supabase)
  const mcpCatalog = await loadMcpToolsCatalog(supabase)
  const allowedNodeTypes = getAllowedNodeTypes(configuredTypes, mcpCatalog.length > 0)
  const compilerConfig = await resolveCompilerConfig(supabase)

  const { data: session } = await supabase
    .from('builder_sessions')
    .select('chat_history, compile_artifacts')
    .eq('agent_id', agent_id)
    .eq('user_id', user_id)
    .maybeSingle()

  const chatHistory: Array<{ role: string; content: string }> = session?.chat_history ?? []
  const priorArtifacts = (session?.compile_artifacts ?? {}) as CompileArtifacts

  const { data: agent } = await supabase
    .from('agents')
    .select('current_version_id')
    .eq('id', agent_id)
    .single()

  let currentFlow: FlowJSON | null = null
  if (agent?.current_version_id) {
    const { data: version } = await supabase
      .from('agent_versions')
      .select('flow_json')
      .eq('id', agent.current_version_id)
      .single()
    currentFlow = (version?.flow_json as FlowJSON) ?? null
  }

  extractConversationState(chatHistory, prompt)

  return {
    supabase,
    agent_id,
    user_id,
    prompt,
    action,
    chatHistory,
    configuredTypes,
    allowedNodeTypes,
    enabledTables,
    mcpCatalog,
    currentFlow,
    artifacts: { ...priorArtifacts, compiler_mode: 'multi_stage' },
    compilerConfig,
  }
}
