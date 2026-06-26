import { createContext, useContext } from "react";
import type { TourSection } from "./tourSteps";

export interface I420TourContextValue {
  startTour: (section?: TourSection) => void;
  isRunning: boolean;
  isCompleted: boolean;
  resetTour: () => void;
}

export const I420TourContext = createContext<I420TourContextValue | null>(null);

export function useI420Tour(): I420TourContextValue {
  const ctx = useContext(I420TourContext);
  if (!ctx) {
    throw new Error("useI420Tour must be used within I420TourProvider");
  }
  return ctx;
}

/** Safe hook for optional tour access outside provider (returns null). */
export function useI420TourOptional(): I420TourContextValue | null {
  return useContext(I420TourContext);
}
