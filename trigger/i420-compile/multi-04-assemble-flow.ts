import { task } from "@trigger.dev/sdk";
import type { CompileTask, FlowBlueprint, FlowJSON, PipelinePayload } from "./lib/types";
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
  }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-04-assemble-flow");
    const result = await runAssembleFlow(
      payload,
      payload.blueprint,
      payload.tasks,
      payload.allowed_nodes,
      payload.current_flow,
    );
    if (!result.ok || !result.data) throw new Error(result.error ?? "Assembly failed");
    return result.data;
  },
});
