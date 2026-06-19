import type { RunStep } from "./types";

const OUTPUT_NODE_TYPES = ["dashboard_write", "report_generate"];
const LLM_NODE_TYPES = ["openai_llm", "gemini_llm", "anthropic_llm", "custom_llm"];

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

  const llmStep = !outputStep
    ? [...runSteps]
        .reverse()
        .find(
          (s) =>
            LLM_NODE_TYPES.includes(s.node_type) &&
            (s.output as Record<string, unknown>)?.result,
        )
    : null;

  const content = outputStep
    ? String((outputStep.output as Record<string, unknown>).content)
    : llmStep
      ? String((llmStep.output as Record<string, unknown>).result)
      : null;

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
