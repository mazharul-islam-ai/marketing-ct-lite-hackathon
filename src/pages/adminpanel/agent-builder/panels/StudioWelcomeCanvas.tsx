import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import { I420, I420_WELCOME_HINTS, I420_EXAMPLE_PROMPTS } from "../i420Brand";
import { WelcomeSceneLayer } from "../three/WelcomeSceneLayer";
import { CanvasBackground } from "../three/CanvasBackground";

interface StudioWelcomeCanvasProps {
  onExampleClick?: (prompt: string) => void;
}

export function StudioWelcomeCanvas({ onExampleClick }: StudioWelcomeCanvasProps) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center p-8 min-h-0 w-full">
      <CanvasBackground variant="welcome" className="absolute inset-0" />
      <div className="relative z-10 max-w-md w-full text-center space-y-6">
        <WelcomeSceneLayer />

        <div className="space-y-2">
          <p className={cn(ab.i420Wordmark, "text-2xl")}>{I420.name}</p>
          <p className={cn("text-sm", ab.textMuted)}>{I420.tagline}</p>
        </div>

        <ul className="text-left space-y-2 mx-auto max-w-xs">
          {I420_WELCOME_HINTS.map((hint) => (
            <li key={hint} className={cn("flex items-start gap-2 text-xs", ab.textMuted)}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[hsl(248_50%_62%)]" />
              {hint}
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <p className={cn("text-[10px] font-semibold uppercase tracking-wide", ab.textMuted)}>
            Try an example
          </p>
          <div className="flex flex-col gap-1.5">
            {I420_EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onExampleClick?.(prompt)}
                className={cn(
                  "text-left text-[11px] px-3 py-2 rounded-lg border transition-all duration-300",
                  ab.chip,
                  ab.chip3dHover,
                )}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <p className={cn("text-[11px] flex items-center justify-center gap-1.5", ab.textMuted)}>
          <ArrowLeft className="w-3 h-3 shrink-0" />
          Start typing in the chat panel
        </p>
      </div>
    </div>
  );
}
