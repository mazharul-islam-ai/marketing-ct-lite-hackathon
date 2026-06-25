import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentRun, RunStep } from "@/pages/adminpanel/agent-builder/types";
import { extractRunOutput } from "@/pages/adminpanel/agent-builder/runOutput";
import {
  getChatDataDiagnostic,
  looksLikeEmptyDataReply,
} from "./agentChatDiagnostics";
import {
  extractReferencesFromSteps,
  mapRunStepsToActivity,
} from "./agentChatActivity";
import type { AgentChatMessage } from "./agentChatTypes";

export type { AgentChatMessage, ChatActivityStep, ChatReference } from "./agentChatTypes";

type ActiveRun = { runId: string; assistantId: string };

const RUN_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 4_000;

async function fetchRunSteps(runId: string): Promise<RunStep[]> {
  const { data } = await supabase
    .from("run_steps" as never)
    .select("*")
    .eq("run_id", runId)
    .order("started_at", { ascending: true }) as { data: RunStep[] | null };
  return data ?? [];
}

function buildReply(steps: RunStep[]): {
  content: string;
  diagnostic: string | null;
  references: ReturnType<typeof extractReferencesFromSteps>;
} {
  const { content } = extractRunOutput(steps);
  const diagnostic = getChatDataDiagnostic(steps);
  const references = extractReferencesFromSteps(steps);

  let reply = content ?? "I processed your message but no text response was generated.";
  if (diagnostic && (looksLikeEmptyDataReply(reply) || !content)) {
    reply = `${reply}\n\n_${diagnostic}_`;
  }

  return { content: reply, diagnostic, references };
}

export function useAgentChat(agentId: string, versionId: string | null) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const finishedRunIdsRef = useRef(new Set<string>());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const updateAssistantMessage = useCallback(
    (assistantId: string, patch: Partial<AgentChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const finishRun = useCallback(
    async (
      runId: string,
      assistantId: string,
      run: { status: string; error_message: string | null },
    ) => {
      const steps = await fetchRunSteps(runId);

      if (run.status === "failed" || run.status === "cancelled") {
        updateAssistantMessage(assistantId, {
          status: "error",
          content: run.error_message ?? "Chat run failed",
          activity: mapRunStepsToActivity(steps),
          diagnostic: getChatDataDiagnostic(steps),
        });
      } else {
        const { content, diagnostic, references } = buildReply(steps);
        updateAssistantMessage(assistantId, {
          status: "complete",
          content,
          activity: mapRunStepsToActivity(steps),
          references,
          diagnostic,
          runId,
        });
      }
      setIsSending(false);
      setActiveRun(null);
    },
    [updateAssistantMessage],
  );

  // Live subscription while a run is active
  useEffect(() => {
    if (!activeRun) return;

    const { runId, assistantId } = activeRun;
    let stopped = false;

    const applySteps = (steps: RunStep[]) => {
      if (stopped) return;
      updateAssistantMessage(assistantId, {
        activity: mapRunStepsToActivity(steps),
        runId,
      });
    };

    const finishOnce = async (run: { status: string; error_message: string | null }) => {
      if (stopped || finishedRunIdsRef.current.has(runId)) return;
      finishedRunIdsRef.current.add(runId);
      stopped = true;
      await finishRun(runId, assistantId, run);
    };

    const channel = supabase
      .channel(`agent-chat-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter: `id=eq.${runId}` },
        (payload) => {
          const run = payload.new as AgentRun;
          if (run.status === "queued" || run.status === "running") return;
          void finishOnce(run);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` },
        () => {
          if (stopped) return;
          void fetchRunSteps(runId).then(applySteps);
        },
      )
      .subscribe();

    void fetchRunSteps(runId).then(applySteps);

    const pollInterval = setInterval(async () => {
      if (stopped) return;

      const { data: run } = await supabase
        .from("agent_runs" as never)
        .select("status, error_message")
        .eq("id", runId)
        .single() as { data: { status: string; error_message: string | null } | null };

      if (!run || stopped) return;

      const steps = await fetchRunSteps(runId);
      if (!stopped) applySteps(steps);

      if (run.status !== "queued" && run.status !== "running") {
        void finishOnce(run);
      }
    }, POLL_INTERVAL_MS);

    const timeoutId = setTimeout(() => {
      if (stopped || finishedRunIdsRef.current.has(runId)) return;
      void finishOnce({
        status: "failed",
        error_message: "Chat run timed out after 2 minutes. Please try again.",
      });
    }, RUN_TIMEOUT_MS);

    return () => {
      stopped = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [activeRun, updateAssistantMessage, finishRun]);

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || submittingRef.current || isSending || !versionId) return;

      submittingRef.current = true;

      const userMessage: AgentChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: "running",
          activity: [],
        },
      ]);
      setInput("");
      setIsSending(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const historyForContext = [...messagesRef.current, userMessage]
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await supabase.functions.invoke("trigger-flow-run", {
          body: {
            agent_id: agentId,
            version_id: versionId,
            trigger_type: "manual",
            input_context: {
              mode: "chat",
              message: trimmed,
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

        updateAssistantMessage(assistantId, { runId: result.run_id });
        setActiveRun({ runId: result.run_id, assistantId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send message";
        setError(msg);
        updateAssistantMessage(assistantId, {
          status: "error",
          content: `Sorry, something went wrong: ${msg}`,
        });
        setIsSending(false);
        setActiveRun(null);
      } finally {
        submittingRef.current = false;
      }
    },
    [agentId, versionId, isSending, updateAssistantMessage],
  );

  const sendMessage = useCallback(async () => {
    await submitText(input);
  }, [input, submitText]);

  const sendMessageWithText = useCallback(
    async (text: string) => {
      await submitText(text);
    },
    [submitText],
  );

  const resetSession = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    setActiveRun(null);
    submittingRef.current = false;
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    sendMessageWithText,
    resetSession,
    canSend: Boolean(versionId) && !isSending,
  };
}
