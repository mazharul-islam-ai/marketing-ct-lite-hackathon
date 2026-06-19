import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Loader2, Sparkles, Zap, Wrench, Bot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, NodeType } from "../types";
import {
  COMPILE_PHASE_LABELS,
  COMPILE_PHASE_ORDER,
  filterPalette,
} from "../integrationConfig";
import type { CompileStatus } from "../hooks/useBuilderSession";
import { ab } from "../agentBuilderTheme";

interface BuilderChatProps {
  chatHistory: ChatMessage[];
  isCompiling: boolean;
  compileStatus?: CompileStatus | null;
  onSendPrompt: (prompt: string, action?: "generate" | "improve" | "add_tool") => void;
  onDragNodeStart?: (type: NodeType) => void;
  agentName?: string;
}

function CompileStatusPanel({ status }: { status: CompileStatus }) {
  const ordered = COMPILE_PHASE_ORDER.filter(
    (p) => p === status.phase || status.completedPhases.includes(p),
  );
  const visiblePhases = ordered.length > 0 ? ordered : [status.phase];

  return (
    <div className={cn("rounded-xl px-3 py-2.5 space-y-1.5 min-w-[200px] border", ab.accentSoft)}>
      {COMPILE_PHASE_ORDER.map((phase) => {
        const isDone = status.completedPhases.includes(phase);
        const isCurrent = status.phase === phase;
        if (!isDone && !isCurrent && !visiblePhases.includes(phase)) return null;

        return (
          <div
            key={phase}
            className={cn(
              "flex items-center gap-2 text-[11px]",
              isDone && ab.textMuted,
              isCurrent && ab.accentText,
              !isDone && !isCurrent && "text-[hsl(240_8%_55%)]",
            )}
          >
            {isDone ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : isCurrent ? (
              <Loader2 className={cn("w-3 h-3 animate-spin shrink-0", ab.accentText)} />
            ) : (
              <span className="w-3 h-3 rounded-full border border-[hsl(250_18%_88%)] shrink-0" />
            )}
            <span>{COMPILE_PHASE_LABELS[phase] ?? phase}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BuilderChat({
  chatHistory,
  isCompiling,
  compileStatus,
  onSendPrompt,
  onDragNodeStart,
  agentName,
}: BuilderChatProps) {
  const [input, setInput] = useState("");
  const [expandedPalette, setExpandedPalette] = useState<string | null>(null);
  const [connectedTools, setConnectedTools] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadTools() {
      const { data } = await supabase
        .from("organization_integrations" as never)
        .select("integration_type")
        .eq("is_active" as never, true) as { data: { integration_type: string }[] | null };
      setConnectedTools(new Set((data ?? []).map((r) => r.integration_type)));
    }
    loadTools();
  }, []);

  const paletteItems = useMemo(() => filterPalette(connectedTools), [connectedTools]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isCompiling, compileStatus?.phase]);

  const handleSend = (action: "generate" | "improve" | "add_tool" = "generate") => {
    if (!input.trim() || isCompiling) return;
    onSendPrompt(input.trim(), action);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend("generate");
    }
  };

  return (
    <div className={cn("flex flex-col h-full border-r", ab.chatPanel)}>
      <div className={cn("px-3 py-3 border-b", ab.chatHeader)}>
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", ab.accentBtn)}>
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide leading-none", ab.textMuted)}>AI Builder</p>
            {agentName && (
              <p className={cn("text-xs font-medium truncate mt-0.5", ab.textForeground)}>{agentName}</p>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {chatHistory.length === 0 && !isCompiling && (
          <div className="py-8 text-center">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border", ab.accentSoft)}>
              <Bot className={cn("w-6 h-6", ab.accentText)} />
            </div>
            <p className={cn("text-xs font-medium", ab.textForeground)}>Describe what you want to build</p>
            <p className={cn("text-[11px] mt-1.5 leading-relaxed px-2", ab.textMuted)}>
              e.g. "Daily unread email summary delivered to Slack at 8am"
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
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 mr-2", ab.accentBtn)}>
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? cn(ab.userBubble, "rounded-br-md")
                    : cn(ab.assistantBubble, "rounded-bl-md border"),
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
              <CompileStatusPanel status={compileStatus} />
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
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe or modify the flow…"
            className={cn("resize-none text-xs pr-10 min-h-[4.5rem] max-h-36 leading-6 rounded-xl", ab.input)}
            rows={3}
            disabled={isCompiling}
          />
          <Button
            size="icon"
            className={cn("absolute bottom-1.5 right-1.5 h-7 w-7 rounded-lg", ab.accentBtn)}
            onClick={() => handleSend("generate")}
            disabled={!input.trim() || isCompiling}
          >
            {isCompiling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className={cn("flex-1 text-[11px] h-7 gap-1 rounded-lg hover:bg-[hsl(248_40%_96%)]", ab.textMuted)}
            onClick={() => handleSend("generate")}
            disabled={!input.trim() || isCompiling}
          >
            <Sparkles className="w-3 h-3" />
            Generate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn("flex-1 text-[11px] h-7 gap-1 rounded-lg hover:bg-[hsl(248_40%_96%)]", ab.textMuted)}
            onClick={() => handleSend("improve")}
            disabled={!input.trim() || isCompiling}
          >
            <Zap className="w-3 h-3" />
            Improve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn("flex-1 text-[11px] h-7 gap-1 rounded-lg hover:bg-[hsl(248_40%_96%)]", ab.textMuted)}
            onClick={() => handleSend("add_tool")}
            disabled={!input.trim() || isCompiling}
          >
            <Wrench className="w-3 h-3" />
            Add Tool
          </Button>
        </div>
      </div>

      <div className={cn("border-t", ab.borderSoft)}>
        <p className={cn("px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide", ab.textMuted)}>
          Node Palette (configured tools)
        </p>
        <div className="pb-2 space-y-0.5">
          {Object.entries(paletteItems).map(([category, items]) => (
            <div key={category}>
              <button
                className={cn("w-full flex items-center justify-between px-3 py-1 text-[11px] transition-colors hover:bg-[hsl(250_25%_94%)]", ab.textMuted)}
                onClick={() => setExpandedPalette(expandedPalette === category ? null : category)}
              >
                <span>{category}</span>
                <span className="text-[hsl(240_8%_55%)]">{expandedPalette === category ? "▴" : "▾"}</span>
              </button>

              {expandedPalette === category && (
                <div className="px-3 pb-1 flex flex-wrap gap-1">
                  {items.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={() => onDragNodeStart?.(item.type)}
                      className={cn(
                        "cursor-grab active:cursor-grabbing px-2 py-0.5 rounded-md text-[10px] border transition-colors select-none",
                        ab.chip,
                        "hover:bg-[hsl(248_40%_96%)]",
                      )}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
