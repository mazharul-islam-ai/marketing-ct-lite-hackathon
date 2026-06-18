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
  { integrationType: 'slack', label: 'Slack', nodeTypes: ['slack_notify'] },
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
  'api_call', 'email_send', 'slack_notify', 'crm_update',
  'gmail_fetch_unread', 'email_output',
] as const

export const COMPILE_PHASES = {
  checking_provider: 'Checking AI provider…',
  loading_integrations: 'Checking configured tools…',
  validating_tools: 'Validating tool availability…',
  loading_context: 'Loading flow context…',
  thinking: 'Thinking…',
  designing_flow: 'Designing workflow…',
  validating_flow: 'Validating flow structure…',
  saving_version: 'Saving new version…',
} as const

export type CompilePhase = keyof typeof COMPILE_PHASES

/** Keyword → required integration_type */
export const PROMPT_INTEGRATION_REQUIREMENTS: Array<{
  patterns: RegExp
  integrationType: string
  label: string
  configurePath: string
}> = [
  {
    patterns: /\b(unread\s+email|read\s+(my\s+)?email|gmail\s+inbox|fetch\s+email|email\s+inbox)\b/i,
    integrationType: 'gmail',
    label: 'Gmail',
    configurePath: '/adminpanel/integrations',
  },
  {
    patterns: /\b(slack|post\s+to\s+slack|notify\s+.*slack)\b/i,
    integrationType: 'slack',
    label: 'Slack',
    configurePath: '/adminpanel/integrations',
  },
  {
    patterns: /\b(send\s+(an?\s+)?email|email\s+(it|me|summary|report)|deliver\s+via\s+email)\b/i,
    integrationType: 'sendgrid',
    label: 'SendGrid or Resend',
    configurePath: '/adminpanel/integrations',
  },
  {
    patterns: /\b(activecollab|ac\s+tasks|project\s+tasks)\b/i,
    integrationType: 'activecollab',
    label: 'ActiveCollab',
    configurePath: '/adminpanel/integrations',
  },
  {
    patterns: /\b(hubspot|crm\s+deals|crm\s+contacts)\b/i,
    integrationType: 'hubspot',
    label: 'HubSpot',
    configurePath: '/adminpanel/integrations',
  },
]

export function getAllowedNodeTypes(configuredTypes: Set<string>): string[] {
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

  return [...allowed]
}

export function checkPromptIntegrations(
  prompt: string,
  configuredTypes: Set<string>,
): { missing: string; question: string } | null {
  for (const req of PROMPT_INTEGRATION_REQUIREMENTS) {
    if (!req.patterns.test(prompt)) continue

    if (req.integrationType === 'sendgrid') {
      if (!configuredTypes.has('sendgrid') && !configuredTypes.has('resend')) {
        return {
          missing: req.integrationType,
          question: `${req.label} is not configured. Go to Admin → Integrations Hub (${req.configurePath}) and connect an email provider (SendGrid or Resend), then try again.`,
        }
      }
      continue
    }

    if (!configuredTypes.has(req.integrationType)) {
      return {
        missing: req.integrationType,
        question: `${req.label} is not configured. Go to Admin → Integrations Hub (${req.configurePath}) and connect ${req.label}, then try again.`,
      }
    }
  }

  return null
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
- If delivery channel (email vs Slack vs dashboard) or schedule time is unspecified, ask ONE clarifying question.

CONFIGURED INTEGRATIONS (active in this workspace):
${configured || '(none — ask user to configure Integrations Hub first)'}

NOT CONFIGURED (do NOT use nodes requiring these):
${notConfigured || '(all platform integrations are configured)'}

DELIVERY OPTIONS (only if integration configured):
- email_output / email_send → requires SendGrid or Resend
- slack_notify → requires Slack
- dashboard_write / db_write / report_generate → always available`
}
