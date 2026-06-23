import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { I420Canvas } from "./I420Canvas";

const WelcomeScene = lazy(() => import("./WelcomeScene"));

interface WelcomeSceneLayerProps {
  className?: string;
}

export function WelcomeSceneLayer({ className }: WelcomeSceneLayerProps) {
  return (
    <div className={cn("relative w-[120px] h-[120px] mx-auto", className)}>
      <I420Canvas
        fallbackVariant="gradient"
        camera={{ position: [0, 0, 3.5], fov: 42 }}
        className="inset-0 rounded-2xl"
        alwaysAnimate
      >
        <Suspense fallback={null}>
          <WelcomeScene />
        </Suspense>
      </I420Canvas>
    </div>
  );
}
