import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, FlowJSON } from "../types";

interface BuilderSessionState {
  chatHistory: ChatMessage[];
  isCompiling: boolean;
  error: string | null;
  lastVersionId: string | null;
  lastVersion: number | null;
}

interface UseBuilderSessionReturn extends BuilderSessionState {
  sendPrompt: (prompt: string, action?: "generate" | "improve" | "add_tool") => Promise<FlowJSON | null>;
  updateCanvasFlow: (flow: FlowJSON) => void;
  clearError: () => void;
}

function nameFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
  return words.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "New Agent";
}

export function useBuilderSession(
  agentId: string | null,
  onFlowUpdate: (flow: FlowJSON) => void,
  onAgentCreated?: (newAgentId: string, name: string) => void,
): UseBuilderSessionReturn {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVersionId, setLastVersionId] = useState<string | null>(null);
  const [lastVersion, setLastVersion] = useState<number | null>(null);
  // Track the resolved agentId in case we create it on-the-fly
  const resolvedAgentIdRef = useRef<string | null>(agentId);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    resolvedAgentIdRef.current = agentId;
  }, [agentId]);

  // Load existing session on mount (only for existing agents)
  useEffect(() => {
    if (!agentId) return;

    async function loadSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: session } = await supabase
        .from("builder_sessions" as never)
        .select("chat_history")
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .maybeSingle() as { data: { chat_history: ChatMessage[] } | null };

      if (session?.chat_history?.length) {
        setChatHistory(session.chat_history);
      }
    }

    loadSession();
  }, [agentId]);

  // Subscribe to Supabase Realtime for agent_versions updates
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`builder-session-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_versions",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          const newVersion = payload.new as { flow_json: FlowJSON; id: string; version: number };
          if (newVersion.flow_json) {
            onFlowUpdate(newVersion.flow_json);
            setLastVersionId(newVersion.id);
            setLastVersion(newVersion.version);
          }
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, onFlowUpdate]);

  const sendPrompt = useCallback(
    async (
      prompt: string,
      action: "generate" | "improve" | "add_tool" = "generate",
    ): Promise<FlowJSON | null> => {
      if (!prompt.trim()) return null;

      setIsCompiling(true);
      setError(null);

      const userMsg: ChatMessage = { role: "user", content: prompt, timestamp: new Date().toISOString() };
      setChatHistory((prev) => [...prev, userMsg]);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const { data: { user } } = await supabase.auth.getUser();

        // If no agentId yet, create the agent now with a name derived from the prompt
        let effectiveAgentId = resolvedAgentIdRef.current;

        if (!effectiveAgentId && user) {
          const agentName = nameFromPrompt(prompt);
          const { data: newAgent, error: createError } = await supabase
            .from("agents" as never)
            .insert({
              name: agentName,
              description: "",
              status: "draft",
              created_by: user.id,
            })
            .select("id")
            .single() as { data: { id: string } | null; error: unknown };

          if (createError || !newAgent) {
            throw new Error("Failed to create agent");
          }

          effectiveAgentId = newAgent.id;
          resolvedAgentIdRef.current = newAgent.id;
          onAgentCreated?.(newAgent.id, agentName);
        }

        if (!effectiveAgentId) {
          throw new Error("No agent ID available");
        }

        const response = await supabase.functions.invoke("compile-agent-flow", {
          body: { prompt, agent_id: effectiveAgentId, action },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (response.error) throw new Error(response.error.message);

        const result = response.data as {
          success: boolean;
          flow_json?: FlowJSON;
          version_id?: string;
          version?: number;
          ai_message: string;
          message?: string;
          chat_history?: ChatMessage[];
        };

        const aiMsg: ChatMessage = {
          role: "assistant",
          content: result.ai_message ?? result.message ?? "Done.",
          timestamp: new Date().toISOString(),
        };

        setChatHistory((prev) => [...prev, aiMsg]);

        if (result.success && result.flow_json) {
          onFlowUpdate(result.flow_json);
          if (result.version_id) setLastVersionId(result.version_id);
          if (result.version) setLastVersion(result.version);
          return result.flow_json;
        }

        if (!result.success && result.message) {
          setError(result.message);
        }

        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, something went wrong: ${msg}`, timestamp: new Date().toISOString() },
        ]);
        return null;
      } finally {
        setIsCompiling(false);
      }
    },
    [onAgentCreated, onFlowUpdate],
  );

  const updateCanvasFlow = useCallback((_flow: FlowJSON) => {
    // Canvas manages its own state; no-op here
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    chatHistory,
    isCompiling,
    error,
    lastVersionId,
    lastVersion,
    sendPrompt,
    updateCanvasFlow,
    clearError,
  };
}
