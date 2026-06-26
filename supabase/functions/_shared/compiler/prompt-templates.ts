import type { WorkflowSpec, FlowBlueprint, CompileTask } from './types.ts'

export function intentExtractionPrompt(toolchainSummary: string): string {
  return `You are the i420 workflow intent extractor. Convert the user request into a WorkflowSpec JSON.

WORKSPACE TOOLCHAIN (summary):
${toolchainSummary}

Output ONLY valid JSON matching WorkflowSpec:
{
  "workflow_type": "slack_digest|gmail_summary|db_report|hybrid|chat_agent|custom",
  "trigger": { "kind": "cron|manual|webhook", "schedule": "cron expr if cron", "timezone_label": "optional" },
  "modes": { "report": true, "chat": false },
  "integrations_required": ["slack","openai",...],
  "data_sources": { "tables": [], "excluded": false },
  "outputs": ["report_generate","slack_notify",...],
  "clarification_needed": false,
  "open_questions": [],
  "user_message": "natural language summary or one clarifying question"
}

If a required integration is missing, set clarification_needed true and put the question in user_message.
Use defaults: daily 09:00 Asia/Dhaka = schedule "0 3 * * *", dashboard output = dashboard_write.`
}

export function architecturePrompt(spec: WorkflowSpec, allowedNodes: string[]): string {
  return `You are the i420 architecture planner. Given WorkflowSpec, produce FlowBlueprint JSON.

ALLOWED NODE TYPES: ${allowedNodes.join(', ')}

SPEC:
${JSON.stringify(spec, null, 2)}

Output ONLY valid JSON:
{
  "trigger_node": { "type": "cron_trigger|manual_trigger|...", "label": "..." },
  "branches": [{ "name": "main|report|chat", "steps": ["node_type", ...] }],
  "dual_mode": { "switch_variable": "mode", "report_path": [...], "chat_path": [...] }
}

Chat+report dual mode: chat path must mirror fetch/tool nodes from report path.`
}

export function taskDecompositionPrompt(blueprint: FlowBlueprint): string {
  return `Decompose this FlowBlueprint into ordered CompileTask JSON array.

BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Output ONLY a JSON array:
[{ "id": "t1", "kind": "add_trigger|add_node|wire_edge|configure_node", "node_type": "...", "after": "n1", "source": "n2", "target": "n3", "acceptance": "..." }]`
}

export function assemblerPrompt(
  blueprint: FlowBlueprint,
  tasks: CompileTask[],
  allowedNodes: string[],
  currentFlowJson?: string,
): string {
  return `You are the i420 flow assembler. Build complete flow_json from blueprint and tasks.

ALLOWED NODES: ${allowedNodes.join(', ')}
BLUEPRINT: ${JSON.stringify(blueprint)}
TASKS: ${JSON.stringify(tasks)}
${currentFlowJson ? `CURRENT FLOW (merge/improve): ${currentFlowJson}` : ''}

Return JSON: { "user_message": "summary for user", "clarification_needed": false, "flow": { "trigger": {}, "steps": [], "edges": [] } }
Rules: trigger id n1, max 20 nodes, condition edges YES/NO, chat branch mirrors report fetch nodes.`
}

export function repairPrompt(
  blueprint: FlowBlueprint,
  validationError: string,
  brokenFlowJson: string,
): string {
  return `Fix the workflow JSON. Validation failed.

ERROR: ${validationError}
ARCHITECTURE: ${JSON.stringify(blueprint)}
BROKEN FLOW: ${brokenFlowJson}

Return ONLY fixed JSON: { "flow": { "trigger": {}, "steps": [], "edges": [] } }
Fix only what is necessary. Preserve valid nodes.`
}
