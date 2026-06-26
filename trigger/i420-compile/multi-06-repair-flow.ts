import { task } from "@trigger.dev/sdk";
import type { FlowBlueprint, FlowJSON, PipelinePayload, WorkflowSpec } from "./lib/types";
import { updateJobStage } from "./lib/supabase";
import { runRepairFlow } from "./lib/stages";

export const i420CompileMulti06RepairFlow = task({
  id: "i420-compile-multi-06-repair-flow",
  maxDuration: 600,
  run: async (payload: PipelinePayload & {
    blueprint: FlowBlueprint
    flow: FlowJSON
    validation_error: string
    allowed_nodes?: string[]
    spec?: WorkflowSpec
  }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-06-repair-flow");
    const result = await runRepairFlow(
      payload,
      payload.blueprint,
      payload.flow,
      payload.validation_error,
      payload.allowed_nodes ?? [],
      payload.spec,
    );
    if (!result.ok || !result.data) throw new Error(result.error ?? "Repair failed");
    return { flow: result.data };
  },
});
