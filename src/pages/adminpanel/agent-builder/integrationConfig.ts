/**
 * Frontend mirror of supabase/functions/_shared/agent-builder-integrations.ts
 */

import type { NodeType } from "./types";

export interface IntegrationDef {
  integrationType: string;
  label: string;
  nodeTypes: NodeType[];
}

export const INTEGRATION_DEFS: IntegrationDef[] = [
  { integrationType: "gmail", label: "Gmail", nodeTypes: ["gmail_fetch_unread"] },
  { integrationType: "slack", label: "Slack", nodeTypes: ["slack_notify"] },
  { integrationType: "sendgrid", label: "SendGrid", nodeTypes: ["email_send", "email_output"] },
  { integrationType: "resend", label: "Resend", nodeTypes: ["email_send", "email_output"] },
  { integrationType: "activecollab", label: "ActiveCollab", nodeTypes: ["db_query"] },
  { integrationType: "hubspot", label: "HubSpot", nodeTypes: ["crm_update", "db_query"] },
  { integrationType: "gohighlevel", label: "GoHighLevel", nodeTypes: ["crm_update", "db_query"] },
  { integrationType: "google_drive", label: "Google Drive", nodeTypes: ["db_query"] },
  { integrationType: "n8n_analytics", label: "n8n", nodeTypes: ["api_call"] },
  { integrationType: "google_analytics", label: "Google Analytics", nodeTypes: ["api_call"] },
  { integrationType: "openai", label: "OpenAI", nodeTypes: ["openai_llm"] },
  { integrationType: "google_gemini", label: "Gemini", nodeTypes: ["gemini_llm"] },
  { integrationType: "anthropic", label: "Claude", nodeTypes: ["anthropic_llm"] },
];

export const ALWAYS_AVAILABLE_NODE_TYPES: NodeType[] = [
  "cron_trigger", "webhook_trigger", "manual_trigger", "db_trigger", "crm_event_trigger",
  "condition", "switch", "loop", "delay",
  "custom_llm",
  "db_query", "db_write",
  "dashboard_write", "report_generate",
];

export const COMPILE_PHASE_LABELS: Record<string, string> = {
  checking_provider: "Checking AI provider…",
  loading_integrations: "Checking configured tools…",
  validating_tools: "Validating tool availability…",
  loading_context: "Loading flow context…",
  thinking: "Thinking…",
  designing_flow: "Designing workflow…",
  validating_flow: "Validating flow structure…",
  saving_version: "Saving new version…",
};

export const COMPILE_PHASE_ORDER = [
  "checking_provider",
  "loading_integrations",
  "validating_tools",
  "loading_context",
  "thinking",
  "designing_flow",
  "validating_flow",
  "saving_version",
] as const;

export function getAllowedNodeTypes(configuredTypes: Set<string>): NodeType[] {
  const allowed = new Set<NodeType>(ALWAYS_AVAILABLE_NODE_TYPES);

  for (const def of INTEGRATION_DEFS) {
    if (configuredTypes.has(def.integrationType)) {
      for (const nt of def.nodeTypes) allowed.add(nt);
    }
  }

  if (configuredTypes.has("sendgrid") || configuredTypes.has("resend")) {
    allowed.add("email_send");
    allowed.add("email_output");
  }

  return [...allowed];
}

export interface PaletteItem {
  type: NodeType;
  label: string;
  requiresIntegration?: string;
}

export const FULL_PALETTE: Record<string, PaletteItem[]> = {
  "⏰ Triggers": [
    { type: "cron_trigger", label: "Schedule" },
    { type: "webhook_trigger", label: "Webhook" },
    { type: "manual_trigger", label: "Manual" },
  ],
  "🤖 AI Models": [
    { type: "openai_llm", label: "OpenAI", requiresIntegration: "openai" },
    { type: "gemini_llm", label: "Gemini", requiresIntegration: "google_gemini" },
    { type: "anthropic_llm", label: "Claude", requiresIntegration: "anthropic" },
  ],
  "🔧 Tools": [
    { type: "gmail_fetch_unread", label: "Gmail Unread", requiresIntegration: "gmail" },
    { type: "db_query", label: "DB Query" },
    { type: "api_call", label: "API Call", requiresIntegration: "n8n_analytics" },
    { type: "slack_notify", label: "Slack", requiresIntegration: "slack" },
    { type: "email_send", label: "Email", requiresIntegration: "sendgrid" },
  ],
  "◇ Logic": [
    { type: "condition", label: "Condition" },
    { type: "loop", label: "Loop" },
    { type: "delay", label: "Delay" },
  ],
  "📤 Outputs": [
    { type: "db_write", label: "DB Write" },
    { type: "email_output", label: "Email Output", requiresIntegration: "sendgrid" },
    { type: "report_generate", label: "Report" },
  ],
};

export function filterPalette(
  configuredTypes: Set<string>,
): Record<string, PaletteItem[]> {
  const hasEmail = configuredTypes.has("sendgrid") || configuredTypes.has("resend");
  const hasApi = configuredTypes.has("n8n_analytics") || configuredTypes.has("google_analytics");

  const result: Record<string, PaletteItem[]> = {};

  for (const [category, items] of Object.entries(FULL_PALETTE)) {
    const filtered = items.filter((item) => {
      if (!item.requiresIntegration) return true;
      if (item.requiresIntegration === "sendgrid") return hasEmail;
      if (item.requiresIntegration === "n8n_analytics") return hasApi;
      return configuredTypes.has(item.requiresIntegration);
    });
    if (filtered.length > 0) result[category] = filtered;
  }

  return result;
}
