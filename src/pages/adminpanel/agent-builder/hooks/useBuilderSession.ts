import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, FlowJSON } from "../types";
import type { CompilerMode, DesignChatMode, SendPromptOptions } from "../integrationConfig";
import { I420 } from "../i420Brand";
import { diffFlows } from "../flowDiff";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface CompileStatus {
  phase: string;
  label: string;
  completedPhases: string[];
}

export interface CompileDiffSession {
  before: FlowJSON | null;
  after: FlowJSON;
  previousVersion?: number | null;
  newVersion?: number;
}

interface BuilderSessionState {
  chatHistory: ChatMessage[];
  isCompiling: boolean;
  compileStatus: CompileStatus | null;
  error: string | null;
  lastVersionId: string | null;
  lastVersion: number | null;
  compileDiffSession: CompileDiffSession | null;
  compareUnseen: boolean;
  chatMode: DesignChatMode;
  compilerMode: CompilerMode;
}

export interface UseBuilderSessionOptions {
  onAgentCreated?: (newAgentId: string, name: string) => void;
  onCompileComplete?: (versionId: string, version: number) => void;
  onVersionUpdated?: (versionId: string, version: number) => void;
  getCurrentFlow?: () => FlowJSON | null;
}

interface UseBuilderSessionReturn extends BuilderSessionState {
  sendPrompt: (prompt: string, options?: SendPromptOptions) => Promise<FlowJSON | null>;
  setChatMode: (mode: DesignChatMode) => void;
  setCompilerMode: (mode: CompilerMode) => void;
  updateCanvasFlow: (flow: FlowJSON) => void;
  clearError: () => void;
  clearCompileDiffSession: () => void;
  markCompareSeen: () => void;
}

function chatModeStorageKey(agentId: string | null) {
  return agentId ? `i420-chat-mode-${agentId}` : "i420-chat-mode-new";
}

function compilerModeStorageKey(agentId: string | null) {
  return agentId ? `i420-compiler-mode-${agentId}` : "i420-compiler-mode-new";
}

function readStoredChatMode(agentId: string | null): DesignChatMode {
  try {
    const v = sessionStorage.getItem(chatModeStorageKey(agentId));
    return v === "ask" ? "ask" : "build";
  } catch {
    return "build";
  }
}

function readStoredCompilerMode(agentId: string | null): CompilerMode | null {
  try {
    const v = sessionStorage.getItem(compilerModeStorageKey(agentId));
    if (v === "multi_stage") return "multi_stage";
    if (v === "single") return "single";
    return null;
  } catch {
    return null;
  }
}

function nameFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 5).join(" ");
  return words.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "New Agent";
}

type CompileResult = {
  success: boolean;
  flow_json?: FlowJSON;
  version_id?: string;
  version?: number;
  ai_message?: string;
  user_message?: string;
  setup_hints?: string[];
  message?: string;
  message_type?: ChatMessage["message_type"];
  chat_history?: ChatMessage[];
  needs_clarification?: boolean;
  question?: string;
  error?: string;
};

async function streamEdgeFunction(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
  onStatus: (phase: string, label: string) => void,
): Promise<CompileResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Request failed (${response.status})`);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    return response.json() as Promise<CompileResult>;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: CompileResult = { success: false, message: "No result received" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as {
          type: string;
          phase?: string;
          label?: string;
        } & CompileResult;

        if (event.type === "status" && event.phase && event.label) {
          onStatus(event.phase, event.label);
        } else if (event.type === "result") {
          const { type: _t, ...rest } = event;
          finalResult = rest as CompileResult;
        }
      } catch {
        // skip malformed SSE chunks
      }
    }
  }

  return finalResult;
}

function handleCompileResult(
  result: CompileResult,
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  onFlowUpdate: (flow: FlowJSON) => void,
  setLastVersionId: (id: string) => void,
  setLastVersion: (v: number) => void,
  setError: (msg: string | null) => void,
  onCompileComplete?: (versionId: string, version: number) => void,
): FlowJSON | null {
  if (result.chat_history?.length) {
    setChatHistory(result.chat_history);
  }

  if (result.success && result.flow_json) {
    if (!result.chat_history?.length) {
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: result.user_message ?? result.ai_message ?? "Flow updated.",
        message_type: result.message_type ?? "success",
        timestamp: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, aiMsg]);
    }
    onFlowUpdate(result.flow_json);
    if (result.version_id) {
      setLastVersionId(result.version_id);
      onCompileComplete?.(result.version_id, result.version ?? 1);
    }
    if (result.version) setLastVersion(result.version);
    return result.flow_json;
  }

  if (!result.success && result.needs_clarification && result.question) {
    if (!result.chat_history?.length) {
      const questionMsg: ChatMessage = {
        role: "assistant",
        content: result.user_message ?? result.question,
        message_type: "clarification",
        timestamp: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, questionMsg]);
    }
    return null;
  }

  const failMsg = result.message ?? result.user_message ?? result.ai_message ?? result.error ?? "Could not generate a valid flow. Please try rephrasing.";
  if (!result.chat_history?.length) {
    const failChatMsg: ChatMessage = {
      role: "assistant",
      content: failMsg,
      message_type: "error",
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, failChatMsg]);
  }
  setError(failMsg);
  return null;
}

function handleAskResult(
  result: CompileResult,
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setError: (msg: string | null) => void,
): void {
  if (result.chat_history?.length) {
    setChatHistory(result.chat_history);
    return;
  }

  if (result.success) {
    const reply = result.user_message ?? result.ai_message ?? "";
    if (reply) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          message_type: "normal",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    return;
  }

  const failMsg = result.message ?? result.error ?? "Could not get an answer. Please try again.";
  setChatHistory((prev) => [
    ...prev,
    {
      role: "assistant",
      content: failMsg,
      message_type: "error",
      timestamp: new Date().toISOString(),
    },
  ]);
  setError(failMsg);
}

export function useBuilderSession(
  agentId: string | null,
  onFlowUpdate: (flow: FlowJSON) => void,
  options?: UseBuilderSessionOptions,
): UseBuilderSessionReturn {
  const onAgentCreated = options?.onAgentCreated;
  const onCompileComplete = options?.onCompileComplete;
  const onVersionUpdated = options?.onVersionUpdated;
  const getCurrentFlow = options?.getCurrentFlow;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<CompileStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastVersionId, setLastVersionId] = useState<string | null>(null);
  const [lastVersion, setLastVersion] = useState<number | null>(null);
  const [compileDiffSession, setCompileDiffSession] = useState<CompileDiffSession | null>(null);
  const [compareUnseen, setCompareUnseen] = useState(false);
  const [chatMode, setChatModeState] = useState<DesignChatMode>(() => readStoredChatMode(agentId));
  const [compilerMode, setCompilerModeState] = useState<CompilerMode>(() => readStoredCompilerMode(agentId) ?? "single");

  const resolvedAgentIdRef = useRef<string | null>(agentId);
  const completedPhasesRef = useRef<string[]>([]);
  const isCompilingRef = useRef(false);
  const lastVersionRef = useRef<number | null>(null);
  const chatModeRef = useRef(chatMode);
  const compilerModeRef = useRef(compilerMode);

  useEffect(() => {
    lastVersionRef.current = lastVersion;
  }, [lastVersion]);

  useEffect(() => {
    resolvedAgentIdRef.current = agentId;
  }, [agentId]);

  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);

  useEffect(() => {
    compilerModeRef.current = compilerMode;
  }, [compilerMode]);

  useEffect(() => {
    setChatModeState(readStoredChatMode(agentId));
    const stored = readStoredCompilerMode(agentId);
    if (stored) setCompilerModeState(stored);
  }, [agentId]);

  useEffect(() => {
    async function loadOrgCompilerDefault() {
      if (readStoredCompilerMode(agentId)) return;
      try {
        const { data } = await supabase
          .from("organization_integrations" as never)
          .select("config")
          .eq("integration_type" as never, "agent_builder_compiler")
          .eq("is_active" as never, true)
          .limit(1)
          .maybeSingle() as { data: { config?: { mode?: string } } | null };

        const mode = data?.config?.mode;
        if (mode === "multi_stage" || mode === "single") {
          setCompilerModeState(mode);
        }
      } catch {
        // keep default
      }
    }
    loadOrgCompilerDefault();
  }, [agentId]);

  const setChatMode = useCallback((mode: DesignChatMode) => {
    setChatModeState(mode);
    try {
      sessionStorage.setItem(chatModeStorageKey(resolvedAgentIdRef.current), mode);
    } catch {
      // ignore
    }
  }, []);

  const setCompilerMode = useCallback((mode: CompilerMode) => {
    setCompilerModeState(mode);
    try {
      sessionStorage.setItem(compilerModeStorageKey(resolvedAgentIdRef.current), mode);
    } catch {
      // ignore
    }
  }, []);

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
          if (chatModeRef.current === "ask") return;
          const newVersion = payload.new as { flow_json: FlowJSON; id: string; version: number };
          if (newVersion.flow_json) {
            onFlowUpdate(newVersion.flow_json);
            setLastVersionId(newVersion.id);
            setLastVersion(newVersion.version);
            onVersionUpdated?.(newVersion.id, newVersion.version);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, onFlowUpdate, onVersionUpdated]);

  const sendPrompt = useCallback(
    async (
      prompt: string,
      options?: SendPromptOptions,
    ): Promise<FlowJSON | null> => {
      if (!prompt.trim()) return null;
      if (isCompilingRef.current) return null;

      const effectiveChatMode = options?.chatMode ?? chatModeRef.current;
      const effectiveCompilerMode = options?.compilerMode ?? compilerModeRef.current;
      const isAsk = effectiveChatMode === "ask";

      isCompilingRef.current = true;
      setIsCompiling(true);
      setError(null);
      completedPhasesRef.current = [];
      setCompileStatus({ phase: isAsk ? "loading_context" : "checking_provider", label: "Starting…", completedPhases: [] });

      const beforeFlow = isAsk ? null : (getCurrentFlow?.() ?? null);
      const versionBeforeCompile = lastVersionRef.current;

      const userMsg: ChatMessage = { role: "user", content: prompt, timestamp: new Date().toISOString() };
      setChatHistory((prev) => [...prev, userMsg]);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const { data: { user } } = await supabase.auth.getUser();

        if (!token) throw new Error("Not authenticated");

        let effectiveAgentId = resolvedAgentIdRef.current;

        if (!effectiveAgentId && user) {
          const agentName = isAsk ? I420.newWorkflowLabel : nameFromPrompt(prompt);
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

        const onStatus = (phase: string, label: string) => {
          setCompileStatus((prev) => {
            const done = [...(prev?.completedPhases ?? [])];
            if (prev?.phase && prev.phase !== phase && !done.includes(prev.phase)) {
              done.push(prev.phase);
            }
            completedPhasesRef.current = done;
            return { phase, label, completedPhases: done };
          });
        };

        if (isAsk) {
          const result = await streamEdgeFunction(
            "i420-compile-ask",
            token,
            { prompt, agent_id: effectiveAgentId },
            onStatus,
          );
          handleAskResult(result, setChatHistory, setError);
          return null;
        }

        const result = await streamEdgeFunction(
          "i420-compile",
          token,
          {
            prompt,
            agent_id: effectiveAgentId,
            action: "generate",
            compiler_mode: effectiveCompilerMode,
          },
          onStatus,
        );

        const newFlow = handleCompileResult(
          result,
          setChatHistory,
          onFlowUpdate,
          setLastVersionId,
          setLastVersion,
          setError,
          onCompileComplete,
        );

        if (newFlow && result.success) {
          const diff = diffFlows(beforeFlow, newFlow);
          if (diff.hasChanges) {
            setCompileDiffSession({
              before: beforeFlow,
              after: newFlow,
              previousVersion: versionBeforeCompile,
              newVersion: result.version ?? undefined,
            });
            setCompareUnseen(true);
          }
        }

        return newFlow;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, something went wrong: ${msg}`, timestamp: new Date().toISOString() },
        ]);
        return null;
      } finally {
        isCompilingRef.current = false;
        setIsCompiling(false);
        setCompileStatus(null);
        completedPhasesRef.current = [];
      }
    },
    [onAgentCreated, onCompileComplete, onFlowUpdate, getCurrentFlow],
  );

  const updateCanvasFlow = useCallback((_flow: FlowJSON) => {
    // Canvas manages its own state; no-op here
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const clearCompileDiffSession = useCallback(() => {
    setCompileDiffSession(null);
    setCompareUnseen(false);
  }, []);

  const markCompareSeen = useCallback(() => setCompareUnseen(false), []);

  return {
    chatHistory,
    isCompiling,
    compileStatus,
    error,
    lastVersionId,
    lastVersion,
    compileDiffSession,
    compareUnseen,
    chatMode,
    compilerMode,
    setChatMode,
    setCompilerMode,
    sendPrompt,
    updateCanvasFlow,
    clearCompileDiffSession,
    markCompareSeen,
    clearError,
  };
}
