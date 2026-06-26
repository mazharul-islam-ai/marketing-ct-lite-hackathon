import { task } from "@trigger.dev/sdk";
import type { FlowBlueprint, PipelinePayload, WorkflowSpec } from "./lib/types";
import { updateJobStage } from "./lib/supabase";
import { runPlanArchitecture } from "./lib/stages";

export const i420CompileMulti02PlanArchitecture = task({
  id: "i420-compile-multi-02-plan-architecture",
  maxDuration: 300,
  run: async (payload: PipelinePayload & { spec: WorkflowSpec; allowed_nodes: string[] }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-02-plan-architecture");
    const result = await runPlanArchitecture(payload, payload.spec, payload.allowed_nodes);
    if (!result.ok) throw new Error(result.error ?? "Architecture planning failed");
    return { blueprint: result.data as FlowBlueprint };
  },
});
