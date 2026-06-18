import type { FlowJSON } from "../agent-builder/types";

/**
 * Canonical unread-email summary flow template.
 * Used as reference; compiler generates similar flows when Gmail + delivery integrations are configured.
 */
export const UNREAD_EMAIL_SUMMARY_FLOW: FlowJSON = {
  trigger: {
    id: "n1",
    type: "cron_trigger",
    label: "Daily 8am",
    config: { schedule: "0 8 * * *" },
    position: { x: 0, y: 200 },
  },
  steps: [
    {
      id: "n2",
      type: "gmail_fetch_unread",
      label: "Fetch Unread Emails",
      config: { max_results: 25 },
      position: { x: 200, y: 200 },
    },
    {
      id: "n3",
      type: "condition",
      label: "Has Unread?",
      config: {
        input_variable: "count",
        operator: ">",
        threshold: 0,
        expression: "count > 0",
      },
      position: { x: 400, y: 200 },
    },
    {
      id: "n4",
      type: "openai_llm",
      label: "Summarize Emails",
      config: {
        model: "gpt-4o-mini",
        system_prompt: "You summarize unread emails concisely for a busy executive.",
        prompt: "Summarize these unread emails by urgency, sender, and action needed:\n\n{{emails}}",
        temperature: 0.3,
        max_tokens: 1500,
      },
      position: { x: 600, y: 200 },
    },
    {
      id: "n5",
      type: "email_output",
      label: "Send Summary Email",
      config: {
        to: "{{user_email}}",
        subject: "Daily Unread Email Summary",
        body: "{{summary}}",
      },
      position: { x: 800, y: 200 },
    },
    {
      id: "n6",
      type: "report_generate",
      label: "No Unread Report",
      config: { title: "No Unread Emails" },
      position: { x: 600, y: 400 },
    },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4", condition: "YES" },
    { id: "e4", source: "n3", target: "n6", condition: "NO" },
    { id: "e5", source: "n4", target: "n5" },
  ],
};

export const UNREAD_EMAIL_SUMMARY_PROMPT =
  "Create a daily automation that retrieves my unread emails and creates a summary. " +
  "Run every day at 8am UTC. Deliver the summary by email.";

/** Agent ID from demo — recompile via builder chat after integrations are configured */
export const UNREAD_EMAIL_AGENT_ID = "9cc32d7c-f6ee-4512-aa97-630c007e6c22";
