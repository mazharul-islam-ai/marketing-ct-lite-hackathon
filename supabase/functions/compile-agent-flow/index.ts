import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  buildPlatformOverview,
  checkPromptIntegrations,
  getAllowedNodeTypes,
  COMPILE_PHASES,
  type CompilePhase,
} from '../_shared/agent-builder-integrations.ts'

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
  'db_query', 'api_call', 'email_send', 'slack_notify', 'crm_update', 'mcp_tool', 'gmail_fetch_unread',
  // Output nodes
  'dashboard_write', 'email_output', 'db_write', 'report_generate',
] as const

// Fuzzy aliases: map common LLM-invented names → valid node types
const TYPE_ALIASES: Record<string, string> = {
  // db_query
  database_query: 'db_query', query_database: 'db_query', sql_query: 'db_query',
  fetch_data: 'db_query', fetch_deals: 'db_query', get_data: 'db_query',
  read_data: 'db_query', retrieve_data: 'db_query', db_read: 'db_query',
  query_db: 'db_query', database_read: 'db_query',
  // openai_llm
  llm_call: 'openai_llm', ai_call: 'openai_llm', llm: 'openai_llm',
  llm_query: 'openai_llm', gpt: 'openai_llm', generate_text: 'openai_llm',
  ai_process: 'openai_llm', language_model: 'openai_llm', ai_model: 'openai_llm',
  // report_generate
  generate_report: 'report_generate', create_report: 'report_generate',
  build_report: 'report_generate', make_report: 'report_generate',
  // manual_trigger
  start: 'manual_trigger', trigger: 'manual_trigger', begin: 'manual_trigger',
  initiate: 'manual_trigger', on_demand: 'manual_trigger',
  // cron_trigger
  schedule: 'cron_trigger', scheduled: 'cron_trigger', cron: 'cron_trigger',
  timer: 'cron_trigger', recurring: 'cron_trigger',
  // email_output
  send_report: 'email_output', notify: 'email_output', notification: 'email_output',
  send_notification: 'email_output',
  // db_write
  save_data: 'db_write', store_data: 'db_write', insert_data: 'db_write',
  write_data: 'db_write', persist_data: 'db_write', update_data: 'db_write',
  // api_call
  http_request: 'api_call', rest_call: 'api_call', external_api: 'api_call',
  api_request: 'api_call', web_request: 'api_call',
  // slack_notify
  slack_message: 'slack_notify', slack_alert: 'slack_notify', send_slack: 'slack_notify',
  // email_send
  send_email: 'email_send', email: 'email_send',
  // gmail_fetch_unread
  gmail_fetch: 'gmail_fetch_unread', fetch_unread_emails: 'gmail_fetch_unread',
  gmail_unread: 'gmail_fetch_unread', read_gmail: 'gmail_fetch_unread',
  // condition
  if_else: 'condition', branch: 'condition', decision: 'condition', check: 'condition',
}

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

// ── Load active integrations from organization_integrations ────────────────
async function loadConfiguredIntegrations(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('organization_integrations')
    .select('integration_type')
    .eq('is_active', true)

  return new Set((data ?? []).map((r: { integration_type: string }) => r.integration_type))
}

function buildFlowJsonSchema(allowedNodeTypes: string[]) {
  const nodeEnum = allowedNodeTypes.length > 0 ? allowedNodeTypes : [...VALID_NODE_TYPES]
  return {
    type: 'object',
    properties: {
      trigger: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: nodeEnum },
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
            type: { type: 'string', enum: nodeEnum },
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
}

// Legacy static schema (fallback)
const FLOW_JSON_SCHEMA = buildFlowJsonSchema([...VALID_NODE_TYPES])

// ── Load the active system prompt from agent_builder_prompts ─────────────────
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

// ── Build the final system prompt ─────────────────────────────────────────────
// If an admin-defined custom prompt is active it is placed first as context /
// persona instructions; the structural rules are always appended so the LLM
// always knows the valid node types and output format.
function buildSystemPrompt(
  customPrefix: string | null | undefined,
  configuredTypes: Set<string>,
  allowedNodeTypes: string[],
): string {
  const platformBlock = buildPlatformOverview(configuredTypes)
  const allowedList = allowedNodeTypes.join(', ')

  const structural = `You are an AI workflow compiler for an enterprise Agent Builder platform.

Your job is to convert a user's natural language description into a structured JSON workflow.

ALLOWED NODE TYPES FOR THIS WORKSPACE (you MUST only use these exact strings):
${allowedList}

RULES:
1. NEVER invent node types outside the allowed list above.
2. NEVER use mcp_tool unless explicitly requested and configured.
3. NEVER use nodes that require integrations not in CONFIGURED INTEGRATIONS.
4. If the user needs a missing integration, return ONLY: { "clarification_needed": true, "question": "..." } directing them to Integrations Hub.
5. If delivery channel (email vs Slack vs dashboard) or schedule time is unspecified, ask ONE clarifying question.
6. Assign sequential node IDs: "n1", "n2", "n3", ...
7. Position nodes left-to-right with x increasing by 200 per step, y=200 for main path, y=400 for branches.
8. Edges must reference valid node IDs only.
9. For condition nodes, create two edges: one with condition="YES" and one with condition="NO".
10. The trigger field should be a single trigger node (or null for manual/on-demand workflows).
11. Return ONLY the JSON object, no markdown, no explanation.

COMMON PATTERNS — use these exact node types:
- "retrieve unread emails / Gmail inbox"              → gmail_fetch_unread
- "retrieve / fetch / query database"                 → db_query
- "call AI / use LLM / analyze with GPT"              → openai_llm
- "analyze with Gemini"                               → gemini_llm
- "generate / create a report"                        → report_generate
- "send report / summary by email"                    → email_output
- "run on a schedule / every day / every hour"        → cron_trigger
- "run manually / on demand"                          → manual_trigger
- "notify via Slack"                                  → slack_notify

CLARIFICATION:
If the request is genuinely ambiguous OR requires an unconfigured integration,
return ONLY this JSON object (no flow, no explanation):
{ "clarification_needed": true, "question": "your single concise question" }`

  const parts = [platformBlock, structural]
  if (customPrefix) parts.unshift(customPrefix)
  return parts.join('\n\n---\n\n')
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
      resolveNodeType(node)
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
    resolveNodeType(t)
    obj.trigger = t
  }

  // Handle { nodes: [...] } flat array — split into trigger + steps
  if (Array.isArray(obj.nodes) && !obj.steps) {
    const nodes = obj.nodes as Record<string, unknown>[]
    // Normalize type names on the raw nodes before splitting
    nodes.forEach((n) => resolveNodeType(n))
    const triggerNode = nodes.find((n) => String(n.type ?? '').endsWith('_trigger'))
    obj.trigger = triggerNode ?? null
    obj.steps = nodes.filter((n) => n !== triggerNode)
    delete obj.nodes
  }

  // Ensure trigger is null (not missing/undefined) if absent
  if (!('trigger' in obj)) {
    obj.trigger = null
  }

  return obj
}

// Resolve and normalise the .type field on a raw node object in-place
function resolveNodeType(node: Record<string, unknown>): void {
  // Promote alternate field names
  if (!node.type && node.nodeType) node.type = node.nodeType
  if (!node.type && node.node_type) node.type = node.node_type
  if (!node.type && node.kind) node.type = node.kind
  if (!node.type && node.category) node.type = node.category
  // Apply fuzzy alias mapping (case-insensitive)
  if (node.type && typeof node.type === 'string') {
    const lower = node.type.toLowerCase().replace(/[-\s]/g, '_')
    if (TYPE_ALIASES[lower]) node.type = TYPE_ALIASES[lower]
    else if (TYPE_ALIASES[node.type]) node.type = TYPE_ALIASES[node.type]
  }
}

// ── Validate flow JSON structure ─────────────────────────────────────────────
function validateFlowJSON(
  flow: unknown,
  allowedNodeTypes?: Set<string>,
): { valid: boolean; error?: string } {
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
    const allowed = allowedNodeTypes ?? new Set(VALID_NODE_TYPES)
    if (!allowed.has(node.type)) {
      return { valid: false, error: `Node type "${node.type}" is not allowed (integration may not be configured)` }
    }
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
  flowSchema = FLOW_JSON_SCHEMA,
): Promise<FlowJSON> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10),
    { role: 'user', content: userPrompt },
  ]

  const responseFormat = useStrictSchema
    ? {
        type: 'json_schema',
        json_schema: { name: 'agent_flow', strict: true, schema: flowSchema },
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
  flowSchema = FLOW_JSON_SCHEMA,
): Promise<FlowJSON> {
  switch (provider) {
    case 'openai':
      return callOpenAI(
        apiKey, model,
        'https://api.openai.com/v1/chat/completions',
        systemPrompt, userPrompt, chatHistory,
        !isReasoningModel(model),
        flowSchema,
      )

    case 'perplexity':
      return callOpenAI(
        apiKey, model,
        'https://api.perplexity.ai/chat/completions',
        systemPrompt, userPrompt, chatHistory,
        false,
        flowSchema,
      )

    case 'gemini':
      return callGemini(apiKey, model, systemPrompt, userPrompt, chatHistory)

    case 'claude':
      return callAnthropic(apiKey, model, systemPrompt, userPrompt, chatHistory)

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// ── Compile result types ─────────────────────────────────────────────────────
type StatusEmitter = (phase: CompilePhase) => void

async function upsertClarification(
  supabase: ReturnType<typeof createClient>,
  agent_id: string,
  user_id: string,
  prompt: string,
  question: string,
  chatHistory: Array<{ role: string; content: string }>,
) {
  const clarityHistory = [
    ...chatHistory,
    { role: 'user', content: prompt },
    { role: 'assistant', content: question },
  ]
  await supabase
    .from('builder_sessions')
    .upsert({
      agent_id,
      user_id,
      chat_history: clarityHistory.slice(-50),
      last_active: new Date().toISOString(),
    }, { onConflict: 'agent_id,user_id' })

  return {
    success: false,
    needs_clarification: true,
    question,
    ai_message: question,
    chat_history: clarityHistory.slice(-50),
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const runCompile = async (
    emit: StatusEmitter,
    body: { prompt: string; agent_id: string; action?: string },
  ) => {
    const authHeader = req.headers.get('Authorization')
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

    const { prompt, agent_id, action } = body

    if (!prompt || !agent_id) {
      return { error: 'prompt and agent_id are required', status: 400 }
    }

    emit('checking_provider')
    let compilerConfig: { provider: string; model: string; apiKey: string }
    try {
      compilerConfig = await resolveCompilerConfig(supabase)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, message: msg, status: 503 }
    }

    emit('loading_integrations')
    const configuredTypes = await loadConfiguredIntegrations(supabase)
    const allowedNodeTypes = getAllowedNodeTypes(configuredTypes)
    const allowedSet = new Set(allowedNodeTypes)
    const flowSchema = buildFlowJsonSchema(allowedNodeTypes)

    emit('validating_tools')
    const integrationCheck = checkPromptIntegrations(prompt, configuredTypes)
    if (integrationCheck) {
      return await upsertClarification(
        supabase, agent_id, user.id, prompt, integrationCheck.question,
        (await supabase.from('builder_sessions').select('chat_history').eq('agent_id', agent_id).eq('user_id', user.id).maybeSingle()).data?.chat_history ?? [],
      )
    }

    emit('loading_context')
    const { data: session } = await supabase
      .from('builder_sessions')
      .select('id, chat_history')
      .eq('agent_id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle()

    const chatHistory: Array<{ role: string; content: string }> = session?.chat_history ?? []

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

    const customSystemPrompt = await loadCustomSystemPrompt(supabase)

    const systemPrompt = buildSystemPrompt(customSystemPrompt, configuredTypes, allowedNodeTypes) + (
      currentFlow
        ? `\n\n---\n\nCURRENT FLOW STATE (for context):\n${JSON.stringify(currentFlow, null, 2)}`
        : ''
    )

    let flowJSON: FlowJSON | null = null
    let lastError: string | null = null
    let lastRawJSON: string | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let retryNote = ''
        if (attempt > 0) {
          emit('validating_flow')
          retryNote = `\n\nPREVIOUS ATTEMPT FAILED VALIDATION: ${lastError}.`
          if (lastRawJSON) retryNote += ` You returned: ${lastRawJSON.slice(0, 500)}. Please return ONLY a JSON object with exactly these top-level keys: trigger, steps (array), edges (array).`
          else retryNote += ' Please fix this.'
        }

        emit('thinking')
        const raw = await callLLM(
          compilerConfig.provider,
          compilerConfig.model,
          compilerConfig.apiKey,
          systemPrompt,
          prompt + retryNote,
          chatHistory,
          flowSchema,
        )

        emit('designing_flow')

        if (attempt === 0 && raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const maybeClarity = raw as Record<string, unknown>
          if (maybeClarity.clarification_needed === true && typeof maybeClarity.question === 'string') {
            return await upsertClarification(
              supabase, agent_id, user.id, prompt, maybeClarity.question.trim(), chatHistory,
            )
          }
        }

        const normalized = normalizeFlowJSON(raw)
        lastRawJSON = JSON.stringify(normalized).slice(0, 500)
        console.log(`[compile attempt ${attempt + 1}] provider: ${compilerConfig.provider} | model: ${compilerConfig.model}`)

        flowJSON = normalized as FlowJSON
        emit('validating_flow')
        const validation = validateFlowJSON(flowJSON, allowedSet)
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

      return {
        success: false,
        message: `Could not generate a valid flow. ${lastError ?? 'Please try rephrasing.'}`,
        chat_history: newHistory.slice(-50),
      }
    }

    emit('saving_version')
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

    await supabase
      .from('agents')
      .update({
        current_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)

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

    return {
      success: true,
      flow_json: flowJSON,
      version_id: newVersion.id,
      version: nextVersion,
      ai_message: aiMessage,
      chat_history: newHistory.slice(-50),
      compiler: { provider: compilerConfig.provider, model: compilerConfig.model },
    }
  }

  try {
    const body = await req.json() as { prompt: string; agent_id: string; action?: string; stream?: boolean }
    const useStream = body?.stream === true

    if (useStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const emit: StatusEmitter = (phase) => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'status', phase, label: COMPILE_PHASES[phase] })}\n\n`,
            ))
          }
          try {
            const result = await runCompile(emit, body)
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

    const result = await runCompile(() => {}, body)
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
    console.error('compile-agent-flow error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
