import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";

interface I420CanvasFallbackProps {
  className?: string;
  variant?: "dots" | "gradient";
}

/** CSS-only fallback when WebGL is unavailable or reduced motion is on. */
export function I420CanvasFallback({ className, variant = "dots" }: I420CanvasFallbackProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        variant === "dots" && ab.canvas,
        className,
      )}
      style={
        variant === "dots"
          ? {
              backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }
          : {
              background:
                "radial-gradient(ellipse 80% 60% at 50% 40%, hsl(18 40% 94% / 0.5), transparent 70%), hsl(40 33% 97%)",
            }
      }
      aria-hidden
    />
  );
}
