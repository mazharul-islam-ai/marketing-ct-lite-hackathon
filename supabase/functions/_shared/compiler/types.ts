export type CompilerMode = 'single' | 'multi_stage'

export type WorkflowType =
  | 'slack_digest'
  | 'gmail_summary'
  | 'db_report'
  | 'hybrid'
  | 'chat_agent'
  | 'custom'

export interface WorkflowSpec {
  workflow_type: WorkflowType
  trigger: {
    kind: 'cron' | 'manual' | 'webhook'
    schedule?: string
    timezone_label?: string
  }
  modes: { report: boolean; chat: boolean }
  integrations_required: string[]
  data_sources: { tables: string[]; excluded: boolean }
  outputs: string[]
  clarification_needed: boolean
  open_questions: string[]
  user_message?: string
}

export interface FlowBlueprint {
  trigger_node: { type: string; label?: string }
  branches: Array<{ name: string; steps: string[] }>
  dual_mode?: {
    switch_variable: string
    report_path: string[]
    chat_path: string[]
  }
}

export type CompileTaskKind =
  | 'add_trigger'
  | 'add_node'
  | 'wire_edge'
  | 'configure_node'

export interface CompileTask {
  id: string
  kind: CompileTaskKind
  node_type?: string
  after?: string
  source?: string
  target?: string
  acceptance: string
}

export interface CompileArtifacts {
  spec?: WorkflowSpec
  blueprint?: FlowBlueprint
  tasks?: CompileTask[]
  compiler_mode?: CompilerMode
  updated_at?: string
}

export interface FlowNode {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export interface FlowJSON {
  trigger: FlowNode | null
  steps: FlowNode[]
  edges: FlowEdge[]
  metadata?: {
    supports_chat?: boolean
    supports_report?: boolean
  }
}

export interface CompileJobPayload {
  compile_job_id: string
  agent_id: string
  user_id: string
  prompt: string
  action?: string
  auth_token?: string
}

export interface StageContext {
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>
  agent_id: string
  user_id: string
  prompt: string
  action: string
  chatHistory: Array<{ role: string; content: string }>
  configuredTypes: Set<string>
  allowedNodeTypes: string[]
  enabledTables: string[]
  mcpCatalog: import('../agent-builder-integrations.ts').McpToolCatalogEntry[]
  currentFlow: FlowJSON | null
  artifacts: CompileArtifacts
  compilerConfig: { provider: string; model: string; apiKey: string }
}

export const STAGE_IDS = {
  orchestrator: 'i420-compile-multi-run',
  extractIntent: 'i420-compile-multi-01-extract-intent',
  planArchitecture: 'i420-compile-multi-02-plan-architecture',
  decomposeTasks: 'i420-compile-multi-03-decompose-tasks',
  assembleFlow: 'i420-compile-multi-04-assemble-flow',
  validateFlow: 'i420-compile-multi-05-validate-flow',
  repairFlow: 'i420-compile-multi-06-repair-flow',
} as const

export const STAGE_TO_PHASE: Record<string, string> = {
  [STAGE_IDS.extractIntent]: 'extracting_intent',
  [STAGE_IDS.planArchitecture]: 'planning_architecture',
  [STAGE_IDS.decomposeTasks]: 'decomposing_tasks',
  [STAGE_IDS.assembleFlow]: 'assembling_flow',
  [STAGE_IDS.validateFlow]: 'validating_flow',
  [STAGE_IDS.repairFlow]: 'repairing_flow',
}
