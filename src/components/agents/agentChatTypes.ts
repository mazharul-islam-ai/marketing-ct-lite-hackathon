import type { RunStep } from "@/pages/adminpanel/agent-builder/types";

export interface ChatActivityStep {
  id: string;
  label: string;
  detail?: string;
  status: RunStep["status"];
  nodeType: string;
}

export interface ChatReference {
  id: string;
  title: string;
  snippet?: string;
  meta?: string;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "running" | "complete" | "error";
  activity?: ChatActivityStep[];
  references?: ChatReference[];
  diagnostic?: string | null;
  runId?: string;
}
