import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import type { AgentChatMessage } from "../agentChatTypes";
import { AgentChatActivity } from "./AgentChatActivity";
import { AgentChatReferences } from "./AgentChatReferences";

interface AgentChatMessageProps {
  message: AgentChatMessage;
  compact?: boolean;
}

export function AgentChatMessageRow({ message, compact = false }: AgentChatMessageProps) {
  const isUser = message.role === "user";
  const isRunning = message.status === "running";
  const hasActivity = (message.activity?.length ?? 0) > 0 || isRunning;

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 mb-6">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 max-w-[85%] bg-stone-800 text-white",
            compact ? "text-xs" : "text-sm",
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-stone-300/70 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-stone-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="w-7 h-7 rounded-full bg-stone-200/80 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-stone-600" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {hasActivity && (
          <AgentChatActivity
            steps={message.activity ?? []}
            isRunning={isRunning}
            expanded={isRunning}
          />
        )}

        {message.content && (
          <div
            className={cn(
              "prose prose-stone max-w-none",
              compact ? "prose-sm text-xs" : "text-sm",
              message.status === "error" && "text-red-600",
              "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5",
            )}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {message.references && message.references.length > 0 && (
          <AgentChatReferences references={message.references} />
        )}

        {message.diagnostic && message.status === "complete" && !message.content.includes(message.diagnostic ?? "") && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            {message.diagnostic}
          </p>
        )}
      </div>
    </div>
  );
}
