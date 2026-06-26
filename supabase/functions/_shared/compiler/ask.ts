import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildPlatformOverview,
  buildWorkspaceToolchainBlock,
  buildMcpToolsBlock,
  buildResolvedContextBlock,
  extractConversationState,
  sanitizePersonaPrompt,
  type CompilePhase,
} from '../agent-builder-integrations.ts'
import { calculateAgentCost } from '../cost-calculator.ts'
import { callLLM, resolveCompilerConfig } from './monolith.ts'
import {
  loadConfiguredIntegrations,
  loadEnabledDataTables,
  loadMcpToolsCatalog,
} from './context-loader.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ASK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    user_message: { type: 'string' },
  },
  required: ['user_message'],
}

export type AskCompileBody = { prompt: string; agent_id: string }

type StatusEmitter = (phase: CompilePhase) => void

async function loadCustomSystemPrompt(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('agent_builder_prompts')
      .select('prompt_text')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    const text = ((data as { prompt_text?: string } | null)?.prompt_text ?? '').trim()
    return text || null
  } catch {
    return null
  }
}

function buildAskSystemPrompt(
  personaPrefix: string | null | undefined,
  configuredTypes: Set<string>,
  enabledTables: string[],
  mcpCatalog: Awaited<ReturnType<typeof loadMcpToolsCatalog>>,
  resolvedContextBlock: string | undefined,
  currentFlowJson: string | null,
): string {
  const toolchainBlock = buildWorkspaceToolchainBlock({
    configuredTypes,
    enabledTables,
    mcpCatalog,
  })
  const mcpDetailBlock = mcpCatalog.length > 0 ? buildMcpToolsBlock(mcpCatalog) : ''
  const platformBlock = buildPlatformOverview(configuredTypes)

  const askRules = `You are i420 Design chat in ASK mode.

Your job is to answer questions about this workspace, the current workflow, integrations, data sources, and MCP tools.

RULES:
1. Answer clearly and concisely using ONLY the context below.
2. Do NOT output flow_json, node graphs, code patches, or implementation steps.
3. Do NOT invent integrations, tables, or tools that are not listed in WORKSPACE TOOLCHAIN.
4. Do NOT run database queries or call external APIs — you only have static context.
5. If the user wants to build or change a workflow, suggest they switch to Build mode.
6. Return JSON: { "user_message": "your reply in natural language" }

${platformBlock}

${toolchainBlock}
${mcpDetailBlock ? `\n${mcpDetailBlock}` : ''}

${currentFlowJson ? `CURRENT FLOW (read-only context):\n${currentFlowJson}` : 'No flow compiled yet for this agent.'}`

  const parts = [askRules]
  if (resolvedContextBlock) parts.splice(1, 0, resolvedContextBlock)
  if (personaPrefix) parts.unshift(`PERSONA (tone only):\n${personaPrefix}`)
  return parts.join('\n\n---\n\n')
}

export async function runAskCompile(
  emit: StatusEmitter,
  body: AskCompileBody,
  authHeader: string,
) {
  if (!authHeader) {
    return { error: 'Missing Authorization header', status: 401 }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { prompt, agent_id } = body
  if (!prompt || !agent_id) {
    return { error: 'prompt and agent_id are required', status: 400 }
  }

  emit('loading_context')

  const configuredTypes = await loadConfiguredIntegrations(supabase)
  const enabledTables = await loadEnabledDataTables(supabase)
  const mcpCatalog = await loadMcpToolsCatalog(supabase)

  const { data: session } = await supabase
    .from('builder_sessions')
    .select('chat_history')
    .eq('agent_id', agent_id)
    .eq('user_id', user.id)
    .maybeSingle()

  const chatHistory: Array<{ role: string; content: string }> = session?.chat_history ?? []

  const { data: agent } = await supabase
    .from('agents')
    .select('current_version_id')
    .eq('id', agent_id)
    .single()

  let currentFlowJson: string | null = null
  if (agent?.current_version_id) {
    const { data: version } = await supabase
      .from('agent_versions')
      .select('flow_json')
      .eq('id', agent.current_version_id)
      .single()
    if (version?.flow_json) {
      currentFlowJson = JSON.stringify(version.flow_json, null, 2)
    }
  }

  const conversationState = extractConversationState(chatHistory, prompt)
  const resolvedContextBlock = buildResolvedContextBlock(conversationState)
  const personaPrefix = sanitizePersonaPrompt(await loadCustomSystemPrompt(supabase))
  const systemPrompt = buildAskSystemPrompt(
    personaPrefix,
    configuredTypes,
    enabledTables,
    mcpCatalog,
    resolvedContextBlock || undefined,
    currentFlowJson,
  )

  emit('thinking')

  let compilerConfig: { provider: string; model: string; apiKey: string }
  try {
    compilerConfig = await resolveCompilerConfig(supabase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, message: msg, status: 503 }
  }

  const llmResponse = await callLLM(
    compilerConfig.provider,
    compilerConfig.model,
    compilerConfig.apiKey,
    systemPrompt,
    prompt,
    chatHistory,
    ASK_RESPONSE_SCHEMA,
  )

  const raw = llmResponse.result as Record<string, unknown>
  const userMessage = String(raw.user_message ?? raw.question ?? '').trim()
    || 'I could not generate a response. Please try rephrasing your question.'

  try {
    await supabase.from('i420_platform_usage').insert({
      user_id: user.id,
      agent_id,
      source: 'compile',
      action: 'ask',
      provider: compilerConfig.provider,
      model: compilerConfig.model,
      prompt_tokens: llmResponse.usage.promptTokens,
      completion_tokens: llmResponse.usage.completionTokens,
      total_tokens: llmResponse.usage.promptTokens + llmResponse.usage.completionTokens,
      cost_usd: calculateAgentCost(
        compilerConfig.provider,
        compilerConfig.model,
        llmResponse.usage.promptTokens,
        llmResponse.usage.completionTokens,
      ),
      metadata: { compiler: 'ask', action: 'ask' },
    })
  } catch {
    // non-fatal
  }

  const newHistory = [
    ...chatHistory,
    { role: 'user', content: prompt },
    { role: 'assistant', content: userMessage, message_type: 'normal' },
  ]

  await supabase
    .from('builder_sessions')
    .upsert({
      agent_id,
      user_id: user.id,
      chat_history: newHistory.slice(-50),
      last_active: new Date().toISOString(),
    }, { onConflict: 'agent_id,user_id' })

  return {
    success: true,
    user_message: userMessage,
    ai_message: userMessage,
    message_type: 'normal',
    chat_history: newHistory.slice(-50),
    compiler: { mode: 'ask', provider: compilerConfig.provider, model: compilerConfig.model },
  }
}
