import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { I420CanvasFallback } from "./I420CanvasFallback";
import { usePageVisibility, useReducedMotion3d } from "./useReducedMotion3d";

interface I420CanvasProps {
  children: ReactNode;
  className?: string;
  fallbackVariant?: "dots" | "gradient";
  /** When true, keeps rendering even if tab is hidden */
  alwaysAnimate?: boolean;
  camera?: { position: [number, number, number]; fov?: number };
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function I420Canvas({
  children,
  className,
  fallbackVariant = "dots",
  alwaysAnimate = false,
  camera = { position: [0, 0, 5], fov: 45 },
}: I420CanvasProps) {
  const reducedMotion = useReducedMotion3d();
  const pageVisible = usePageVisibility();
  const fallback = <I420CanvasFallback variant={fallbackVariant} />;

  if (reducedMotion) {
    return (
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        {fallback}
      </div>
    );
  }

  const frameloop = alwaysAnimate || pageVisible ? "always" : "demand";

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <CanvasErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <Canvas
            dpr={[1, 1.5]}
            frameloop={frameloop}
            camera={camera}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            {children}
          </Canvas>
        </Suspense>
      </CanvasErrorBoundary>
    </div>
  );
}
