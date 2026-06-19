import { task, metadata, AbortTaskRunError, logger } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { executeFlowNode, type NodeExecutionPayload } from "./execute-node";
import { ensureChatContext, LLM_NODE_TYPES } from "./chat-context";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAX_STEPS = 20;
const DEFAULT_BUDGET = 5.0;

export interface AgentRunPayload {
  run_id: string;
  agent_id: string;
  version_id: string;
  flow_json: {
    trigger: FlowNode | null;
    steps: FlowNode[];
    edges: FlowEdge[];
  };
  input_context?: Record<string, unknown>;
  budget_limit?: number;
  triggered_by?: string | null;
  trigger_type?: string;
}

interface FlowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

// ── Main agent run executor ──────────────────────────────────────────────────
export const executeAgentRun = task({
  id: "execute-agent-run",
  maxDuration: 3600,
  queue: {
    concurrencyLimit: 10,
  },
  retry: {
    maxAttempts: 1,
  },
  onFailure: async ({ payload, error }: { payload: AgentRunPayload; error: unknown }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const { createClient: createFreshClient } = await import("@supabase/supabase-js");
    const supabase = createFreshClient(url, key);
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
      })
      .eq("id", payload.run_id)
      .in("status", ["queued", "running"]);
  },
  run: async (payload: AgentRunPayload) => {
    const {
      run_id,
      agent_id,
      flow_json,
      input_context = {},
      budget_limit = DEFAULT_BUDGET,
    } = payload;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in the Trigger.dev dashboard under Environment Variables.",
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    logger.info("execute-agent-run starting", { run_id, agent_id });

    // Idempotency guard: only proceed if the run is still in 'queued' state.
    // This prevents double-execution when a pgmq fallback triggers a second instance
    // while the first (direct Trigger.dev dispatch) is already running.
    const { data: claimedRun, error: claimErr } = await supabase
      .from("agent_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", run_id)
      .in("status", ["queued"])
      .select("id")
      .maybeSingle();

    if (claimErr) {
      logger.error("Failed to claim run", { error: claimErr.message, code: claimErr.code });
      throw new Error(`Failed to claim run: ${claimErr.message}`);
    }

    if (!claimedRun) {
      logger.warn("Run already claimed by another instance — aborting", { run_id });
      return { run_id, status: "skipped", message: "Run already being processed by another worker" };
    }

    // Build ordered execution list: trigger node (if any) + steps
    const allNodes: FlowNode[] = [
      ...(flow_json.trigger ? [flow_json.trigger] : []),
      ...flow_json.steps,
    ];

    const totalSteps = allNodes.length;

    if (totalSteps === 0) {
      await finalizeRun(supabase, run_id, "completed", 0, 0, 0);
      return { run_id, status: "completed", message: "Empty flow — nothing to execute" };
    }

    // Initialize metadata for realtime frontend tracking
    metadata.set("status", "running");
    metadata.set("progress", 0);
    metadata.set("totalSteps", totalSteps);
    metadata.set("currentNode", allNodes[0].id);
    metadata.set("totalCost", 0);
    metadata.set("tokensUsed", 0);
    metadata.set("stepCount", 0);

    let totalCost = 0;
    let totalTokens = 0;
    let stepCount = 0;

    // Build edge lookup for branch routing
    const edgeMap = buildEdgeMap(flow_json.edges);

    // Execution context (accumulates outputs across steps)
    let executionContext: Record<string, unknown> = { ...input_context };

    // Track which nodes have been visited to prevent infinite loops
    const visitedNodes = new Set<string>();

    // Execution queue — start from the first node
    const executionQueue: { nodeId: string; inputData: Record<string, unknown> }[] = [
      { nodeId: allNodes[0].id, inputData: executionContext },
    ];

    // Node lookup
    const nodeById = new Map(allNodes.map((n) => [n.id, n]));

    while (executionQueue.length > 0) {
      // Step count guard
      stepCount++;
      if (stepCount > MAX_STEPS) {
        logger.error("Step limit exceeded", { run_id, stepCount });
        await finalizeRun(supabase, run_id, "failed", totalCost, totalTokens, stepCount,
          `Exceeded maximum step limit of ${MAX_STEPS}`);
        metadata.set("status", "failed");
        metadata.set("error", `Exceeded maximum step limit of ${MAX_STEPS}`);
        throw new AbortTaskRunError(`Flow exceeded ${MAX_STEPS} steps — possible infinite loop`);
      }

      // Budget guard
      if (totalCost >= (budget_limit ?? DEFAULT_BUDGET)) {
        logger.error("Budget exceeded", { run_id, totalCost, budget_limit });
        await finalizeRun(supabase, run_id, "failed", totalCost, totalTokens, stepCount,
          `Budget limit $${budget_limit} exceeded at $${totalCost.toFixed(4)}`);
        metadata.set("status", "failed");
        metadata.set("error", "Budget limit exceeded");
        throw new AbortTaskRunError(`Budget limit exceeded: $${totalCost.toFixed(4)} of $${budget_limit}`);
      }

      const { nodeId, inputData } = executionQueue.shift()!;

      // Skip if already visited (loop prevention)
      if (visitedNodes.has(nodeId)) {
        logger.warn("Node already visited, skipping", { nodeId });
        continue;
      }
      visitedNodes.add(nodeId);

      const node = nodeById.get(nodeId);
      if (!node) {
        logger.warn("Node not found in flow", { nodeId });
        continue;
      }

      // Update realtime metadata
      metadata.set("currentNode", nodeId);
      metadata.set(`node_${nodeId}`, { status: "running", label: node.label });

      logger.info(`Executing node ${nodeId} (${node.type})`, { run_id });

      let nodeInputData: Record<string, unknown> = { ...executionContext, ...inputData };

      if (LLM_NODE_TYPES.has(node.type)) {
        nodeInputData = await ensureChatContext(
          nodeInputData,
          flow_json.steps,
          supabase,
        );
      }

      // Execute the node as a subtask
      const nodePayload: NodeExecutionPayload = {
        run_id,
        node: { id: node.id, type: node.type, label: node.label, config: node.config },
        input_data: nodeInputData,
        budget_remaining: budget_limit - totalCost,
      };

      const result = await executeFlowNode.triggerAndWait(nodePayload);

      if (!result.ok) {
        logger.error("Node execution failed", { nodeId, error: result.error });
        metadata.set(`node_${nodeId}`, { status: "failed", label: node.label, error: String(result.error) });
        await finalizeRun(supabase, run_id, "failed", totalCost, totalTokens, stepCount,
          `Node ${nodeId} (${node.label}) failed`);
        metadata.set("status", "failed");
        throw new AbortTaskRunError(`Node ${node.label} failed`);
      }

      const nodeResult = result.output;

      // Accumulate cost and tokens
      totalCost += nodeResult.cost;
      totalTokens += nodeResult.tokens_used;

      // Merge node output into execution context
      executionContext = {
        ...executionContext,
        [`${nodeId}_output`]: nodeResult.output,
        ...nodeResult.output,
      };

      // Update metadata for realtime UI
      metadata.set(`node_${nodeId}`, {
        status: nodeResult.status,
        label: node.label,
        cost: nodeResult.cost,
        tokens: nodeResult.tokens_used,
        duration_ms: nodeResult.duration_ms,
        branch: nodeResult.branch,
      });

      const progress = Math.round((stepCount / totalSteps) * 100);
      metadata.set("progress", Math.min(progress, 99));
      metadata.set("totalCost", totalCost);
      metadata.set("tokensUsed", totalTokens);
      metadata.set("stepCount", stepCount);

      // Update agent_runs totals live
      const { error: updateTotalsErr } = await supabase
        .from("agent_runs")
        .update({ total_cost: totalCost, tokens_used: totalTokens, step_count: stepCount })
        .eq("id", run_id);
      if (updateTotalsErr) logger.error("Failed to update run totals", { error: updateTotalsErr.message, code: updateTotalsErr.code });

      // Determine next nodes from edges
      const outgoingEdges = edgeMap.get(nodeId) ?? [];
      let enqueuedAny = false;

      for (const edge of outgoingEdges) {
        // If edge has a condition, check against branch result
        if (edge.condition && nodeResult.branch) {
          if (edge.condition.toUpperCase() !== nodeResult.branch.toUpperCase()) {
            continue; // Skip this branch
          }
        }

        if (!visitedNodes.has(edge.target)) {
          executionQueue.push({ nodeId: edge.target, inputData: executionContext });
          enqueuedAny = true;
        }
      }

      if (!enqueuedAny && outgoingEdges.length > 0 && node.type === "switch") {
        const defaultBranch = String(node.config.default_branch ?? "");
        const fallbackEdge =
          outgoingEdges.find(
            (e) => e.condition && defaultBranch &&
              e.condition.toUpperCase() === defaultBranch.toUpperCase(),
          ) ??
          outgoingEdges.find((e) => !e.condition) ??
          outgoingEdges[0];

        if (fallbackEdge && !visitedNodes.has(fallbackEdge.target)) {
          logger.warn("Switch had no matching branch edge; using fallback", {
            nodeId,
            branch: nodeResult.branch,
            fallbackTarget: fallbackEdge.target,
          });
          executionQueue.push({ nodeId: fallbackEdge.target, inputData: executionContext });
        }
      }
    }

    // All nodes executed
    await finalizeRun(supabase, run_id, "completed", totalCost, totalTokens, stepCount);

    metadata.set("status", "completed");
    metadata.set("progress", 100);
    metadata.set("totalCost", totalCost);
    metadata.set("tokensUsed", totalTokens);
    metadata.set("stepCount", stepCount);

    logger.info("execute-agent-run completed", { run_id, totalCost, totalTokens, stepCount });

    return {
      run_id,
      status: "completed",
      total_cost: totalCost,
      tokens_used: totalTokens,
      step_count: stepCount,
    };
  },
});

// ── Build outgoing edge lookup map ───────────────────────────────────────────
function buildEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const map = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, []);
    map.get(edge.source)!.push(edge);
  }
  return map;
}

// ── Finalize the run record ──────────────────────────────────────────────────
async function finalizeRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  status: "completed" | "failed",
  totalCost: number,
  tokensUsed: number,
  stepCount: number,
  errorMessage?: string,
) {
  const { error: finalizeErr } = await supabase
    .from("agent_runs")
    .update({
      status,
      total_cost: totalCost,
      tokens_used: tokensUsed,
      step_count: stepCount,
      completed_at: new Date().toISOString(),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("id", runId);
  if (finalizeErr) {
    logger.error("Failed to finalize run", { runId, status, error: finalizeErr.message, code: finalizeErr.code });
  }
}
