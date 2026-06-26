import { task } from "@trigger.dev/sdk";
import type { CompileTask, FlowBlueprint, PipelinePayload } from "./lib/types";
import { updateJobStage } from "./lib/supabase";
import { runDecomposeTasks } from "./lib/stages";

export const i420CompileMulti03DecomposeTasks = task({
  id: "i420-compile-multi-03-decompose-tasks",
  maxDuration: 300,
  run: async (payload: PipelinePayload & { blueprint: FlowBlueprint }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-03-decompose-tasks");
    const result = await runDecomposeTasks(payload, payload.blueprint);
    if (!result.ok) throw new Error(result.error ?? "Task decomposition failed");
    return { tasks: result.data as CompileTask[] };
  },
});
