import { task, logger } from "@trigger.dev/sdk";
import type { PipelinePayload } from "./lib/types";
import { updateJobStage } from "./lib/supabase";
import { runExtractIntent } from "./lib/stages";

export const i420CompileMulti01ExtractIntent = task({
  id: "i420-compile-multi-01-extract-intent",
  maxDuration: 300,
  run: async (payload: PipelinePayload) => {
    await updateJobStage(payload.compile_job_id, "i420-compile-multi-01-extract-intent");
    const result = await runExtractIntent(payload);
    if (!result.ok) {
      return { success: false, clarification: result.clarification, spec: null };
    }
    return { success: true, spec: result.data };
  },
});
