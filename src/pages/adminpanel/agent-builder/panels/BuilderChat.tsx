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
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 space-y-1.5 min-w-[200px]">
      {COMPILE_PHASE_ORDER.map((phase) => {
        const isDone = status.completedPhases.includes(phase);
        const isCurrent = status.phase === phase;
        if (!isDone && !isCurrent && !visiblePhases.includes(phase)) return null;

        return (
          <div
            key={phase}
            className={cn(
              "flex items-center gap-2 text-[11px]",
              isDone && "text-slate-500",
              isCurrent && "text-violet-300",
              !isDone && !isCurrent && "text-slate-600",
            )}
          >
            {isDone ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="w-3 h-3 animate-spin text-violet-400 shrink-0" />
            ) : (
              <span className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />
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
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700/50">
      <div className="px-3 py-3 border-b border-slate-700/50 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none">AI Builder</p>
            {agentName && (
              <p className="text-xs font-medium text-slate-200 truncate mt-0.5">{agentName}</p>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        {chatHistory.length === 0 && !isCompiling && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-xs font-medium text-slate-300">Describe what you want to build</p>
            <p className="text-[11px] mt-1.5 text-slate-500 leading-relaxed px-2">
              e.g. "Daily unread email summary delivered to Slack at 8am"
            </p>
          </div>
        )}

        <div className="space-y-3">
          {chatHistory.length > 20 && (
            <p className="text-[11px] text-center text-slate-500 py-1">
              {chatHistory.length - 20} earlier message{chatHistory.length - 20 > 1 ? "s" : ""} hidden
            </p>
          )}
          {chatHistory.slice(-20).map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm shadow-lg shadow-violet-900/30"
                    : "bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/50",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isCompiling && compileStatus && (
            <div className="flex justify-start">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 mr-2">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
              <CompileStatusPanel status={compileStatus} />
            </div>
          )}

          {isCompiling && !compileStatus && (
            <div className="flex justify-start">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 mr-2">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                <span className="text-xs text-slate-400">Starting…</span>
              </div>
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="p-3 border-t border-slate-700/50 space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe or modify the flow…"
            className="resize-none text-xs pr-10 min-h-[68px] max-h-[120px] bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-violet-500/60 rounded-xl"
            disabled={isCompiling}
          />
          <Button
            size="icon"
            className="absolute bottom-1.5 right-1.5 h-7 w-7 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 rounded-lg shadow-md"
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
            className="flex-1 text-[11px] h-7 gap-1 text-slate-400 hover:text-violet-300 hover:bg-slate-800 rounded-lg"
            onClick={() => handleSend("generate")}
            disabled={!input.trim() || isCompiling}
          >
            <Sparkles className="w-3 h-3" />
            Generate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-[11px] h-7 gap-1 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg"
            onClick={() => handleSend("improve")}
            disabled={!input.trim() || isCompiling}
          >
            <Zap className="w-3 h-3" />
            Improve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-[11px] h-7 gap-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg"
            onClick={() => handleSend("add_tool")}
            disabled={!input.trim() || isCompiling}
          >
            <Wrench className="w-3 h-3" />
            Add Tool
          </Button>
        </div>
      </div>

      <div className="border-t border-slate-700/50">
        <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Node Palette (configured tools)
        </p>
        <div className="pb-2 space-y-0.5">
          {Object.entries(paletteItems).map(([category, items]) => (
            <div key={category}>
              <button
                className="w-full flex items-center justify-between px-3 py-1 text-[11px] text-slate-400 hover:bg-slate-800 transition-colors"
                onClick={() => setExpandedPalette(expandedPalette === category ? null : category)}
              >
                <span>{category}</span>
                <span className="text-slate-600">{expandedPalette === category ? "▴" : "▾"}</span>
              </button>

              {expandedPalette === category && (
                <div className="px-3 pb-1 flex flex-wrap gap-1">
                  {items.map((item) => (
                    <div
                      key={item.type}
                      draggable
                      onDragStart={() => onDragNodeStart?.(item.type)}
                      className="cursor-grab active:cursor-grabbing px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 hover:bg-violet-900/40 hover:text-violet-300 border border-slate-700 hover:border-violet-500/40 transition-colors select-none"
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
