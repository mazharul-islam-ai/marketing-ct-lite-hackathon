import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, CheckCircle2, HelpCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "../types";
import {
  COMPILE_PHASE_LABELS,
  COMPILE_PHASE_ORDER,
  type CompilerMode,
  type DesignChatMode,
  type SendPromptOptions,
} from "../integrationConfig";
import type { CompileStatus } from "../hooks/useBuilderSession";
import { ab } from "../agentBuilderTheme";
import { I420 } from "../i420Brand";

interface BuilderChatProps {
  chatHistory: ChatMessage[];
  isCompiling: boolean;
  compileStatus?: CompileStatus | null;
  error?: string | null;
  onClearError?: () => void;
  onSendPrompt: (prompt: string, options: SendPromptOptions) => void;
  chatMode: DesignChatMode;
  onChatModeChange: (mode: DesignChatMode) => void;
  compilerMode: CompilerMode;
  onCompilerModeChange: (mode: CompilerMode) => void;
  agentName?: string;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border p-0.5 gap-0.5", ab.borderSoft, ab.surfaceElevated)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
            value === opt.value
              ? cn(ab.accentBtn, "text-white shadow-sm")
              : cn(ab.textMuted, "hover:bg-[hsl(18_35%_95%)]"),
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Compact inline 5-dot progress row shown in the chat message stream during compile. */
function CompileInlineProgress({ status }: { status: CompileStatus }) {
  const total = COMPILE_PHASE_ORDER.length;
  const activeIndex = COMPILE_PHASE_ORDER.indexOf(
    status.phase as (typeof COMPILE_PHASE_ORDER)[number],
  );
  const DOT_COUNT = 5;
  const activeDot = activeIndex < 0 ? 0 : Math.min(DOT_COUNT - 1, Math.floor((activeIndex / total) * DOT_COUNT));
  const doneDotCount = Math.min(DOT_COUNT - 1, Math.floor(
    (status.completedPhases.length / total) * DOT_COUNT,
  ));
  const allDone = status.completedPhases.includes("saving_version");

  const currentLabel = COMPILE_PHASE_LABELS[status.phase as keyof typeof COMPILE_PHASE_LABELS] ?? status.phase;

  return (
    <div className={cn("rounded-xl px-3 py-2.5 border min-w-[180px] max-w-[220px]", ab.accentSoft)}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const isDone = allDone || i < doneDotCount;
          const isActive = !allDone && i === activeDot;
          return (
            <span
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                isDone
                  ? "bg-emerald-500"
                  : isActive
                  ? "bg-[hsl(18_52%_52%)] animate-pulse"
                  : "bg-slate-200",
              )}
            />
          );
        })}
      </div>
      <p className={cn("text-[11px] leading-tight truncate", ab.accentText)}>
        {allDone ? "Done" : currentLabel}
      </p>
    </div>
  );
}

function assistantBubbleClass(msg: ChatMessage): string {
  switch (msg.message_type) {
    case "clarification":
      return cn(ab.assistantBubble, "rounded-bl-md border border-amber-200 bg-amber-50/80");
    case "success":
      return cn(ab.assistantBubble, "rounded-bl-md border border-emerald-200 bg-emerald-50/50");
    case "error":
      return cn("rounded-bl-md border border-red-200 bg-red-50 text-red-800");
    case "hint":
      return cn(ab.assistantBubble, "rounded-bl-md border border-slate-200 bg-slate-50");
    default:
      return cn(ab.assistantBubble, "rounded-bl-md border");
  }
}

function AssistantIcon({ messageType }: { messageType?: ChatMessage["message_type"] }) {
  if (messageType === "clarification") {
    return <HelpCircle className="w-2.5 h-2.5 text-white" />;
  }
  if (messageType === "error") {
    return <AlertCircle className="w-2.5 h-2.5 text-white" />;
  }
  if (messageType === "success") {
    return <CheckCircle2 className="w-2.5 h-2.5 text-white" />;
  }
  return <Sparkles className="w-2.5 h-2.5 text-white" />;
}

export function BuilderChat({
  chatHistory,
  isCompiling,
  compileStatus,
  error,
  onClearError,
  onSendPrompt,
  chatMode,
  onChatModeChange,
  compilerMode,
  onCompilerModeChange,
  agentName,
}: BuilderChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isCompiling, compileStatus?.phase]);

  const handleSend = () => {
    if (!input.trim() || isCompiling) return;
    onSendPrompt(input.trim(), { chatMode, compilerMode });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder = chatMode === "ask"
    ? "Ask about your workspace, tools, or current flow…"
    : "Describe or modify the workflow…";

  return (
    <div className={cn("flex flex-col h-full border-r", ab.chatPanel)}>
      <div className={cn("px-3 py-3 border-b", ab.chatHeader)}>
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", ab.accentBtn)}>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(ab.i420Wordmark, "text-sm leading-none")}>{I420.name}</p>
            {agentName && agentName !== I420.newWorkflowLabel && (
              <p className={cn("text-xs font-medium truncate mt-0.5", ab.textForeground)}>{agentName}</p>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {chatHistory.length === 0 && !isCompiling && (
          <div className="py-6 text-center">
            <p className={cn("text-xs font-medium", ab.textForeground)}>
              {chatMode === "ask" ? "Ask about your workspace" : "Describe your workflow"}
            </p>
            <p className={cn("text-[11px] mt-1", ab.textMuted)}>
              {chatMode === "ask"
                ? "Questions about tools, tables, and your current flow"
                : "See the canvas for examples and hints"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {chatHistory.length > 20 && (
            <p className={cn("text-[11px] text-center py-1", ab.textMuted)}>
              {chatHistory.length - 20} earlier message{chatHistory.length - 20 > 1 ? "s" : ""} hidden
            </p>
          )}
          {chatHistory.slice(-20).map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2",
                  msg.message_type === "error" ? "bg-red-500" : msg.message_type === "clarification" ? "bg-amber-500" : msg.message_type === "success" ? "bg-emerald-600" : ab.accentBtn,
                )}>
                  <AssistantIcon messageType={msg.message_type} />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? cn(ab.userBubble, "rounded-br-md")
                    : assistantBubbleClass(msg),
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isCompiling && compileStatus && (
            <div className="flex justify-start">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2", ab.accentBtn)}>
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
              <CompileInlineProgress status={compileStatus} />
            </div>
          )}

          {isCompiling && !compileStatus && (
            <div className="flex justify-start">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2", ab.accentBtn)}>
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
              <div className={cn("rounded-xl px-3 py-2 flex items-center gap-2 border", ab.assistantBubble)}>
                <Loader2 className={cn("w-3 h-3 animate-spin", ab.accentText)} />
                <span className={cn("text-xs", ab.textMuted)}>Starting…</span>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className={cn("p-3 border-t space-y-2", ab.borderSoft)}>
        {error && (
          <div className={cn("flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-[11px] border", "bg-red-50 border-red-200 text-red-700")}>
            <span className="leading-relaxed">{error}</span>
            {onClearError && (
              <button type="button" onClick={onClearError} className="text-red-500 hover:text-red-700 shrink-0 text-[10px]">
                Dismiss
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={chatMode}
            options={[
              { value: "build", label: "Build" },
              { value: "ask", label: "Ask" },
            ]}
            onChange={onChatModeChange}
            disabled={isCompiling}
          />
          {chatMode === "build" && (
            <SegmentedControl
              value={compilerMode}
              options={[
                { value: "single", label: "Single" },
                { value: "multi_stage", label: "Multi" },
              ]}
              onChange={onCompilerModeChange}
              disabled={isCompiling}
            />
          )}
        </div>

        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("resize-none text-xs pr-10 min-h-[4.5rem] max-h-36 leading-6 rounded-xl", ab.input)}
            rows={3}
            disabled={isCompiling}
          />
          <Button
            size="icon"
            className={cn("absolute bottom-1.5 right-1.5 h-7 w-7 rounded-lg", ab.accentBtn)}
            onClick={handleSend}
            disabled={!input.trim() || isCompiling}
          >
            {isCompiling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
