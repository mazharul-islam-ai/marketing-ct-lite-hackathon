import { useEffect, useState } from "react";

/** Returns true when WebGL 3D should be disabled (accessibility). */
export function useReducedMotion3d(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/** Pause R3F frameloop when tab is hidden to save GPU. */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? !document.hidden : true,
  );

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}
