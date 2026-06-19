import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { RunStep } from "@/pages/adminpanel/agent-builder/types";
import { extractRunOutput } from "@/pages/adminpanel/agent-builder/runOutput";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface BuilderAgentChatDialogProps {
  agentId: string;
  agentName: string;
  versionId: string | null;
  onClose: () => void;
}

export function BuilderAgentChatDialog({
  agentId,
  agentName,
  versionId,
  onClose,
}: BuilderAgentChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !versionId) return;

    const userMessage: ChatMessage = {
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

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: content ?? "I processed your message but no text response was generated.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={cn("rounded-xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col border", ab.surface, ab.borderSoft)}>
        <div className={cn("flex items-center justify-between px-5 py-4 border-b shrink-0", ab.borderSoft)}>
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ab.accentMuted)}>
              <Bot className={cn("w-4 h-4", ab.accentText)} />
            </div>
            <div>
              <h2 className={cn("font-semibold text-sm", ab.textForeground)}>{agentName}</h2>
              <p className={cn("text-xs", ab.textMuted)}>Chat mode</p>
            </div>
          </div>
          <button onClick={onClose} className={cn("transition-colors", ab.textMuted, "hover:text-slate-700")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-4 py-4">
          {messages.length === 0 && !isSending && (
            <div className={cn("flex flex-col items-center justify-center h-48 text-center gap-2", ab.textMuted)}>
              <Bot className="w-8 h-8 opacity-30" />
              <p className="text-sm">Send a message to chat with this agent</p>
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

        <div className={cn("px-4 py-3 border-t shrink-0", ab.borderSoft)}>
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              rows={3}
              className={cn("text-xs resize-none min-h-[72px]", ab.input)}
              disabled={isSending || !versionId}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className={cn("shrink-0 h-9 w-9", ab.accentBtn)}
              onClick={handleSend}
              disabled={isSending || !input.trim() || !versionId}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
