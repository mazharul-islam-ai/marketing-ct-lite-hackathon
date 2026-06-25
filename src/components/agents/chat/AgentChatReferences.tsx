import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatReference } from "../agentChatTypes";

interface AgentChatReferencesProps {
  references: ChatReference[];
  className?: string;
}

export function AgentChatReferences({ references, className }: AgentChatReferencesProps) {
  if (references.length === 0) return null;

  return (
    <div className={cn("mt-3 space-y-2", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
        References
      </p>
      <div className="space-y-1.5">
        {references.map((reference, index) => (
          <ReferenceCard key={reference.id} reference={reference} index={index + 1} />
        ))}
      </div>
    </div>
  );
}

function ReferenceCard({ reference, index }: { reference: ChatReference; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-stone-200/80 bg-white/60 overflow-hidden">
      <button
        type="button"
        onClick={() => reference.snippet && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-start gap-2 px-3 py-2 text-left text-xs",
          reference.snippet && "hover:bg-stone-50/80 cursor-pointer",
        )}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded bg-stone-200/70 text-[10px] font-semibold text-stone-600 shrink-0">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-stone-700 truncate">{reference.title}</span>
            {reference.meta && (
              <span className="text-[10px] text-stone-400 shrink-0">{reference.meta}</span>
            )}
          </div>
          {reference.snippet && !expanded && (
            <p className="text-stone-500 mt-0.5 line-clamp-1">{reference.snippet}</p>
          )}
        </div>
        {reference.snippet && (
          expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
          )
        )}
      </button>
      {expanded && reference.snippet && (
        <div className="px-3 pb-2.5 pt-0 border-t border-stone-100">
          <pre className="text-[10px] text-stone-500 whitespace-pre-wrap break-words font-mono leading-relaxed mt-2">
            {reference.snippet}
          </pre>
        </div>
      )}
    </div>
  );
}
