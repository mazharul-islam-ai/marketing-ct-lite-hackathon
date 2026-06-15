import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── Closed enum of allowed node types ────────────────────────────────────────
const VALID_NODE_TYPES = [
  // Trigger nodes
  'cron_trigger', 'webhook_trigger', 'manual_trigger', 'db_trigger', 'crm_event_trigger',
  // Logic nodes
  'condition', 'switch', 'loop', 'delay',
  // AI nodes
  'openai_llm', 'gemini_llm', 'anthropic_llm', 'custom_llm',
  // Tool nodes
  'db_query', 'api_call', 'email_send', 'slack_notify', 'crm_update', 'mcp_tool',
  // Output nodes
  'dashboard_write', 'email_output', 'db_write', 'report_generate',
] as const

type NodeType = typeof VALID_NODE_TYPES[number]

interface FlowNode {
  id: string
  type: NodeType
  label: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

interface FlowJSON {
  trigger: FlowNode | null
  steps: FlowNode[]
  edges: FlowEdge[]
}

// Maps compiler provider names → organization_integrations types + env var fallbacks
const PROVIDER_CONFIG: Record<string, { integrationType: string; envVar: string; defaultModel: string }> = {
  openai:     { integrationType: 'openai',        envVar: 'OPENAI_KEY',        defaultModel: 'gpt-4o' },
  gemini:     { integrationType: 'google_gemini', envVar: 'GEMINI_API_KEY',    defaultModel: 'gemini-1.5-flash' },
  claude:     { integrationType: 'anthropic',     envVar: 'ANTHROPIC_API_KEY', defaultModel: 'claude-3-5-haiku-20241022' },
  perplexity: { integrationType: 'perplexity',    envVar: 'PERPLEXITY_API_KEY', defaultModel: 'sonar-reasoning-pro' },
}

// ── Resolve API key for a provider (DB first, env fallback) ──────────────────
async function resolveProviderKey(
  supabase: ReturnType<typeof createClient>,
  integrationType: string,
  envVar: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('config')
    .eq('integration_type', integrationType)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cfg = data?.config as Record<string, string> | null
  const dbKey = (cfg?.api_key ?? cfg?.apiKey ?? '').trim()
  if (dbKey) return dbKey

  const envKey = (Deno.env.get(envVar) ?? '').trim()
  return envKey || null
}

// ── Resolve which provider+model+key to use for compilation ─────────────────
// Reads agent_builder_model_defaults, then picks the first provider that has a key.
// Falls back to openai if nothing is configured.
async function resolveCompilerConfig(
  supabase: ReturnType<typeof createClient>,
): Promise<{ provider: string; model: string; apiKey: string }> {
  // Load saved org defaults
  const { data: defaultsRow } = await supabase
    .from('organization_integrations')
    .select('config')
    .eq('integration_type', 'agent_builder_model_defaults')
    .limit(1)
    .maybeSingle()

  const defaults = (defaultsRow?.config ?? {}) as Record<string, string>

  // Try providers in preference order: saved defaults first, then fallback order
  const preferenceOrder = Object.keys(defaults).length > 0
    ? [...Object.keys(defaults), ...Object.keys(PROVIDER_CONFIG).filter(p => !defaults[p])]
    : Object.keys(PROVIDER_CONFIG)

  for (const providerName of preferenceOrder) {
    const cfg = PROVIDER_CONFIG[providerName]
    if (!cfg) continue

    const key = await resolveProviderKey(supabase, cfg.integrationType, cfg.envVar)
    if (key) {
      const model = (defaults[providerName] ?? cfg.defaultModel).trim()
      return { provider: providerName, model, apiKey: key }
    }
  }

  throw new Error(
    'No AI provider is configured. Please add an API key in Admin → Integrations (OpenAI, Gemini, Anthropic, or Perplexity).',
  )
}

// ── JSON Schema for OpenAI structured output ────────────────────────────────
const FLOW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    trigger: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: [...VALID_NODE_TYPES] },
        label: { type: 'string' },
        config: { type: 'object' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          required: ['x', 'y'],
        },
      },
      required: ['id', 'type', 'label', 'config', 'position'],
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: [...VALID_NODE_TYPES] },
          label: { type: 'string' },
          config: { type: 'object' },
          position: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
        },
        required: ['id', 'type', 'label', 'config', 'position'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          target: { type: 'string' },
          label: { type: 'string' },
          condition: { type: 'string' },
        },
        required: ['id', 'source', 'target'],
      },
    },
  },
  required: ['trigger', 'steps', 'edges'],
}

// ── System prompt injected into every compile request ───────────────────────
function buildSystemPrompt(): string {
  return `You are an AI workflow compiler for an enterprise Agent Builder platform.

Your job is to convert a user's natural language description into a structured JSON workflow.

VALID NODE TYPES (you MUST only use these):
Triggers: cron_trigger, webhook_trigger, manual_trigger, db_trigger, crm_event_trigger
Logic:    condition, switch, loop, delay
AI:       openai_llm, gemini_llm, anthropic_llm, custom_llm
Tools:    db_query, api_call, email_send, slack_notify, crm_update, mcp_tool
Outputs:  dashboard_write, email_output, db_write, report_generate

RULES:
1. NEVER invent node types outside the valid list above.
2. If the user requests a tool you cannot model (e.g. "send a fax"), pick the closest valid alternative and note it in the label.
3. Assign sequential node IDs: "n1", "n2", "n3", ...
4. Position nodes left-to-right with x increasing by 200 per step, y=200 for main path, y=400 for branches.
5. Edges must reference valid node IDs only.
6. For condition nodes, create two edges: one with condition="YES" and one with condition="NO".
7. The trigger field should be a single trigger node (or null for manual).
8. Return ONLY the JSON object, no markdown, no explanation.`
}

// ── Normalize flow JSON from LLM output ─────────────────────────────────────
// Reasoning models (e.g. gpt-5) sometimes return non-standard structures:
//   - steps/edges as an object dict instead of an array
//   - the entire flow wrapped in a single extra key (e.g. { "flow": { ... } })
// This function normalises those variations before validation.
function normalizeFlowJSON(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw

  const obj = raw as Record<string, unknown>

  // Unwrap single-key wrapper (e.g. { "agent_flow": { trigger, steps, edges } })
  const keys = Object.keys(obj)
  if (keys.length === 1 && typeof obj[keys[0]] === 'object' && obj[keys[0]] !== null) {
    const inner = obj[keys[0]] as Record<string, unknown>
    if ('steps' in inner || 'edges' in inner || 'trigger' in inner) {
      return normalizeFlowJSON(inner)
    }
  }

  // Convert steps from object to array if needed
  if (obj.steps && !Array.isArray(obj.steps) && typeof obj.steps === 'object') {
    obj.steps = Object.values(obj.steps as Record<string, unknown>)
  }

  // Convert edges from object to array if needed
  if (obj.edges && !Array.isArray(obj.edges) && typeof obj.edges === 'object') {
    obj.edges = Object.values(obj.edges as Record<string, unknown>)
  }

  // Normalize edge field names: some models use from/to instead of source/target
  if (Array.isArray(obj.edges)) {
    obj.edges = (obj.edges as Record<string, unknown>[]).map((e) => {
      if (!e || typeof e !== 'object') return e
      const edge = { ...e }
      if (!edge.source && edge.from)  edge.source = edge.from
      if (!edge.target && edge.to)    edge.target = edge.to
      if (!edge.source && edge.sourceId) edge.source = edge.sourceId
      if (!edge.target && edge.targetId) edge.target = edge.targetId
      return edge
    }).filter((e) => {
      // Drop edges that still have no valid source/target
      return e && e.source != null && e.target != null
    })
  }

  // Normalize node field names in steps (some models use name instead of label)
  if (Array.isArray(obj.steps)) {
    obj.steps = (obj.steps as Record<string, unknown>[]).map((n) => {
      if (!n || typeof n !== 'object') return n
      const node = { ...n }
      if (!node.label && node.name) node.label = node.name
      if (!node.label && node.title) node.label = node.title
      if (!node.config) node.config = {}
      if (!node.position) node.position = { x: 200, y: 200 }
      return node
    })
  }

  // Same normalization for trigger
  if (obj.trigger && typeof obj.trigger === 'object') {
    const t = { ...(obj.trigger as Record<string, unknown>) }
    if (!t.label && t.name) t.label = t.name
    if (!t.label && t.title) t.label = t.title
    if (!t.config) t.config = {}
    if (!t.position) t.position = { x: 0, y: 200 }
    obj.trigger = t
  }

  // Ensure trigger is null (not missing/undefined) if absent
  if (!('trigger' in obj)) {
    obj.trigger = null
  }

  return obj
}

// ── Validate flow JSON structure ─────────────────────────────────────────────
function validateFlowJSON(flow: unknown): { valid: boolean; error?: string } {
  if (!flow || typeof flow !== 'object') {
    return { valid: false, error: 'Flow must be an object' }
  }

  const f = flow as FlowJSON

  if (!Array.isArray(f.steps)) {
    return { valid: false, error: 'steps must be an array' }
  }

  if (!Array.isArray(f.edges)) {
    return { valid: false, error: 'edges must be an array' }
  }

  const allNodes = [...(f.trigger ? [f.trigger] : []), ...f.steps]

  if (allNodes.length > 20) {
    return { valid: false, error: 'Flow exceeds maximum of 20 nodes' }
  }

  const nodeIds = new Set(allNodes.map((n) => n.id))

  for (const node of allNodes) {
    if (!VALID_NODE_TYPES.includes(node.type as NodeType)) {
      return { valid: false, error: `Invalid node type: "${node.type}"` }
    }
    if (!node.id || !node.label) {
      return { valid: false, error: `Node missing id or label` }
    }
  }

  for (const edge of f.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return { valid: false, error: `Edge references unknown node: ${edge.source} → ${edge.target}` }
    }
  }

  return { valid: true }
}

// Official OpenAI max_completion_tokens per model
// Source: https://platform.openai.com/docs/models
const MODEL_MAX_OUTPUT_TOKENS: Record<string, number> = {
  // GPT-4o family
  'gpt-4o':                    16384,
  'gpt-4o-mini':               16384,
  'gpt-4o-2024-11-20':         16384,
  'gpt-4o-2024-08-06':         16384,
  'gpt-4o-mini-2024-07-18':    16384,
  // GPT-4 Turbo
  'gpt-4-turbo':               4096,
  'gpt-4-turbo-2024-04-09':    4096,
  'gpt-4':                     8192,
  // GPT-3.5
  'gpt-3.5-turbo':             4096,
  // GPT-5
  'gpt-5':                     128000,
  'gpt-5-2025-08-07':          128000,
  // o1 family
  'o1':                        100000,
  'o1-2024-12-17':             100000,
  'o1-mini':                   65536,
  'o1-mini-2024-09-12':        65536,
  'o1-preview':                32768,
  // o3 family
  'o3':                        100000,
  'o3-mini':                   100000,
  // o4 family
  'o4-mini':                   100000,
}

const MODEL_MAX_OUTPUT_TOKENS_DEFAULT = 16384

function getMaxCompletionTokens(model: string): number {
  if (MODEL_MAX_OUTPUT_TOKENS[model]) return MODEL_MAX_OUTPUT_TOKENS[model]
  // Prefix match for versioned model names not in the table
  for (const [key, val] of Object.entries(MODEL_MAX_OUTPUT_TOKENS)) {
    if (model.startsWith(key)) return val
  }
  return MODEL_MAX_OUTPUT_TOKENS_DEFAULT
}

// Reasoning/newer models (o1, o3, gpt-5, etc.) do not support temperature or response_format.
function isReasoningModel(model: string): boolean {
  return /^o\d|^gpt-5/i.test(model)
}

// ── OpenAI / Perplexity (OpenAI-compatible) ──────────────────────────────────
async function callOpenAI(
  apiKey: string,
  model: string,
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
  useStrictSchema: boolean,
): Promise<FlowJSON> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10),
    { role: 'user', content: userPrompt },
  ]

  const responseFormat = useStrictSchema
    ? {
        type: 'json_schema',
        json_schema: { name: 'agent_flow', strict: true, schema: FLOW_JSON_SCHEMA },
      }
    : { type: 'json_object' }

  const reasoning = isReasoningModel(model)
  const body: Record<string, unknown> = {
    model,
    messages,
    max_completion_tokens: getMaxCompletionTokens(model),
  }
  if (!reasoning) {
    // Reasoning models do not support temperature or response_format
    body.temperature = 0.2
    body.response_format = responseFormat
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`Empty response from OpenAI-compatible API. Response: ${JSON.stringify(data)}`)
  }
  // Reasoning models may wrap output in markdown code fences — strip them before parsing
  const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(cleaned) as FlowJSON
}

// ── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
): Promise<FlowJSON> {
  // Build conversation history in Gemini format
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

  for (const msg of chatHistory.slice(-10)) {
    const geminiRole = msg.role === 'assistant' ? 'model' : 'user'
    contents.push({ role: geminiRole, parts: [{ text: msg.content }] })
  }
  contents.push({ role: 'user', parts: [{ text: userPrompt }] })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 3000,
        },
      }),
    },
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Empty response from Gemini')
  return JSON.parse(content) as FlowJSON
}

// ── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
): Promise<FlowJSON> {
  const messages: Array<{ role: string; content: string }> = [
    ...chatHistory.slice(-10),
    {
      role: 'user',
      content: userPrompt + '\n\nRespond with ONLY valid JSON, no markdown fences, no explanation.',
    },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      system: systemPrompt + '\n\nYou MUST respond with ONLY valid JSON, no markdown fences, no explanation.',
      messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text
  if (!content) throw new Error('Empty response from Anthropic')

  // Strip any accidental markdown fences
  const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(cleaned) as FlowJSON
}

// ── Unified LLM dispatcher ───────────────────────────────────────────────────
async function callLLM(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  chatHistory: Array<{ role: string; content: string }>,
): Promise<FlowJSON> {
  switch (provider) {
    case 'openai':
      return callOpenAI(
        apiKey, model,
        'https://api.openai.com/v1/chat/completions',
        systemPrompt, userPrompt, chatHistory,
        !isReasoningModel(model), // reasoning models require json_object (strict schema incompatible with open config field)
      )

    case 'perplexity':
      return callOpenAI(
        apiKey, model,
        'https://api.perplexity.ai/chat/completions',
        systemPrompt, userPrompt, chatHistory,
        false, // perplexity only supports json_object, not strict schema
      )

    case 'gemini':
      return callGemini(apiKey, model, systemPrompt, userPrompt, chatHistory)

    case 'claude':
      return callAnthropic(apiKey, model, systemPrompt, userPrompt, chatHistory)

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { prompt, agent_id, action } = await req.json()

    if (!prompt || !agent_id) {
      return new Response(JSON.stringify({ error: 'prompt and agent_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve provider, model, and API key from org settings
    let compilerConfig: { provider: string; model: string; apiKey: string }
    try {
      compilerConfig = await resolveCompilerConfig(supabase)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return new Response(
        JSON.stringify({ success: false, message: msg }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Load or create builder session for this user+agent
    const { data: session } = await supabase
      .from('builder_sessions')
      .select('id, chat_history')
      .eq('agent_id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const chatHistory: Array<{ role: string; content: string }> = session?.chat_history ?? []

    // Load current flow (if any) for context
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, current_version_id')
      .eq('id', agent_id)
      .single()

    let currentFlow: FlowJSON | null = null
    if (agent?.current_version_id) {
      const { data: version } = await supabase
        .from('agent_versions')
        .select('flow_json')
        .eq('id', agent.current_version_id)
        .single()
      currentFlow = version?.flow_json ?? null
    }

    const systemPrompt = buildSystemPrompt() + (
      currentFlow
        ? `\n\nCURRENT FLOW STATE (for context):\n${JSON.stringify(currentFlow, null, 2)}`
        : ''
    )

    // Attempt to compile with up to 2 retries on validation failure
    let flowJSON: FlowJSON | null = null
    let lastError: string | null = null
    let lastRawJSON: string | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let retryNote = ''
        if (attempt > 0) {
          retryNote = `\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${lastError}.`
          if (lastRawJSON) retryNote += ` You returned: ${lastRawJSON.slice(0, 500)}. Please return ONLY a JSON object with exactly these top-level keys: trigger, steps (array), edges (array).`
          else retryNote += ' Please fix this.'
        }

        const raw = await callLLM(
          compilerConfig.provider,
          compilerConfig.model,
          compilerConfig.apiKey,
          systemPrompt,
          prompt + retryNote,
          chatHistory,
        )

        // Normalize before validation to handle structural variations from different models
        const normalized = normalizeFlowJSON(raw)
        lastRawJSON = JSON.stringify(normalized).slice(0, 500)
        console.log(`[compile attempt ${attempt + 1}] raw keys: ${Object.keys(raw as object).join(',')} | provider: ${compilerConfig.provider} | model: ${compilerConfig.model}`)

        flowJSON = normalized as FlowJSON
        const validation = validateFlowJSON(flowJSON)
        if (validation.valid) break

        lastError = validation.error ?? 'Unknown validation error'
        flowJSON = null
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        flowJSON = null
      }
    }

    if (!flowJSON) {
      const newHistory = [
        ...chatHistory,
        { role: 'user', content: prompt },
        {
          role: 'assistant',
          content: `I could not generate a valid flow for that request. ${lastError ? `Reason: ${lastError}` : 'Please try rephrasing your description.'}`,
        },
      ]

      await supabase
        .from('builder_sessions')
        .upsert({
          agent_id,
          user_id: user.id,
          chat_history: newHistory.slice(-50),
          last_active: new Date().toISOString(),
        }, { onConflict: 'agent_id,user_id' })

      return new Response(
        JSON.stringify({
          success: false,
          message: `Could not generate a valid flow. ${lastError ?? 'Please try rephrasing.'}`,
          chat_history: newHistory.slice(-50),
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Save new agent version
    const nextVersion = await supabase
      .rpc('next_agent_version', { p_agent_id: agent_id })
      .then((r) => r.data ?? 1)

    const { data: newVersion, error: versionError } = await supabase
      .from('agent_versions')
      .insert({
        agent_id,
        version: nextVersion,
        flow_json: flowJSON,
        published_by: user.id,
      })
      .select('id')
      .single()

    if (versionError) throw versionError

    // Update agent's current_version_id
    await supabase
      .from('agents')
      .update({
        current_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)

    // Update builder session with new chat history
    const aiMessage =
      action === 'improve'
        ? `I've improved the flow based on your request. The canvas has been updated.`
        : `I've created a ${flowJSON.steps.length + (flowJSON.trigger ? 1 : 0)}-node flow for you. The canvas is now updated. Click any node to inspect or modify it.`

    const newHistory = [
      ...chatHistory,
      { role: 'user', content: prompt },
      { role: 'assistant', content: aiMessage },
    ]

    await supabase
      .from('builder_sessions')
      .upsert({
        agent_id,
        user_id: user.id,
        chat_history: newHistory.slice(-50),
        last_active: new Date().toISOString(),
      }, { onConflict: 'agent_id,user_id' })

    return new Response(
      JSON.stringify({
        success: true,
        flow_json: flowJSON,
        version_id: newVersion.id,
        version: nextVersion,
        ai_message: aiMessage,
        chat_history: newHistory.slice(-50),
        compiler: { provider: compilerConfig.provider, model: compilerConfig.model },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('compile-agent-flow error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
