import { ArrowLeft, Bot, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AgentChatLayoutAgent {
  id: string;
  name: string;
  description?: string | null;
}

interface AgentChatLayoutProps {
  agent: AgentChatLayoutAgent;
  onBack: () => void;
  onRunReport?: () => void;
  showRunReport?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** compact = modal/inline; full = dedicated page */
  variant?: "full" | "compact";
}

export function AgentChatLayout({
  agent,
  onBack,
  onRunReport,
  showRunReport,
  children,
  footer,
  variant = "full",
}: AgentChatLayoutProps) {
  const isFull = variant === "full";

  return (
    <div
      className={cn(
        "flex flex-col min-h-0",
        isFull ? "h-[calc(100vh-4rem)] bg-[#f7f5f0]" : "h-full bg-[#faf9f7]",
      )}
    >
      <header
        className={cn(
          "shrink-0 border-b border-stone-200/80 bg-[#faf9f7]/90 backdrop-blur-sm",
          isFull ? "px-4 py-3" : "px-3 py-2.5",
        )}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/60 transition-colors shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-xl bg-stone-200/70 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-stone-600" />
            </div>
            <div className="min-w-0">
              <h1 className={cn("font-semibold text-stone-800 truncate", isFull ? "text-sm" : "text-xs")}>
                {agent.name}
              </h1>
              {agent.description && isFull && (
                <p className="text-xs text-stone-500 truncate">{agent.description}</p>
              )}
            </div>
          </div>
          {showRunReport && onRunReport && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-stone-300 text-stone-700 shrink-0"
              onClick={onRunReport}
            >
              <Play className="w-3 h-3" />
              Run Report
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn("max-w-3xl mx-auto", isFull ? "px-4 py-6" : "px-3 py-3")}>
          {children}
        </div>
      </div>

      <footer className="shrink-0 border-t border-stone-200/80 bg-[#faf9f7]/95 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto">{footer}</div>
      </footer>
    </div>
  );
}
