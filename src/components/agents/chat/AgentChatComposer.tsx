import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function AgentChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "Message this agent…",
  compact = false,
}: AgentChatComposerProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-stone-300/80 bg-white shadow-sm",
        compact ? "p-2" : "p-2.5",
      )}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 1}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex-1 resize-none bg-transparent text-sm text-stone-800 placeholder:text-stone-400",
          "focus:outline-none min-h-[40px] max-h-[160px] py-2 px-2",
        )}
      />
      <Button
        size="icon"
        className={cn(
          "shrink-0 rounded-xl h-9 w-9",
          "bg-stone-800 hover:bg-stone-700 text-white",
        )}
        onClick={onSend}
        disabled={disabled || !value.trim()}
      >
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
