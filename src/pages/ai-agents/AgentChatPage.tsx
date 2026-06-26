import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getExecutionCapabilities } from "@/pages/adminpanel/agent-builder/flowCapabilities";
import type { FlowJSON } from "@/pages/adminpanel/agent-builder/types";
import { BuilderAgentRunnerDialog } from "@/components/agents/BuilderAgentRunnerDialog";
import { useAgentChat } from "@/components/agents/useAgentChat";
import { AgentChatLayout } from "@/components/agents/chat/AgentChatLayout";
import { AgentChatMessageRow } from "@/components/agents/chat/AgentChatMessage";
import { AgentChatComposer } from "@/components/agents/chat/AgentChatComposer";

const STARTER_PROMPTS = [
  "What can you help me with?",
  "Summarize the latest data",
  "Show me what's available",
];

export default function AgentChatPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const starterClickedRef = useRef(false);
  const [starterLocked, setStarterLocked] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ["agent-chat", agentId],
    enabled: Boolean(agentId),
    queryFn: async () => {
      const { data: agentRow, error: agentError } = await supabase
        .from("agents" as never)
        .select("id, name, description, current_version_id, status, visibility")
        .eq("id", agentId!)
        .single() as {
        data: {
          id: string;
          name: string;
          description: string | null;
          current_version_id: string | null;
          status: string;
          visibility: string;
        } | null;
        error: unknown;
      };

      if (agentError || !agentRow) throw new Error("Agent not found");

      let flow_json: FlowJSON | null = null;
      if (agentRow.current_version_id) {
        const { data: version } = await supabase
          .from("agent_versions" as never)
          .select("flow_json")
          .eq("id", agentRow.current_version_id)
          .single() as { data: { flow_json: FlowJSON } | null };
        flow_json = version?.flow_json ?? null;
      }

      return { ...agentRow, flow_json };
    },
  });

  const capabilities = getExecutionCapabilities(agent?.flow_json ?? null);
  const versionId = agent?.current_version_id ?? null;

  const {
    messages,
    input,
    setInput,
    isSending,
    error: chatError,
    sendMessage,
    sendMessageWithText,
    canSend,
  } = useAgentChat(agentId ?? "", versionId);

  useEffect(() => {
    if (!isLoading && agent && !capabilities.hasChat) {
      toast.error("This agent does not support chat");
      navigate("/ai-agents", { replace: true });
    }
  }, [isLoading, agent, capabilities.hasChat, navigate]);

  useEffect(() => {
    if (error) {
      toast.error("Agent not found");
      navigate("/ai-agents", { replace: true });
    }
  }, [error, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      starterClickedRef.current = false;
      setStarterLocked(false);
    }
  }, [isSending]);

  if (isLoading || !agent) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f5f0]">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!capabilities.hasChat) return null;

  const showEmpty = messages.length === 0 && !isSending;

  const handleStarterPrompt = (prompt: string) => {
    if (starterClickedRef.current || starterLocked || !canSend) return;
    starterClickedRef.current = true;
    setStarterLocked(true);
    void sendMessageWithText(prompt);
  };

  return (
    <>
      <AgentChatLayout
        agent={agent}
        onBack={() => navigate("/ai-agents")}
        showRunReport={capabilities.hasReport}
        onRunReport={() => setShowReportDialog(true)}
        footer={
          <div data-tour="i420-tour-workspace-chat">
            {chatError && (
              <p className="text-xs text-red-600 mb-2">{chatError}</p>
            )}
            <AgentChatComposer
              value={input}
              onChange={setInput}
              onSend={() => void sendMessage()}
              disabled={!canSend}
            />
          </div>
        }
      >
        {showEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-200/70 flex items-center justify-center">
              <Bot className="w-6 h-6 text-stone-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-800">{agent.name}</h2>
              {agent.description && (
                <p className="text-sm text-stone-500 mt-1 max-w-md">{agent.description}</p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleStarterPrompt(prompt)}
                  disabled={!canSend || starterLocked}
                  className="text-xs px-3 py-1.5 rounded-full border border-stone-300/80 bg-white text-stone-600 hover:bg-stone-50 hover:border-stone-400 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <AgentChatMessageRow key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </AgentChatLayout>

      {showReportDialog && (
        <BuilderAgentRunnerDialog
          agentId={agent.id}
          agentName={agent.name}
          versionId={versionId}
          mode="report"
          onClose={() => setShowReportDialog(false)}
        />
      )}
    </>
  );
}
