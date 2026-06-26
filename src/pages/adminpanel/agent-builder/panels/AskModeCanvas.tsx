import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import { CanvasBackground } from "../three/CanvasBackground";

export function AskModeCanvas() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center p-8 min-h-0 w-full h-full">
      <CanvasBackground variant="studio" className="absolute inset-0" />
      <div className="relative z-10 max-w-sm w-full text-center space-y-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto", ab.accentSoft)}>
          <MessageCircle className={cn("w-5 h-5", ab.accentText)} />
        </div>
        <div className="space-y-2">
          <p className={cn("text-sm font-medium", ab.textForeground)}>Ask mode</p>
          <p className={cn("text-xs leading-relaxed", ab.textMuted)}>
            Answers appear in the chat panel. Use workspace context only — no workflow changes here.
          </p>
        </div>
        <p className={cn("text-[11px]", ab.textMuted)}>
          Switch to <span className={cn("font-medium", ab.accentText)}>Build</span> to design a workflow.
        </p>
      </div>
    </div>
  );
}
