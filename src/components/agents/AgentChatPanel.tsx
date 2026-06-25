import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";
import { useAgentChat } from "./useAgentChat";
import { AgentChatLayout } from "./chat/AgentChatLayout";
import { AgentChatMessageRow } from "./chat/AgentChatMessage";
import { AgentChatComposer } from "./chat/AgentChatComposer";

export interface AgentChatPanelProps {
  agentId: string;
  agentName: string;
  versionId: string | null;
  /** inline = embedded on card; dialog = modal shell */
  variant?: "inline" | "dialog";
  onClose?: () => void;
  className?: string;
}

export function AgentChatPanel({
  agentId,
  agentName,
  versionId,
  variant = "inline",
  onClose,
  className,
}: AgentChatPanelProps) {
  const {
    messages,
    input,
    setInput,
    isSending,
    error,
    sendMessage,
    canSend,
  } = useAgentChat(agentId, versionId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const chatContent = (
    <AgentChatLayout
      variant="compact"
      agent={{ id: agentId, name: agentName }}
      onBack={() => onClose?.()}
      footer={
        <>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <AgentChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage()}
            disabled={!canSend}
            compact
            placeholder="Type your message…"
          />
        </>
      }
    >
      {messages.length === 0 && !isSending && (
        <div className="flex flex-col items-center justify-center h-40 text-center gap-2 text-stone-500">
          <p className="text-xs">Send a message to chat with this agent</p>
        </div>
      )}
      {messages.map((msg) => (
        <AgentChatMessageRow key={msg.id} message={msg} compact />
      ))}
      <div ref={messagesEndRef} />
    </AgentChatLayout>
  );

  if (variant === "dialog") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div
          className={cn(
            "rounded-xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col border overflow-hidden",
            ab.surface,
            ab.borderSoft,
            className,
          )}
        >
          <div className="relative flex flex-col h-full min-h-0 max-h-[85vh]">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 z-10 p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {chatContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 rounded-xl border overflow-hidden",
        ab.surface,
        ab.borderSoft,
        className,
      )}
    >
      {chatContent}
    </div>
  );
}
