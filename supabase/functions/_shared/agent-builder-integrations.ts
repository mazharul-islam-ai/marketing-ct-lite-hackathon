/**
 * Integration → flow node mapping for Agent Builder compiler and runtime.
 * Keep in sync with src/pages/adminpanel/agent-builder/integrationConfig.ts
 */

export interface IntegrationDef {
  integrationType: string
  label: string
  nodeTypes: string[]
}

export const INTEGRATION_DEFS: IntegrationDef[] = [
  { integrationType: 'gmail', label: 'Gmail', nodeTypes: ['gmail_fetch_unread'] },
  { integrationType: 'slack', label: 'Slack', nodeTypes: ['slack_notify', 'slack_fetch_messages'] },
  { integrationType: 'sendgrid', label: 'SendGrid', nodeTypes: ['email_send', 'email_output'] },
  { integrationType: 'resend', label: 'Resend', nodeTypes: ['email_send', 'email_output'] },
  { integrationType: 'activecollab', label: 'ActiveCollab', nodeTypes: ['db_query'] },
  { integrationType: 'hubspot', label: 'HubSpot', nodeTypes: ['crm_update', 'db_query'] },
  { integrationType: 'gohighlevel', label: 'GoHighLevel', nodeTypes: ['crm_update', 'db_query'] },
  { integrationType: 'google_drive', label: 'Google Drive', nodeTypes: ['db_query'] },
  { integrationType: 'n8n_analytics', label: 'n8n', nodeTypes: ['api_call'] },
  { integrationType: 'google_analytics', label: 'Google Analytics', nodeTypes: ['api_call'] },
  { integrationType: 'openai', label: 'OpenAI', nodeTypes: ['openai_llm'] },
  { integrationType: 'google_gemini', label: 'Google Gemini', nodeTypes: ['gemini_llm'] },
  { integrationType: 'anthropic', label: 'Anthropic Claude', nodeTypes: ['anthropic_llm'] },
  { integrationType: 'perplexity', label: 'Perplexity', nodeTypes: ['openai_llm'] },
]

/** Nodes that never require an external integration */
export const ALWAYS_AVAILABLE_NODE_TYPES = [
  'cron_trigger', 'webhook_trigger', 'manual_trigger', 'db_trigger', 'crm_event_trigger',
  'condition', 'switch', 'loop', 'delay',
  'custom_llm',
  'db_query', 'db_write',
  'dashboard_write', 'report_generate',
] as const

export const ALL_NODE_TYPES = [
  ...ALWAYS_AVAILABLE_NODE_TYPES,
  'openai_llm', 'gemini_llm', 'anthropic_llm',
  'api_call', 'email_send', 'slack_notify', 'slack_fetch_messages', 'crm_update',
  'gmail_fetch_unread', 'email_output', 'mcp_tool',
] as const

export const COMPILE_PHASES = {
  checking_provider: 'Checking AI provider…',
  loading_integrations: 'Checking configured tools…',
  loading_context: 'Loading flow context…',
  thinking: 'Thinking…',
  designing_flow: 'Designing workflow…',
  validating_flow: 'Validating flow structure…',
  saving_version: 'Saving new version…',
  extracting_intent: 'Understanding requirements…',
  planning_architecture: 'Planning workflow structure…',
  decomposing_tasks: 'Breaking into steps…',
  assembling_flow: 'Building workflow…',
  repairing_flow: 'Fixing validation issues…',
} as const

export type CompilePhase = keyof typeof COMPILE_PHASES

export const STAGE_TO_PHASE: Record<string, CompilePhase> = {
  'i420-compile-multi-01-extract-intent': 'extracting_intent',
  'i420-compile-multi-02-plan-architecture': 'planning_architecture',
  'i420-compile-multi-03-decompose-tasks': 'decomposing_tasks',
  'i420-compile-multi-04-assemble-flow': 'assembling_flow',
  'i420-compile-multi-05-validate-flow': 'validating_flow',
  'i420-compile-multi-06-repair-flow': 'repairing_flow',
}

export function getAllowedNodeTypes(configuredTypes: Set<string>, hasMcpServers = false): string[] {
  const allowed = new Set<string>(ALWAYS_AVAILABLE_NODE_TYPES)

  for (const def of INTEGRATION_DEFS) {
    if (configuredTypes.has(def.integrationType)) {
      for (const nt of def.nodeTypes) allowed.add(nt)
    }
  }

  // Email output if either sendgrid or resend
  if (configuredTypes.has('sendgrid') || configuredTypes.has('resend')) {
    allowed.add('email_send')
    allowed.add('email_output')
  }

  if (hasMcpServers) {
    allowed.add('mcp_tool')
  }

  return [...allowed]
}

/** All queryable tables defined in Agent Builder Settings → Data Sources */
export const KNOWN_DATA_TABLES = [
  'clients', 'contacts', 'deals', 'brands', 'projects',
  'generated_posts', 'brand_generated_posts', 'seo_blog_content',
  'brand_analytics_data', 'content_performance_metrics',
  'knowledge_base', 'knowledge_base_files', 'brand_knowledge_files',
  'team_members', 'employees', 'pods', 'team_eod_submissions',
  'ai_agents', 'ai_agent_runs', 'agent_memories',
  'activecollab_task_data', 'activecollab_sync_logs',
] as const

// ── Conversation State Extractor ─────────────────────────────────────────────
// Deterministic scan of chat history to extract already-resolved facts.
// Inspired by how Cursor injects structured file/cursor context and Lovable
// injects full platform state — so the LLM never re-asks what was answered.

export interface ConversationState {
  /** All detected workflow intents (supports hybrid prompts) */
  workflowHints: string[]
  /** @deprecated First hint only — prefer workflowHints */
  workflowHint: string | null
  resolvedParams: Record<string, string>
  userExclusions: string[]
}

/** Workflow-type hints — scan full conversation (history + current prompt). */
const WORKFLOW_HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\b(slack|channel)\b/i, hint: 'slack' },
  { pattern: /\b(gmail|email\s+inbox|unread\s+email)\b/i, hint: 'gmail' },
  { pattern: /\b(send\s+email|email\s+(report|summary|me))\b/i, hint: 'email_send' },
  { pattern: /\b(mcp\s+tool|mcp\s+server|external\s+mcp)\b/i, hint: 'mcp' },
  { pattern: /\b(db_query|database|query\s+(the\s+)?table|from\s+(the\s+)?table)\b/i, hint: 'db' },
]

/** Integration-intent hints — current user prompt only (avoid false positives from pasted logs/content). */
const INTEGRATION_HINT_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\b(?:sync|fetch|pull|connect|from|to|with|in)\s+(?:\w+\s+){0,4}(?:activecollab|ac\s+tasks?)\b|\bactivecollab\s+(?:sync|tasks|api|projects?)\b/i,
    hint: 'activecollab',
  },
  {
    pattern: /\b(?:sync|fetch|pull|connect|from|update)\s+(?:\w+\s+){0,4}hubspot\b|\bhubspot\s+(?:sync|deals|contacts)\b|\b(?:sync|fetch)\s+crm\s+(?:deals?|contacts?)\b/i,
    hint: 'hubspot',
  },
  {
    pattern: /\b(?:sync|fetch|pull|connect|from)\s+(?:\w+\s+){0,3}google\s+analytics\b|\b(?:ga\s+data|google\s+analytics\s+(?:sync|data|report))\b/i,
    hint: 'google_analytics',
  },
  {
    pattern: /\b(?:sync|fetch|pull|connect|from)\s+(?:\w+\s+){0,3}(?:google\s+drive|gdrive)\b|\b(?:google\s+drive|gdrive)\s+(?:sync|files?|folder)\b/i,
    hint: 'google_drive',
  },
]

const TIMEZONE_BD_RE = /\b(bd\s*(local\s*)?time|bangladesh|asia\/dhaka|utc\+6)\b/i

const EXCLUSION_PATTERNS: Array<RegExp> = [
  /\b(no\s+need\s+(?:to\s+)?(?:store|save|use)?\s*(?:in\s+)?(?:db|database|table))\b/i,
  /\b(don[''']?t\s+(?:store|save|use)\s+(?:in\s+)?(?:db|database|table))\b/i,
  /\b(without\s+(?:storing|saving|db|database))\b/i,
  /\b(no\s+(?:db|database|table|storage))\b/i,
  /\b(not\s+(?:from|in|via)\s+(?:db|database|table))\b/i,
  /\b(skip\s+(?:db|database|storage))\b/i,
]

/** Extract a Slack channel ID (e.g. C0BCJ27UQHG) from text */
const SLACK_CHANNEL_RE = /\b(C[A-Z0-9]{8,})\b/

/** Extract a cron-like schedule mention */
const SCHEDULE_RE = /\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?(?:\s+(?:UTC|BD|EST|PST|GMT)[^\s]*)?)\b/i

export function extractConversationState(
  chatHistory: Array<{ role: string; content: string }>,
  currentPrompt?: string,
): ConversationState {
  const state: ConversationState = {
    workflowHints: [],
    workflowHint: null,
    resolvedParams: {},
    userExclusions: [],
  }

  const historyText = chatHistory.map((m) => m.content).join('\n')
  const allText = currentPrompt ? `${historyText}\n${currentPrompt}` : historyText
  const promptText = (currentPrompt ?? '').trim()

  for (const { pattern, hint } of WORKFLOW_HINT_PATTERNS) {
    if (pattern.test(allText) && !state.workflowHints.includes(hint)) {
      state.workflowHints.push(hint)
    }
  }

  if (promptText) {
    for (const { pattern, hint } of INTEGRATION_HINT_PATTERNS) {
      if (pattern.test(promptText) && !state.workflowHints.includes(hint)) {
        state.workflowHints.push(hint)
      }
    }
  }
  state.workflowHint = state.workflowHints[0] ?? null

  // Extract Slack channel ID if present anywhere in history
  const channelMatch = allText.match(SLACK_CHANNEL_RE)
  if (channelMatch) {
    state.resolvedParams['slack_channel_id'] = channelMatch[1]
  }

  // Extract explicit schedule time if mentioned
  const scheduleMatch = allText.match(SCHEDULE_RE)
  if (scheduleMatch) {
    state.resolvedParams['schedule_time'] = scheduleMatch[1]
  }

  if (TIMEZONE_BD_RE.test(allText)) {
    state.resolvedParams['timezone'] = 'Asia/Dhaka'
  }

  // Detect user exclusions (things user said they DON'T want)
  for (const pattern of EXCLUSION_PATTERNS) {
    for (const msg of chatHistory) {
      if (msg.role === 'user' && pattern.test(msg.content)) {
        const match = msg.content.match(pattern)
        if (match) state.userExclusions.push(match[0].trim())
      }
    }
    if (currentPrompt && pattern.test(currentPrompt)) {
      const match = currentPrompt.match(pattern)
      if (match) state.userExclusions.push(match[0].trim())
    }
  }

  return state
}

export function hasWorkflowHint(state: ConversationState, hint: string): boolean {
  return state.workflowHints.includes(hint)
}

export function hasDbRelatedIntent(state: ConversationState): boolean {
  return state.workflowHints.some((h) => ['db', 'hubspot', 'activecollab'].includes(h))
}

/** Build the RESOLVED CONTEXT block injected into the system prompt */
export function buildResolvedContextBlock(state: ConversationState): string {
  const lines: string[] = []

  if (state.workflowHints.length > 0) {
    lines.push(`- Workflow hints detected: ${state.workflowHints.join(', ')}`)
  } else if (state.workflowHint) {
    lines.push(`- Workflow type detected: ${state.workflowHint}`)
  }

  for (const [key, value] of Object.entries(state.resolvedParams)) {
    const label = key.replace(/_/g, ' ')
    lines.push(`- ${label}: ${value}`)
  }

  for (const exclusion of state.userExclusions) {
    lines.push(`- User explicitly said they do NOT want: "${exclusion}"`)
  }

  if (userExcludedDatabase(state)) {
    lines.push('- User excluded database — do NOT add db_query/db_write even though tables are listed in WORKSPACE TOOLCHAIN.')
  }

  if (lines.length === 0) return ''

  return `RESOLVED CONTEXT (already confirmed in this conversation — do NOT re-ask these):
${lines.join('\n')}`
}

export function buildPlatformOverview(configuredTypes: Set<string>): string {
  const configured = INTEGRATION_DEFS
    .filter((d) => configuredTypes.has(d.integrationType))
    .map((d) => `- ${d.label} (${d.integrationType}): enables ${d.nodeTypes.join(', ')}`)
    .join('\n')

  const notConfigured = INTEGRATION_DEFS
    .filter((d) => !configuredTypes.has(d.integrationType))
    .map((d) => d.label)
    .join(', ')

  return `PLATFORM OVERVIEW:
You are the AI compiler for SJ Marketing Control Tower — an enterprise marketing automation platform.

Key URLs:
- Integrations Hub: /adminpanel/integrations (connect Gmail, Slack, SendGrid, OpenAI, etc.)
- Agent Builder: /adminpanel/agent-builder (design workflows)
- All Automations: /adminpanel/automations (published scheduled workflows)
- Automation Logs: /adminpanel/automations/logs

Concepts:
- An AGENT is a workflow definition (flow_json with nodes and edges).
- An AUTOMATION is a published agent with a schedule (cron_trigger → automations table).
- Only use tools that appear in CONFIGURED INTEGRATIONS below.
- If the user needs a missing integration, return clarification_needed asking them to configure it first.
- Use reasonable defaults for delivery (dashboard_write for UI) and schedule (09:00 Asia/Dhaka = cron 0 3 * * * UTC) rather than asking.

CONFIGURED INTEGRATIONS (active in this workspace):
${configured || '(none — ask user to configure Integrations Hub first)'}

NOT CONFIGURED (do NOT use nodes requiring these):
${notConfigured || '(all platform integrations are configured)'}

DELIVERY OPTIONS (only if integration configured):
- email_output / email_send → requires SendGrid or Resend
- slack_notify → requires Slack (send via chat.postMessage)
- slack_fetch_messages → requires Slack (read via conversations.history)
- dashboard_write / db_write / report_generate → always available`
}


export interface McpToolCatalogEntry {
  server_id: string
  server_name: string
  tool_name: string
  description?: string
}

export function buildMcpToolsBlock(catalog: McpToolCatalogEntry[]): string {
  if (catalog.length === 0) {
    return 'AVAILABLE MCP TOOLS: (none — register servers in Agent Builder → Settings → MCP Servers)'
  }

  const byServer = new Map<string, { server_id: string; tools: string[] }>()
  for (const entry of catalog) {
    const line = entry.description
      ? `${entry.tool_name} (${entry.description})`
      : entry.tool_name
    const existing = byServer.get(entry.server_name)
    if (existing) existing.tools.push(line)
    else byServer.set(entry.server_name, { server_id: entry.server_id, tools: [line] })
  }

  const lines = [...byServer.entries()].map(
    ([name, { server_id, tools }]) => `- ${name} (config.server_id="${server_id}"): ${tools.join(', ')}`,
  )

  return `AVAILABLE MCP TOOLS (use mcp_tool with config.server_id, config.tool_name, config.arguments):
${lines.join('\n')}`
}

const WORKSPACE_TABLE_CAP = 30

export interface WorkspaceToolchainConfig {
  configuredTypes: Set<string>
  enabledTables: string[]
  mcpCatalog: McpToolCatalogEntry[]
}

/** Compact always-on inventory of active integrations, tables, and MCP tools. */
export function buildWorkspaceToolchainBlock(config: WorkspaceToolchainConfig): string {
  const integrationLabels = INTEGRATION_DEFS
    .filter((d) => config.configuredTypes.has(d.integrationType))
    .map((d) => d.label)

  const integrationsLine = integrationLabels.length > 0
    ? integrationLabels.join(', ')
    : '(none — connect in Integrations Hub)'

  let tablesLine: string
  if (config.enabledTables.length === 0) {
    tablesLine = '(none enabled — i420 Settings → Data Sources)'
  } else if (config.enabledTables.length <= WORKSPACE_TABLE_CAP) {
    tablesLine = config.enabledTables.join(', ')
  } else {
    const extra = config.enabledTables.length - WORKSPACE_TABLE_CAP
    tablesLine = `${config.enabledTables.slice(0, WORKSPACE_TABLE_CAP).join(', ')} … (+${extra} more)`
  }

  let mcpLine: string
  if (config.mcpCatalog.length === 0) {
    mcpLine = '(none registered — i420 Settings → MCP Servers)'
  } else {
    const byServer = new Map<string, string[]>()
    for (const entry of config.mcpCatalog) {
      const list = byServer.get(entry.server_name) ?? []
      list.push(entry.tool_name)
      byServer.set(entry.server_name, list)
    }
    mcpLine = [...byServer.entries()]
      .map(([name, tools]) => `${name} → ${tools.join(', ')}`)
      .join('; ')
  }

  return `WORKSPACE TOOLCHAIN (available — use only what the user intent requires):
- Integrations: ${integrationsLine}
- Enabled tables (${config.enabledTables.length}, db_query must use one of these): ${tablesLine}
- MCP tools: ${mcpLine}

Listing a table or tool means it is AVAILABLE, not REQUIRED. Match workflow type to params (see CLARIFICATION PRINCIPLES).`
}

// ── Compiler kernel: node catalog, config guidelines, action modes ───────────

type NodeCatalogEntry = { type: string; description: string; category: string }

const NODE_CATALOG: NodeCatalogEntry[] = [
  // Triggers
  { type: 'cron_trigger', category: 'Triggers', description: 'Run on a recurring cron schedule' },
  { type: 'webhook_trigger', category: 'Triggers', description: 'HTTP POST webhook starts the flow' },
  { type: 'manual_trigger', category: 'Triggers', description: 'User starts the flow manually' },
  { type: 'db_trigger', category: 'Triggers', description: 'Row INSERT / UPDATE / DELETE on a DB table' },
  { type: 'crm_event_trigger', category: 'Triggers', description: 'CRM platform event (deal created, contact updated, etc.)' },
  // Logic
  { type: 'condition', category: 'Logic', description: 'Branch YES / NO based on a variable comparison' },
  { type: 'switch', category: 'Logic', description: 'Route to multiple named branches based on a value' },
  { type: 'loop', category: 'Logic', description: 'Iterate over an array variable' },
  { type: 'delay', category: 'Logic', description: 'Pause execution for N seconds' },
  // AI
  { type: 'openai_llm', category: 'AI', description: 'Call OpenAI GPT models' },
  { type: 'gemini_llm', category: 'AI', description: 'Call Google Gemini models' },
  { type: 'anthropic_llm', category: 'AI', description: 'Call Anthropic Claude models' },
  { type: 'custom_llm', category: 'AI', description: 'Call a custom LLM endpoint' },
  // Tools
  { type: 'db_query', category: 'Tools', description: 'SELECT rows from a Supabase table' },
  { type: 'api_call', category: 'Tools', description: 'HTTP REST / GraphQL request to an external URL' },
  { type: 'email_send', category: 'Tools', description: 'Send a transactional email' },
  { type: 'slack_notify', category: 'Tools', description: 'Post a message to a Slack channel' },
  { type: 'slack_fetch_messages', category: 'Tools', description: 'Fetch recent messages from a Slack channel' },
  { type: 'gmail_fetch_unread', category: 'Tools', description: 'Fetch unread emails from Gmail inbox' },
  { type: 'crm_update', category: 'Tools', description: 'UPDATE a CRM record (HubSpot, GoHighLevel, etc.)' },
  { type: 'mcp_tool', category: 'Tools', description: 'Execute a registered MCP server tool' },
  // Outputs
  { type: 'dashboard_write', category: 'Outputs', description: 'Push metrics or data to the internal dashboard' },
  { type: 'email_output', category: 'Outputs', description: 'Email a formatted report to recipients' },
  { type: 'db_write', category: 'Outputs', description: 'INSERT / UPDATE rows in a Supabase table' },
  { type: 'report_generate', category: 'Outputs', description: 'Generate a formatted PDF / markdown report' },
]

const CONFIG_GUIDELINES: Record<string, string> = {
  cron_trigger: '{ "schedule": "0 3 * * *", "timezone_label": "Asia/Dhaka 09:00" }',
  webhook_trigger: '{}',
  manual_trigger: '{}',
  db_trigger: '{ "table": "clients", "event": "INSERT" }',
  crm_event_trigger: '{ "event_type": "deal.created" }',
  condition: '{ "input_variable": "{{lead_score}}", "operator": ">=", "threshold": 80 }',
  switch: '{ "input_variable": "mode", "cases": { "report": "report", "chat": "chat" } }',
  loop: '{ "items_variable": "{{rows}}" }',
  delay: '{ "seconds": 30 }',
  openai_llm: '{ "model": "gpt-4o-mini", "system_prompt": "...", "prompt": "{{variable}}", "temperature": 0.3, "max_tokens": 1000 }',
  gemini_llm: '{ "model": "gemini-1.5-flash", "prompt": "{{variable}}" }',
  anthropic_llm: '{ "model": "claude-3-haiku-20240307", "prompt": "{{variable}}" }',
  custom_llm: '{ "prompt": "{{variable}}" }',
  db_query: '{ "table": "clients", "limit": 50 }',
  api_call: '{ "url": "https://api.example.com/data", "method": "GET" }',
  email_send: '{ "to": "{{recipient}}", "subject": "...", "body": "{{content}}" }',
  slack_fetch_messages: '{ "channel": "C0BCJ27UQHG", "limit": 25 }',
  slack_notify: '{ "channel": "#alerts", "message": "{{summary}}" }',
  gmail_fetch_unread: '{ "max_results": 25 }',
  crm_update: '{ "table": "deals", "id_variable": "{{deal_id}}" }',
  mcp_tool: '{ "server_id": "<uuid>", "tool_name": "echo", "arguments": { "text": "{{input}}" } }',
  dashboard_write: '{ "title": "Weekly Summary", "content": "{{n3.result}}" }',
  email_output: '{ "to": "{{recipient}}", "subject": "Report" }',
  db_write: '{ "table": "audit_logs" }',
  report_generate: '{ "title": "Agent Report", "content": "{{n3.result}}" }',
}

const CATALOG_CATEGORY_ORDER = ['Triggers', 'Logic', 'AI', 'Tools', 'Outputs']

/** Categorized node catalog filtered to workspace-allowed types. */
export function buildNodeCatalogBlock(allowedNodeTypes: string[]): string {
  const allowed = new Set(allowedNodeTypes)
  const sections: string[] = []

  for (const category of CATALOG_CATEGORY_ORDER) {
    const entries = NODE_CATALOG.filter((n) => n.category === category && allowed.has(n.type))
    if (entries.length === 0) continue
    const lines = entries.map((n) => `  ${n.type.padEnd(22)} – ${n.description}`)
    sections.push(`${category} (placed in "trigger" for triggers, "steps" for all others):\n${lines.join('\n')}`)
  }

  if (sections.length === 0) {
    return 'VALID NODE TYPES: (none configured — connect integrations in Integrations Hub first)'
  }

  return `VALID NODE TYPES (use ONLY these exact type strings):\n\n${sections.join('\n\n')}`
}

/** Per-type config field examples for allowed node types. */
export function buildConfigGuidelinesBlock(allowedNodeTypes: string[]): string {
  const allowed = new Set(allowedNodeTypes)
  const lines: string[] = []

  for (const entry of NODE_CATALOG) {
    if (!allowed.has(entry.type)) continue
    const example = CONFIG_GUIDELINES[entry.type]
    if (example) lines.push(`  ${entry.type.padEnd(22)} → ${example}`)
  }

  if (lines.length === 0) return ''

  return `CONFIG FIELD GUIDELINES (each node needs id, type, label, config, position):
Use {{variable_name}} for dynamic values referencing previous node outputs.

${lines.join('\n')}`
}

/** Full Smart IDE wrapper + minimal flow shape example. */
export function buildFlowShapeExampleBlock(): string {
  return `OUTPUT FORMAT EXAMPLE (return ONLY valid JSON — no markdown fences):

{
  "user_message": "Built a daily Slack digest: cron at 09:00 Asia/Dhaka, fetches #general, summarizes with GPT, posts back to Slack.",
  "clarification_needed": false,
  "flow": {
    "trigger": {
      "id": "n1",
      "type": "cron_trigger",
      "label": "Daily 09:00 Asia/Dhaka",
      "config": { "schedule": "0 3 * * *", "timezone_label": "Asia/Dhaka 09:00" },
      "position": { "x": 0, "y": 200 }
    },
    "steps": [
      {
        "id": "n2",
        "type": "slack_fetch_messages",
        "label": "Fetch channel messages",
        "config": { "channel": "C0BCJ27UQHG", "limit": 25 },
        "position": { "x": 220, "y": 200 }
      },
      {
        "id": "n3",
        "type": "openai_llm",
        "label": "Summarize messages",
        "config": {
          "model": "gpt-4o-mini",
          "system_prompt": "Summarize Slack messages concisely.",
          "prompt": "Messages:\\n{{messages}}",
          "temperature": 0.3,
          "max_tokens": 1000
        },
        "position": { "x": 440, "y": 200 }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2" },
      { "id": "e2", "source": "n2", "target": "n3" }
    ]
  }
}

When clarifying (no flow yet):
{
  "user_message": "Which Slack channel should I read from? (channel ID like C0ABC123 or #channel-name)",
  "clarification_needed": true,
  "flow": null
}`
}

export type CompileActionMode = 'generate' | 'improve' | 'add_tool'

/** Action mode instructions (generate / improve / add_tool). */
export function buildActionModeBlock(action: CompileActionMode | string): string {
  const mode = action === 'improve' || action === 'add_tool' ? action : 'generate'

  const modes: Record<CompileActionMode, string> = {
    generate: `ACTION MODE: generate
Build a complete new flow from scratch based on the user's description.
If CURRENT FLOW STATE is appended below, treat it as reference only unless the user asks to modify it.`,
    improve: `ACTION MODE: improve
Modify the CURRENT FLOW (appended below) to incorporate the user's requested change.
Preserve all nodes and edges NOT mentioned in the request — only alter what was asked.
Return the full updated flow inside the "flow" key.`,
    add_tool: `ACTION MODE: add_tool
Append a new tool/step node to the CURRENT FLOW at the most logical position.
Do NOT remove existing nodes. Wire new edges correctly. Return the full updated flow.`,
  }

  return modes[mode]
}

export function validateMcpToolNodes(
  flow: { trigger: unknown; steps: Array<{ type: string; config: Record<string, unknown> }> },
  catalog: McpToolCatalogEntry[],
): { valid: boolean; error?: string } {
  const allNodes = [
    ...(flow.trigger ? [flow.trigger as { type: string; config: Record<string, unknown> }] : []),
    ...flow.steps,
  ]
  const mcpNodes = allNodes.filter((n) => n.type === 'mcp_tool')
  if (mcpNodes.length === 0) return { valid: true }
  if (catalog.length === 0) {
    return {
      valid: false,
      error: 'mcp_tool nodes require registered MCP servers. Add servers in Agent Builder → Settings → MCP Servers.',
    }
  }

  const catalogSet = new Set(catalog.map((c) => `${c.server_id}::${c.tool_name}`))

  for (const node of mcpNodes) {
    const serverId = String(node.config?.server_id ?? '').trim()
    const toolName = String(node.config?.tool_name ?? '').trim()
    if (!serverId || !toolName) {
      return { valid: false, error: 'mcp_tool node requires config.server_id and config.tool_name' }
    }
    if (!catalogSet.has(`${serverId}::${toolName}`)) {
      return {
        valid: false,
        error: `mcp_tool references unknown server/tool (${serverId} / ${toolName}). Sync MCP servers in Settings.`,
      }
    }
  }

  return { valid: true }
}

// ── Smart IDE: persona sanitization & scoped context ─────────────────────────

const STRUCTURAL_PROMPT_MARKERS = [
  'VALID NODE TYPES',
  'STRUCTURAL RULES',
  'OUTPUT FORMAT',
  'you must respond with ONLY a valid JSON',
  'Return ONLY the JSON object',
]

/** Strip legacy structural rules from Settings persona prompt (persona-only). */
export function sanitizePersonaPrompt(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return null

  const upper = trimmed.toUpperCase()
  const hasStructural = STRUCTURAL_PROMPT_MARKERS.some((m) => upper.includes(m.toUpperCase()))
  if (!hasStructural) return trimmed

  const lines = trimmed.split('\n')
  const kept: string[] = []
  let skipBlock = false

  for (const line of lines) {
    const lineUpper = line.toUpperCase()
    if (STRUCTURAL_PROMPT_MARKERS.some((m) => lineUpper.includes(m.toUpperCase()))) {
      skipBlock = true
      continue
    }
    if (skipBlock && /^━+$/.test(line.trim())) {
      skipBlock = false
      continue
    }
    if (!skipBlock) kept.push(line)
  }

  const result = kept.join('\n').trim()
  return result || null
}

export function formatValidationAsQuestion(
  error: string,
  state: ConversationState,
  enabledTables: string[],
): string {
  const lower = error.toLowerCase()
  const slackOnly = hasWorkflowHint(state, 'slack') && !hasDbRelatedIntent(state)

  if (lower.includes('db_query') && slackOnly) {
    return 'I removed database steps from this Slack workflow. Rebuilding without db_query — if you still see this, say "no database" again.'
  }

  if (lower.includes('missing config.table') || lower.includes('which enabled table')) {
    if ((hasWorkflowHint(state, 'slack') || hasWorkflowHint(state, 'gmail')) && !hasDbRelatedIntent(state)) {
      return 'This flow should not need a database table. Try rephrasing without mentioning DB, or tell me which table if you do want database data.'
    }
    if (enabledTables.length === 1) {
      return `Should I query the "${enabledTables[0]}" table for this workflow?`
    }
    return `Which enabled data table should this workflow query? Options: ${enabledTables.slice(0, 8).join(', ')}${enabledTables.length > 8 ? '…' : ''}.`
  }

  if (lower.includes('enabled data sources')) {
    return 'No data tables are enabled. Open i420 Settings → Data Sources, enable at least one table, then try again.'
  }

  if (lower.includes('mcp_tool') || lower.includes('mcp server')) {
    return 'This flow needs an MCP tool. Register a server in i420 Settings → MCP Servers, or describe which tool you want to use.'
  }

  return `I couldn't validate the flow: ${error}. Can you clarify or rephrase?`
}

export function userExcludedDatabase(state: ConversationState): boolean {
  return state.userExclusions.length > 0
}

function shouldStripDbNodes(state: ConversationState): boolean {
  if (userExcludedDatabase(state)) return true
  if (hasDbRelatedIntent(state)) return false
  if (hasWorkflowHint(state, 'slack') || hasWorkflowHint(state, 'gmail') || hasWorkflowHint(state, 'mcp')) {
    return true
  }
  return false
}

/** Remove db nodes when user/intent excludes database access. */
export function stripNodesContradictingIntent<T extends {
  trigger: { type: string; id: string } | null
  steps: Array<{ id: string; type: string }>
  edges: Array<{ source: string; target: string; id?: string }>
}>(flow: T, state: ConversationState): T {
  if (!shouldStripDbNodes(state)) return flow

  const removedIds = new Set(
    flow.steps.filter((s) => s.type === 'db_query' || s.type === 'db_write').map((s) => s.id),
  )

  if (removedIds.size === 0) return flow

  const steps = flow.steps.filter((s) => !removedIds.has(s.id))
  const edges = flow.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target))

  return { ...flow, steps, edges } as T
}

/** Map 09:00 Asia/Dhaka to UTC cron (scheduler uses UTC). */
export function applyCronTimezoneDefaults<T extends {
  trigger: { type: string; config?: Record<string, unknown>; label?: string } | null
}>(flow: T, state: ConversationState): T {
  if (!flow.trigger || flow.trigger.type !== 'cron_trigger') return flow

  const config = { ...(flow.trigger.config ?? {}) }
  const tz = state.resolvedParams.timezone ?? ''
  const isBd = tz === 'Asia/Dhaka' || TIMEZONE_BD_RE.test(JSON.stringify(state.resolvedParams))

  if (isBd) {
    const schedule = String(config.schedule ?? config.cron_expression ?? '0 9 * * *')
    if (schedule === '0 9 * * *' || !config.schedule) {
      config.schedule = '0 3 * * *'
      config.timezone_label = 'Asia/Dhaka 09:00 (cron 03:00 UTC)'
    }
  }

  const label = flow.trigger.label ?? 'Scheduled trigger'
  const trigger = {
    ...flow.trigger,
    config,
    label: config.timezone_label ? `Daily ${config.timezone_label}` : label,
  }

  return { ...flow, trigger } as T
}

const FETCH_NODE_TYPES = new Set(['slack_fetch_messages', 'gmail_fetch_unread', 'db_query', 'api_call', 'mcp_tool'])
const LLM_TYPES = new Set(['openai_llm', 'gemini_llm', 'anthropic_llm', 'custom_llm'])
const ANTI_HALLUCINATION = 'Never invent data. If upstream messages, rows, or emails are empty or missing, output a short error report explaining the fetch failed — do not fabricate content.'

export function applyLlmAntiHallucinationGuards<T extends {
  steps: Array<{ type: string; config?: Record<string, unknown> }>
  edges: Array<{ source: string; target: string }>
}>(flow: T): T {
  const upstreamOf = new Map<string, Set<string>>()
  for (const edge of flow.edges) {
    if (!upstreamOf.has(edge.target)) upstreamOf.set(edge.target, new Set())
    upstreamOf.get(edge.target)!.add(edge.source)
  }

  const nodeById = new Map(flow.steps.map((s) => [(s as { id: string }).id, s]))

  const steps = flow.steps.map((step) => {
    if (!LLM_TYPES.has(step.type)) return step

    const stepId = (step as { id: string }).id
    const upstream = upstreamOf.get(stepId) ?? new Set()
    let followsFetch = false
    for (const upId of upstream) {
      const upNode = nodeById.get(upId)
      if (upNode && FETCH_NODE_TYPES.has(upNode.type)) {
        followsFetch = true
        break
      }
    }

    if (!followsFetch) return step

    const config = { ...(step.config ?? {}) }
    const system = String(config.system_prompt ?? '')
    if (!system.includes('Never invent')) {
      config.system_prompt = system ? `${system}\n\n${ANTI_HALLUCINATION}` : ANTI_HALLUCINATION
    }
    return { ...step, config }
  })

  return { ...flow, steps } as T
}

const OUTPUT_NODE_TYPES = new Set(['dashboard_write', 'report_generate'])
const LLM_NODE_TYPES_SET = new Set(['openai_llm', 'gemini_llm', 'anthropic_llm', 'custom_llm'])
const TEMPLATE_STRING_KEYS = ['content', 'message', 'body', 'title', 'prompt', 'system_prompt', 'subject'] as const

/** Fix {{nX.output}}/{{nX.text}} → {{nX.result}}; auto-wire dashboard content from upstream LLM */
export function normalizeOutputNodeTemplates<T extends {
  steps: Array<{ id: string; type: string; config?: Record<string, unknown> }>
  edges: Array<{ source: string; target: string }>
}>(flow: T): T {
  const upstreamOf = new Map<string, string[]>()
  for (const edge of flow.edges) {
    const list = upstreamOf.get(edge.target) ?? []
    list.push(edge.source)
    upstreamOf.set(edge.target, list)
  }

  const nodeById = new Map(flow.steps.map((s) => [s.id, s]))

  const findUpstreamLlmId = (nodeId: string): string | null => {
    const visited = new Set<string>()
    const queue = [...(upstreamOf.get(nodeId) ?? [])]
    let llmId: string | null = null
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const node = nodeById.get(id)
      if (node && LLM_NODE_TYPES_SET.has(node.type)) llmId = id
      queue.push(...(upstreamOf.get(id) ?? []))
    }
    return llmId
  }

  const fixTemplateString = (value: string): string =>
    value
      .replace(/\{\{([a-zA-Z0-9_]+)\.text\}\}/g, '{{$1.result}}')
      .replace(/\{\{([a-zA-Z0-9_]+)\.output\}\}/g, '{{$1.result}}')
      .replace(/\{\{([a-zA-Z0-9_]+)\.content\}\}/g, '{{$1.result}}')

  const steps = flow.steps.map((step) => {
    const config = { ...(step.config ?? {}) }

    for (const key of TEMPLATE_STRING_KEYS) {
      const val = config[key]
      if (typeof val === 'string') {
        config[key] = fixTemplateString(val)
      }
    }

    if (OUTPUT_NODE_TYPES.has(step.type)) {
      const content = config.content
      const llmId = findUpstreamLlmId(step.id)
      if (llmId && (content == null || String(content).trim() === '' || String(content).trim() === '{{result}}')) {
        config.content = `{{${llmId}.result}}`
      } else if (typeof content === 'string') {
        config.content = fixTemplateString(content)
      }
    }

    return { ...step, config }
  })

  return { ...flow, steps } as T
}

export function normalizeFlowForIntent<T extends {
  trigger: { type: string; config?: Record<string, unknown>; label?: string; id: string } | null
  steps: Array<{ id: string; type: string; config?: Record<string, unknown> }>
  edges: Array<{ source: string; target: string; id?: string }>
}>(flow: T, state: ConversationState): T {
  let result = stripNodesContradictingIntent(flow, state)
  result = applyCronTimezoneDefaults(result, state)
  result = applyLlmAntiHallucinationGuards(result)
  result = normalizeOutputNodeTemplates(result)
  return result
}

export function buildFlowSummaryMessage(
  flow: { trigger: { type: string; label?: string } | null; steps: Array<{ type: string; label?: string }> },
  setupHints: string[] = [],
): string {
  const nodeCount = flow.steps.length + (flow.trigger ? 1 : 0)
  const parts: string[] = [`Built a ${nodeCount}-node flow on the canvas.`]

  if (flow.trigger) {
    parts.push(`Trigger: ${flow.trigger.label ?? flow.trigger.type}.`)
  }

  const tools = flow.steps.filter((s) =>
    ['slack_fetch_messages', 'gmail_fetch_unread', 'db_query', 'mcp_tool', 'slack_notify', 'email_output'].includes(s.type),
  )
  if (tools.length) {
    parts.push(`Steps: ${tools.map((t) => t.label ?? t.type).join(' → ')}.`)
  }

  if (setupHints.length) {
    parts.push(`Before first run: ${setupHints.join(' ')}`)
  }

  parts.push('Click Run to test, or tell me what to change.')
  return parts.join(' ')
}

export function collectSetupHints(
  flow: { steps: Array<{ type: string }> },
  state: ConversationState,
): string[] {
  const hints: string[] = []
  const hasSlackFetch = flow.steps.some((s) => s.type === 'slack_fetch_messages')
  if (hasSlackFetch) {
    const ch = state.resolvedParams.slack_channel_id
    hints.push(ch
      ? `Invite your Slack bot to channel ${ch} (/invite @Bot).`
      : 'Invite your Slack bot to the target Slack channel (/invite @Bot).')
  }
  return hints
}
