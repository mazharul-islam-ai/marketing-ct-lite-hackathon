import { task } from "@trigger.dev/sdk";
import type { CompileTask, FlowBlueprint, FlowJSON, PipelinePayload, WorkflowSpec } from "./lib/types";
import type { ConversationState } from "./lib/conversation-state";
import { updateJobStage } from "./lib/supabase";
import { runAssembleFlow } from "./lib/stages";

export const i420CompileMulti04AssembleFlow = task({
  id: "i420-compile-multi-04-assemble-flow",
  maxDuration: 600,
  run: async (payload: PipelinePayload & {
    blueprint: FlowBlueprint
    tasks: CompileTask[]
    allowed_nodes: string[]
    current_flow: FlowJSON | null
    spec: WorkflowSpec
    enabled_tables: string[]
    conversation_state?: ConversationState
  }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-04-assemble-flow");
    const result = await runAssembleFlow(
      payload,
      payload.blueprint,
      payload.tasks,
      payload.allowed_nodes,
      payload.current_flow,
      payload.spec,
      payload.enabled_tables,
      payload.conversation_state,
    );
    if (!result.ok || !result.data) throw new Error(result.error ?? "Assembly failed");
    return result.data;
  },
});
