import { useEffect, useRef } from "react";
import { Send, Loader2, Bot, User, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";
import { useAgentChat } from "./useAgentChat";

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const header = (
    <div className={cn("flex items-center justify-between px-4 py-3 border-b shrink-0", ab.borderSoft)}>
      <div className="flex items-center gap-2 min-w-0">
        {variant === "inline" && onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn("p-1 rounded-md transition-colors shrink-0", ab.textMuted, "hover:bg-[hsl(40_20%_96%)]")}
            title="Back to preview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", ab.accentMuted)}>
          <Bot className={cn("w-3.5 h-3.5", ab.accentText)} />
        </div>
        <div className="min-w-0">
          <h2 className={cn("font-semibold text-xs truncate", ab.textForeground)}>{agentName}</h2>
          <p className={cn("text-[10px]", ab.textMuted)}>Chat</p>
        </div>
      </div>
      {variant === "dialog" && onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn("transition-colors", ab.textMuted, "hover:text-slate-700")}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const body = (
    <>
      <ScrollArea className={cn("flex-1 min-h-0", variant === "inline" ? "px-3 py-3" : "px-4 py-4")}>
        {messages.length === 0 && !isSending && (
          <div className={cn("flex flex-col items-center justify-center h-40 text-center gap-2", ab.textMuted)}>
            <Bot className="w-7 h-7 opacity-30" />
            <p className="text-xs">Send a message to chat with this agent</p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role === "assistant" && (
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", ab.accentMuted)}>
                  <Bot className={cn("w-3 h-3", ab.accentText)} />
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl px-3 py-2 max-w-[85%] text-xs",
                  msg.role === "user"
                    ? cn(ab.accentBtn, "text-white")
                    : cn(ab.chatPanel, ab.textForeground, "border", ab.borderSoft),
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none [&_p]:my-1 [&_p]:text-xs">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {error && (
        <div className="px-4 pb-2 text-xs text-red-600">{error}</div>
      )}

      <div className={cn("px-3 py-2.5 border-t shrink-0", ab.borderSoft)}>
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            rows={variant === "inline" ? 2 : 3}
            className={cn(
              "text-xs resize-none",
              variant === "inline" ? "min-h-[56px]" : "min-h-[72px]",
              ab.input,
            )}
            disabled={isSending || !versionId}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            className={cn("shrink-0 h-8 w-8", ab.accentBtn)}
            onClick={() => void sendMessage()}
            disabled={!canSend || !input.trim()}
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </>
  );

  if (variant === "dialog") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div
          className={cn(
            "rounded-xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col border",
            ab.surface,
            ab.borderSoft,
            className,
          )}
        >
          {header}
          {body}
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
      {header}
      {body}
    </div>
  );
}
