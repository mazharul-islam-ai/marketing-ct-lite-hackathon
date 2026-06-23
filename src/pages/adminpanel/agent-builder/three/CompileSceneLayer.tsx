import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { I420Canvas } from "./I420Canvas";

const CompileSceneContent = lazy(() => import("./CompileScene"));

interface CompileSceneLayerProps {
  phase?: string;
  completedPhases?: string[];
  className?: string;
}

export function CompileSceneLayer({ phase, completedPhases, className }: CompileSceneLayerProps) {
  return (
    <div className={cn("w-full h-20 rounded-lg overflow-hidden", className)}>
      <I420Canvas
        fallbackVariant="gradient"
        camera={{ position: [0, 0, 3], fov: 40 }}
        alwaysAnimate
      >
        <Suspense fallback={null}>
          <CompileSceneContent phase={phase} completedPhases={completedPhases} />
        </Suspense>
      </I420Canvas>
    </div>
  );
}
