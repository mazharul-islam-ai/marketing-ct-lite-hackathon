export type WorkflowType =
  | 'slack_digest' | 'gmail_summary' | 'db_report' | 'hybrid' | 'chat_agent' | 'custom'

export interface WorkflowSpec {
  workflow_type: WorkflowType
  trigger: { kind: 'cron' | 'manual' | 'webhook'; schedule?: string; timezone_label?: string }
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
  dual_mode?: { switch_variable: string; report_path: string[]; chat_path: string[] }
}

export interface CompileTask {
  id: string
  kind: 'add_trigger' | 'add_node' | 'wire_edge' | 'configure_node'
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
  compiler_mode?: string
  updated_at?: string
}

export interface FlowJSON {
  trigger: Record<string, unknown> | null
  steps: Record<string, unknown>[]
  edges: Record<string, unknown>[]
  metadata?: Record<string, unknown>
}

export interface PipelinePayload {
  compile_job_id: string
  agent_id: string
  user_id: string
  prompt: string
  action?: string
}

export interface StageResult<T> {
  ok: boolean
  data?: T
  clarification?: string
  usage?: { promptTokens: number; completionTokens: number }
  error?: string
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
