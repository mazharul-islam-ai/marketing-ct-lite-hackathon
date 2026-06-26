import { task, logger } from "@trigger.dev/sdk";
import type { CompileArtifacts, FlowJSON, PipelinePayload } from "./lib/types";
import { getServiceClient } from "./lib/supabase";
import {
  loadPipelineContext,
  saveCompiledVersion,
} from "./lib/stages";
import { finalizeCompiledFlow, buildFlowSummaryMessage } from "./lib/finalize-flow";
import { i420CompileMulti01ExtractIntent } from "./multi-01-extract-intent";
import { i420CompileMulti02PlanArchitecture } from "./multi-02-plan-architecture";
import { i420CompileMulti03DecomposeTasks } from "./multi-03-decompose-tasks";
import { i420CompileMulti04AssembleFlow } from "./multi-04-assemble-flow";
import { i420CompileMulti05ValidateFlow } from "./multi-05-validate-flow";
import { i420CompileMulti06RepairFlow } from "./multi-06-repair-flow";

export const i420CompileMultiRun = task({
  id: "i420-compile-multi-run",
  maxDuration: 1800,
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 1 },
  run: async (payload: PipelinePayload) => {
    const supabase = getServiceClient();
    const ctx = await loadPipelineContext(payload);

    await supabase
      .from("compile_jobs")
      .update({ status: "running", trigger_dev_run_id: payload.compile_job_id })
      .eq("id", payload.compile_job_id);

    // Stage 01: Extract intent
    const intentResult = await i420CompileMulti01ExtractIntent.triggerAndWait(payload);
    if (!intentResult.ok) throw new Error(`Stage 01 failed: ${intentResult.error}`);
    if (!intentResult.output.success) {
      const clarification = intentResult.output.clarification ?? "Could you clarify?";
      await supabase.from("compile_jobs").update({
        status: "clarification",
        user_message: clarification,
        completed_at: new Date().toISOString(),
      }).eq("id", payload.compile_job_id);
      return { success: false, needs_clarification: true, question: clarification };
    }

    const spec = intentResult.output.spec!;

    // Stage 02: Plan architecture
    const archResult = await i420CompileMulti02PlanArchitecture.triggerAndWait({
      ...payload,
      spec,
      allowed_nodes: ctx.allowedNodes,
    });
    if (!archResult.ok) throw new Error(`Stage 02 failed: ${archResult.error}`);
    const blueprint = archResult.output.blueprint;

    // Stage 03: Decompose tasks
    const tasksResult = await i420CompileMulti03DecomposeTasks.triggerAndWait({
      ...payload,
      blueprint,
    });
    if (!tasksResult.ok) throw new Error(`Stage 03 failed: ${tasksResult.error}`);
    const tasks = tasksResult.output.tasks;

    // Stage 04: Assemble flow
    const assembleResult = await i420CompileMulti04AssembleFlow.triggerAndWait({
      ...payload,
      blueprint,
      tasks,
      allowed_nodes: ctx.allowedNodes,
      current_flow: ctx.currentFlow,
      spec,
      enabled_tables: ctx.enabledTables,
      conversation_state: ctx.conversationState,
    });
    if (!assembleResult.ok) throw new Error(`Stage 04 failed: ${assembleResult.error}`);
    let flow = assembleResult.output.flow as FlowJSON;
    let userMessage = assembleResult.output.user_message ?? "Flow updated.";

    // Stage 05 + 06: Validate with repair loop
    const { data: compilerCfg } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("integration_type", "agent_builder_compiler")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const maxRepairs = (compilerCfg?.config as { repair_max_attempts?: number })?.repair_max_attempts ?? 2;

    for (let attempt = 0; attempt <= maxRepairs; attempt++) {
      const validateResult = await i420CompileMulti05ValidateFlow.triggerAndWait({
        compile_job_id: payload.compile_job_id,
        flow,
        allowed_nodes: ctx.allowedNodes,
        spec,
        enabled_tables: ctx.enabledTables,
      });
      if (!validateResult.ok) throw new Error(`Stage 05 failed: ${validateResult.error}`);

      if (validateResult.output.valid) {
        flow = validateResult.output.flow as FlowJSON;
        break;
      }

      if (attempt >= maxRepairs) {
        const err = validateResult.output.error ?? "Validation failed";
        await supabase.from("compile_jobs").update({
          status: "failed",
          error_message: err,
          completed_at: new Date().toISOString(),
        }).eq("id", payload.compile_job_id);
        return { success: false, message: err };
      }

      const repairResult = await i420CompileMulti06RepairFlow.triggerAndWait({
        ...payload,
        blueprint,
        flow,
        validation_error: validateResult.output.error ?? "Invalid flow",
        allowed_nodes: ctx.allowedNodes,
        spec,
      });
      if (!repairResult.ok) throw new Error(`Stage 06 failed: ${repairResult.error}`);
      flow = repairResult.output.flow as FlowJSON;
    }

    flow = finalizeCompiledFlow(flow, {
      spec,
      enabledTables: ctx.enabledTables,
      allowedNodes: ctx.allowedNodes,
      conversationState: ctx.conversationState,
      configuredIntegrations: ctx.configuredTypes,
    });
    userMessage = buildFlowSummaryMessage(flow);

    const artifacts: CompileArtifacts = {
      spec,
      blueprint,
      tasks,
      compiler_mode: "multi_stage",
      updated_at: new Date().toISOString(),
    };

    const saved = await saveCompiledVersion(payload, flow, userMessage, artifacts);

    await supabase.from("compile_jobs").update({
      status: "completed",
      flow_json: flow,
      user_message: userMessage,
      version_id: saved.version_id,
      version_number: saved.version,
      compile_artifacts: artifacts,
      completed_at: new Date().toISOString(),
    }).eq("id", payload.compile_job_id);

    logger.info("i420-compile-multi-run completed", {
      compile_job_id: payload.compile_job_id,
      version: saved.version,
    });

    return {
      success: true,
      flow_json: flow,
      version_id: saved.version_id,
      version: saved.version,
      user_message: userMessage,
      ai_message: userMessage,
      compiler: { mode: "multi_stage" },
    };
  },
});
