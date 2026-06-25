import { memo } from "react";
import { cn } from "@/lib/utils";
import { I420Canvas } from "./I420Canvas";
import type { FlowJSON } from "../types";
import FlowPipelineScene from "./FlowPipelineScene";
import { SKELETON_CAMERA } from "./skeletonShared";

interface CardSkeletonSceneLayerProps {
  flowJson: FlowJSON | null;
  variant?: "agent" | "automation";
  isRunActive?: boolean;
  isCompiling?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

function CardSkeletonSceneLayer({
  flowJson,
  variant = "agent",
  isRunActive = false,
  isCompiling = false,
  reducedMotion = false,
  className,
}: CardSkeletonSceneLayerProps) {
  const camera = SKELETON_CAMERA[variant];

  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] pointer-events-none isolate",
        isCompiling && "opacity-60",
        className,
      )}
    >
      <I420Canvas
        layout="embedded"
        fallbackVariant="gradient"
        camera={{ position: [...camera.position], fov: camera.fov }}
        alwaysAnimate={isRunActive && !reducedMotion}
        className="h-full w-full"
      >
        <FlowPipelineScene
          flowJson={flowJson}
          variant={variant}
          isRunActive={isRunActive}
          reducedMotion={reducedMotion}
        />
      </I420Canvas>
      <div className="absolute bottom-1.5 inset-x-0 flex justify-center pointer-events-none">
        <span className="text-[9px] text-slate-400/80 tracking-wide select-none">
          Trigger · AI · Tool · Output
        </span>
      </div>
    </div>
  );
}

export default memo(CardSkeletonSceneLayer);
