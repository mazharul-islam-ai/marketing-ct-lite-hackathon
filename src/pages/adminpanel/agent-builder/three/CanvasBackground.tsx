import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { I420Canvas } from "./I420Canvas";
import { I420CanvasFallback } from "./I420CanvasFallback";
import type { CanvasBackgroundVariant } from "./i4203dTheme";

const CanvasBackgroundScene = lazy(() => import("./CanvasBackgroundScene"));

interface CanvasBackgroundProps {
  variant?: CanvasBackgroundVariant;
  running?: boolean;
  className?: string;
  opacity?: number;
}

export function CanvasBackground({
  variant = "studio",
  running = false,
  className,
  opacity = 1,
}: CanvasBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} style={{ opacity }}>
      <I420Canvas
        fallbackVariant="dots"
        camera={{ position: [0, 1.5, 6], fov: 50 }}
        className="inset-0"
      >
        <Suspense fallback={null}>
          <CanvasBackgroundScene variant={variant} running={running} />
        </Suspense>
      </I420Canvas>
      <I420CanvasFallback variant="dots" className="hidden [.no-webgl_&]:block" />
    </div>
  );
}
