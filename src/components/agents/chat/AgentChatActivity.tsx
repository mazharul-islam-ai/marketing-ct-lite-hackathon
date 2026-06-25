import { useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatActivityStep } from "../agentChatTypes";

interface AgentChatActivityProps {
  steps: ChatActivityStep[];
  expanded?: boolean;
  isRunning?: boolean;
  className?: string;
}

function activityIcon(nodeType: string, isRunning: boolean) {
  const cls = cn("w-3.5 h-3.5 shrink-0", isRunning && "animate-pulse");
  if (nodeType.includes("llm")) return <Brain className={cls} />;
  if (nodeType === "db_query") return <Database className={cls} />;
  if (nodeType === "mcp_tool") return <Wrench className={cls} />;
  if (nodeType === "slack_fetch_messages") return <MessageSquare className={cls} />;
  if (nodeType === "gmail_fetch_unread") return <Mail className={cls} />;
  if (nodeType === "api_call") return <Globe className={cls} />;
  return <Brain className={cls} />;
}

export function AgentChatActivity({
  steps,
  expanded: defaultExpanded,
  isRunning = false,
  className,
}: AgentChatActivityProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? defaultExpanded ?? isRunning;

  if (steps.length === 0 && !isRunning) return null;

  const runningStep = steps.find((s) => s.status === "running");
  const failedStep = steps.find((s) => s.status === "failed");
  const summaryLabel = isRunning
    ? runningStep?.label ?? "Working…"
    : failedStep
      ? "Run failed"
      : `${steps.length} step${steps.length === 1 ? "" : "s"}`;

  return (
    <div className={cn("rounded-xl border border-stone-200/80 bg-stone-100/50 overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setManualExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-200/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-stone-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-stone-400" />
        )}
        {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500 shrink-0" />}
        <span className="font-medium">{summaryLabel}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 space-y-1.5 border-t border-stone-200/60">
          {steps.length === 0 && isRunning && (
            <div className="flex items-center gap-2 text-xs text-stone-500 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Starting…
            </div>
          )}
          {steps.map((step) => {
            const stepRunning = step.status === "running";
            const stepFailed = step.status === "failed";
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-2 text-xs py-1",
                  stepRunning && "text-stone-700",
                  stepFailed && "text-red-600",
                  !stepRunning && !stepFailed && "text-stone-500",
                )}
              >
                {stepFailed ? (
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                ) : stepRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />
                ) : (
                  activityIcon(step.nodeType, false)
                )}
                <div className="min-w-0">
                  <span>{step.label}</span>
                  {step.detail && (
                    <span className="text-stone-400 ml-1">· {step.detail}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
