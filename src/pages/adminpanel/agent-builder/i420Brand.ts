import type { FlowJSON } from "./types";

export const I420 = {
  name: "i420",
  tagline: "Build agents & automations from plain language",
  studioLabel: "i420 Studio",
  newWorkflowLabel: "New workflow",
} as const;

export const I420_WELCOME_HINTS = [
  "Describe an agent or automation in the chat",
  "Use Generate to compile your first workflow",
  "Switch to Flow view to inspect nodes after building",
] as const;

export const I420_EXAMPLE_PROMPTS = [
  "Daily unread email summary delivered by email at 8am",
  "Analyze CRM leads every morning, send hot leads to Slack",
  "Generate LinkedIn content for new product launches",
] as const;

export function flowHasContent(flow: FlowJSON | null | undefined): boolean {
  if (!flow) return false;
  return !!(flow.trigger || flow.steps.length > 0);
}
