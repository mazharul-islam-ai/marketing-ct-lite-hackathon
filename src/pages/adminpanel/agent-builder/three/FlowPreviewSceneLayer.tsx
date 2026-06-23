import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { I420Canvas } from "./I420Canvas";
import type { FlowJSON } from "../types";

const FlowPreviewSceneContent = lazy(() => import("./FlowPreviewScene"));

interface FlowPreviewSceneLayerProps {
  flowJson: FlowJSON | null;
  variant?: "agent" | "automation";
  isRunActive?: boolean;
  className?: string;
}

export function FlowPreviewSceneLayer({
  flowJson,
  variant = "agent",
  isRunActive = false,
  className,
}: FlowPreviewSceneLayerProps) {
  return (
    <div className={cn("w-full h-16 rounded-lg overflow-hidden bg-[hsl(250_28%_97%)]", className)}>
      <I420Canvas
        fallbackVariant="gradient"
        camera={{ position: [0, 0, 2.2], fov: 45 }}
        alwaysAnimate={isRunActive}
      >
        <Suspense fallback={null}>
          <FlowPreviewSceneContent
            flowJson={flowJson}
            variant={variant}
            isRunActive={isRunActive}
          />
        </Suspense>
      </I420Canvas>
    </div>
  );
}
