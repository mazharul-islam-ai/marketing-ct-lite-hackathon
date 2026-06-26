import { task } from "@trigger.dev/sdk";
import type { FlowJSON, WorkflowSpec } from "./lib/types";
import { updateJobStage } from "./lib/supabase";
import { runValidateFlow } from "./lib/stages";

export const i420CompileMulti05ValidateFlow = task({
  id: "i420-compile-multi-05-validate-flow",
  maxDuration: 60,
  run: async (payload: {
    compile_job_id: string
    flow: FlowJSON
    allowed_nodes: string[]
    spec?: WorkflowSpec
    enabled_tables?: string[]
  }) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-05-validate-flow");
    const result = runValidateFlow(payload.flow, payload.allowed_nodes, {
      spec: payload.spec,
      enabledTables: payload.enabled_tables,
    });
    if (!result.ok) {
      return { valid: false, error: result.error, flow: payload.flow };
    }
    return { valid: true, flow: result.data as FlowJSON };
  },
});
