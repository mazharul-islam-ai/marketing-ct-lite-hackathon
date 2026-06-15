// ── Shared types for Agent Builder ──────────────────────────────────────────

export type NodeType =
  // Trigger
  | "cron_trigger" | "webhook_trigger" | "manual_trigger" | "db_trigger" | "crm_event_trigger"
  // Logic
  | "condition" | "switch" | "loop" | "delay"
  // AI
  | "openai_llm" | "gemini_llm" | "anthropic_llm" | "custom_llm"
  // Tool
  | "db_query" | "api_call" | "email_send" | "slack_notify" | "crm_update" | "mcp_tool"
  // Output
  | "dashboard_write" | "email_output" | "db_write" | "report_generate";

export type NodeCategory = "trigger" | "logic" | "ai" | "tool" | "output";

export interface NodeCategoryDef {
  id: NodeCategory;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface NodeTypeDef {
  type: NodeType;
  label: string;
  description: string;
  category: NodeCategory;
  configSchema: Record<string, ConfigField>;
}

export interface ConfigField {
  label: string;
  type: "text" | "textarea" | "select" | "number" | "boolean";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: unknown;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface FlowJSON {
  trigger: FlowNode | null;
  steps: FlowNode[];
  edges: FlowEdge[];
}

export interface Agent {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  current_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: number;
  flow_json: FlowJSON;
  published_by: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  version_id: string | null;
  triggered_by: string | null;
  trigger_type: "manual" | "cron" | "webhook" | "test";
  trigger_dev_run_id: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  total_cost: number;
  tokens_used: number;
  step_count: number;
  budget_limit: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RunStep {
  id: string;
  run_id: string;
  node_id: string;
  node_type: string;
  node_label: string | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  storage_ref: string | null;
  error: string | null;
  tokens_used: number;
  cost: number;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

// ── Node type registry ───────────────────────────────────────────────────────
export const NODE_CATEGORIES: NodeCategoryDef[] = [
  { id: "trigger",  label: "Triggers",   icon: "⏰", color: "text-amber-600",  bgColor: "bg-amber-50 border-amber-200" },
  { id: "logic",    label: "Logic",      icon: "◇",  color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200" },
  { id: "ai",       label: "AI Models",  icon: "🤖", color: "text-blue-600",   bgColor: "bg-blue-50 border-blue-200" },
  { id: "tool",     label: "Tools",      icon: "🔧", color: "text-green-600",  bgColor: "bg-green-50 border-green-200" },
  { id: "output",   label: "Outputs",    icon: "📤", color: "text-rose-600",   bgColor: "bg-rose-50 border-rose-200" },
];

export const NODE_TYPE_DEFS: NodeTypeDef[] = [
  // TRIGGERS
  {
    type: "cron_trigger", label: "Schedule", description: "Run on a cron schedule", category: "trigger",
    configSchema: { schedule: { label: "Cron Expression", type: "text", placeholder: "0 9 * * *", required: true } },
  },
  {
    type: "webhook_trigger", label: "Webhook", description: "Trigger via HTTP webhook", category: "trigger",
    configSchema: {},
  },
  {
    type: "manual_trigger", label: "Manual", description: "Trigger manually by user", category: "trigger",
    configSchema: {},
  },
  {
    type: "db_trigger", label: "DB Event", description: "Trigger on DB row change", category: "trigger",
    configSchema: {
      table: { label: "Table", type: "text", required: true },
      event: { label: "Event", type: "select", options: ["INSERT", "UPDATE", "DELETE"], required: true },
    },
  },
  {
    type: "crm_event_trigger", label: "CRM Event", description: "Trigger on CRM event", category: "trigger",
    configSchema: { event_type: { label: "Event Type", type: "text", required: true } },
  },
  // LOGIC
  {
    type: "condition", label: "Condition", description: "Branch based on condition", category: "logic",
    configSchema: {
      input_variable: { label: "Input Variable", type: "text", required: true },
      operator: { label: "Operator", type: "select", options: [">", ">=", "<", "<=", "=="], required: true },
      threshold: { label: "Threshold", type: "number", required: true },
    },
  },
  {
    type: "switch", label: "Switch", description: "Route to multiple branches", category: "logic",
    configSchema: { input_variable: { label: "Variable to Switch", type: "text", required: true } },
  },
  {
    type: "loop", label: "Loop", description: "Iterate over a list", category: "logic",
    configSchema: { items_variable: { label: "Items Variable", type: "text", required: true } },
  },
  {
    type: "delay", label: "Delay", description: "Pause for N seconds", category: "logic",
    configSchema: { seconds: { label: "Delay (seconds)", type: "number", defaultValue: 5 } },
  },
  // AI
  {
    type: "openai_llm", label: "OpenAI", description: "Call OpenAI GPT models", category: "ai",
    configSchema: {
      model: { label: "Model", type: "select", options: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"], defaultValue: "gpt-4o-mini" },
      system_prompt: { label: "System Prompt", type: "textarea" },
      prompt: { label: "User Prompt", type: "textarea", required: true, placeholder: "Use {{variable}} for dynamic values" },
      temperature: { label: "Temperature", type: "number", defaultValue: 0.3 },
      max_tokens: { label: "Max Tokens", type: "number", defaultValue: 1000 },
    },
  },
  {
    type: "gemini_llm", label: "Gemini", description: "Call Google Gemini models", category: "ai",
    configSchema: {
      model: { label: "Model", type: "select", options: ["gemini-1.5-flash", "gemini-1.5-pro"] },
      prompt: { label: "Prompt", type: "textarea", required: true },
    },
  },
  {
    type: "anthropic_llm", label: "Anthropic", description: "Call Anthropic Claude models", category: "ai",
    configSchema: {
      model: { label: "Model", type: "select", options: ["claude-3-haiku-20240307", "claude-3-sonnet-20240229"] },
      prompt: { label: "Prompt", type: "textarea", required: true },
    },
  },
  {
    type: "custom_llm", label: "Custom LLM", description: "Custom LLM endpoint", category: "ai",
    configSchema: {
      prompt: { label: "Prompt", type: "textarea", required: true },
    },
  },
  // TOOLS
  {
    type: "db_query", label: "DB Query", description: "Query Supabase table", category: "tool",
    configSchema: {
      table: { label: "Table", type: "text", required: true },
      limit: { label: "Row Limit", type: "number", defaultValue: 50 },
    },
  },
  {
    type: "api_call", label: "API Call", description: "HTTP REST/GraphQL request", category: "tool",
    configSchema: {
      url: { label: "URL", type: "text", required: true },
      method: { label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"], defaultValue: "GET" },
    },
  },
  {
    type: "email_send", label: "Send Email", description: "Send an email", category: "tool",
    configSchema: {
      to: { label: "To", type: "text", required: true },
      subject: { label: "Subject", type: "text", required: true },
      body: { label: "Body", type: "textarea", required: true },
    },
  },
  {
    type: "slack_notify", label: "Slack", description: "Post to Slack channel", category: "tool",
    configSchema: {
      webhook_url: { label: "Webhook URL", type: "text" },
      channel: { label: "Channel", type: "text", placeholder: "#general" },
      message: { label: "Message", type: "textarea", required: true, placeholder: "Use {{variable}} for dynamic values" },
    },
  },
  {
    type: "crm_update", label: "CRM Update", description: "Update a CRM record", category: "tool",
    configSchema: {
      table: { label: "Table", type: "text", required: true },
      id_variable: { label: "ID Variable", type: "text", required: true },
    },
  },
  {
    type: "mcp_tool", label: "MCP Tool", description: "Execute an MCP server tool", category: "tool",
    configSchema: { tool_name: { label: "Tool Name", type: "text", required: true } },
  },
  // OUTPUT
  {
    type: "db_write", label: "DB Write", description: "Write to a database table", category: "output",
    configSchema: { table: { label: "Table", type: "text", required: true } },
  },
  {
    type: "report_generate", label: "Report", description: "Generate a report", category: "output",
    configSchema: { title: { label: "Report Title", type: "text", defaultValue: "Agent Report" } },
  },
  {
    type: "dashboard_write", label: "Dashboard", description: "Push metrics to dashboard", category: "output",
    configSchema: { title: { label: "Dashboard Title", type: "text" } },
  },
  {
    type: "email_output", label: "Email Report", description: "Email a report to recipients", category: "output",
    configSchema: {
      to: { label: "To", type: "text", required: true },
      subject: { label: "Subject", type: "text", required: true },
    },
  },
];

export const getNodeDef = (type: NodeType): NodeTypeDef | undefined =>
  NODE_TYPE_DEFS.find((d) => d.type === type);

export const getCategoryDef = (category: NodeCategory): NodeCategoryDef | undefined =>
  NODE_CATEGORIES.find((c) => c.id === category);
