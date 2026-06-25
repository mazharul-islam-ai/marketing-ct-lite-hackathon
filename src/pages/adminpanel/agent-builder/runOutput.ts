import type { RunStep } from "./types";

const OUTPUT_NODE_TYPES = ["dashboard_write", "report_generate"];
const LLM_NODE_TYPES = ["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"];

function isUnresolvedTemplate(value: string): boolean {
  const trimmed = value.trim();
  return /^\{\{[\w.]+\}\}$/.test(trimmed) || /\{\{[\w.]+\}\}/.test(trimmed);
}

export function findLatestLlmResult(runSteps: RunStep[]): string | null {
  for (let i = runSteps.length - 1; i >= 0; i--) {
    const step = runSteps[i];
    if (!LLM_NODE_TYPES.includes(step.node_type)) continue;
    const result = (step.output as Record<string, unknown> | null)?.result;
    if (typeof result === "string" && result.trim()) return result;
  }
  return null;
}

export function extractRunOutput(runSteps: RunStep[]): {
  content: string | null;
  title: string | null;
} {
  const outputStep = [...runSteps]
    .reverse()
    .find(
      (s) =>
        OUTPUT_NODE_TYPES.includes(s.node_type) &&
        (s.output as Record<string, unknown>)?.content,
    );

  const llmStep = [...runSteps]
    .reverse()
    .find(
      (s) =>
        LLM_NODE_TYPES.includes(s.node_type) &&
        (s.output as Record<string, unknown>)?.result,
    );

  let content = outputStep
    ? String((outputStep.output as Record<string, unknown>).content)
    : llmStep
      ? String((llmStep.output as Record<string, unknown>).result)
      : null;

  if (content && isUnresolvedTemplate(content)) {
    content = findLatestLlmResult(runSteps) ?? content;
  }

  const title = outputStep
    ? String(
        (outputStep.output as Record<string, unknown>).title ??
          outputStep.node_label ??
          "Output",
      )
    : llmStep
      ? String(llmStep.node_label ?? "Output")
      : null;

  return { content, title };
}

export function detectSwitchRoutingStop(runSteps: RunStep[]): boolean {
  if (runSteps.length >= 3) return false;
  const last = runSteps[runSteps.length - 1];
  return last?.node_type === "switch" && last?.status === "completed";
}
