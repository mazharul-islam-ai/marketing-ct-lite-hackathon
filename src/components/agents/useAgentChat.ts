import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RunStep } from "@/pages/adminpanel/agent-builder/types";
import { extractRunOutput } from "@/pages/adminpanel/agent-builder/runOutput";
import {
  getChatDataDiagnostic,
  looksLikeEmptyDataReply,
} from "./agentChatDiagnostics";

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useAgentChat(agentId: string, versionId: string | null) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  const waitForRunCompletion = useCallback(async (runId: string): Promise<RunStep[]> => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const { data: run } = await supabase
        .from("agent_runs" as never)
        .select("status, error_message")
        .eq("id", runId)
        .single() as { data: { status: string; error_message: string | null } | null };

      if (run && run.status !== "queued" && run.status !== "running") {
        const { data: steps } = await supabase
          .from("run_steps" as never)
          .select("*")
          .eq("run_id", runId)
          .order("started_at", { ascending: true }) as { data: RunStep[] | null };

        if (run.status === "failed") {
          throw new Error(run.error_message ?? "Chat run failed");
        }
        return steps ?? [];
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Chat run timed out");
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending || !versionId) return;

    const userMessage: AgentChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const historyForContext = [...messages, userMessage]
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await supabase.functions.invoke("trigger-flow-run", {
        body: {
          agent_id: agentId,
          version_id: versionId,
          trigger_type: "manual",
          input_context: {
            mode: "chat",
            message: text,
            session_id: sessionIdRef.current,
            chat_history: historyForContext,
          },
          budget_limit: 5.0,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.error) throw new Error(response.error.message);
      const result = response.data as { success: boolean; run_id: string; error?: string };
      if (!result.success) throw new Error(result.error ?? "Failed to start chat run");

      const steps = await waitForRunCompletion(result.run_id);
      const { content } = extractRunOutput(steps);
      const diagnostic = getChatDataDiagnostic(steps);

      let reply = content ?? "I processed your message but no text response was generated.";
      if (diagnostic && (looksLikeEmptyDataReply(reply) || !content)) {
        reply = `${reply}\n\n_${diagnostic}_`;
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, something went wrong: ${msg}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [agentId, versionId, input, isSending, messages, waitForRunCompletion]);

  const resetSession = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    resetSession,
    canSend: Boolean(versionId) && !isSending,
  };
}
