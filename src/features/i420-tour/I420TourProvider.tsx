import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./i420TourTheme.css";

import { useAuth } from "@/hooks/useAuth";
import { I420_ROUTES } from "@/lib/i420Routes";
import {
  getTourConfig,
  getTourStartIndex,
  I420_DEMO_AGENT_ID,
  type TourSection,
} from "./tourSteps";
import { clearTourCompleted, isTourCompleted, markTourCompleted } from "./tourStorage";
import { waitForTourTarget } from "./waitForTourTarget";
import { I420TourContext, type I420TourContextValue } from "./useI420Tour";

interface I420TourProviderProps {
  children: ReactNode;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function prepareSectionRoute(
  section: TourSection,
  navigate: (path: string) => void,
): Promise<void> {
  switch (section) {
    case "dashboard":
      navigate(I420_ROUTES.root);
      await waitForTourTarget("i420-tour-composer").catch(() => undefined);
      break;
    case "settings":
      navigate(I420_ROUTES.settings);
      await waitForTourTarget("i420-tour-settings-tabs").catch(() => undefined);
      break;
    case "studio":
      navigate(I420_ROUTES.agent(I420_DEMO_AGENT_ID));
      try {
        await waitForTourTarget("i420-tour-builder-chat", { timeout: 12000 });
      } catch {
        navigate(I420_ROUTES.new);
        await waitForTourTarget("i420-tour-builder-chat").catch(() => undefined);
      }
      break;
    case "workspace":
      navigate("/ai-agents");
      await waitForTourTarget("i420-tour-workspace-agents").catch(() => undefined);
      break;
    case "automations":
      navigate(I420_ROUTES.automations);
      await waitForTourTarget("i420-tour-automations-list").catch(() => undefined);
      break;
    case "debug":
      break;
    default:
      break;
  }
}

export function I420TourProvider({ children }: I420TourProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const driverRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(() => isTourCompleted(user?.id));

  useEffect(() => {
    setCompleted(isTourCompleted(user?.id));
  }, [user?.id]);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
    setIsRunning(false);
  }, []);

  const markCompleted = useCallback(() => {
    markTourCompleted(user?.id);
    setCompleted(true);
  }, [user?.id]);

  const startTour = useCallback(
    async (section: TourSection = "full") => {
      destroyDriver();

      if (section !== "debug" && section !== "full") {
        await prepareSectionRoute(section, navigate);
      } else if (section === "full") {
        if (!location.pathname.startsWith(I420_ROUTES.root)) {
          navigate(I420_ROUTES.root);
        }
        await waitForTourTarget("i420-tour-composer").catch(() => undefined);
      }

      const ctx = {
        navigate,
        markCompleted,
        prefersReducedMotion: prefersReducedMotion(),
      };

      const config = getTourConfig(ctx);
      const startIndex = getTourStartIndex(section);
      const instance = driver({
        ...config,
        onDestroyed: () => {
          config.onDestroyed?.();
          driverRef.current = null;
          setIsRunning(false);
        },
      });
      driverRef.current = instance;
      setIsRunning(true);
      instance.drive(startIndex);
    },
    [destroyDriver, location.pathname, markCompleted, navigate],
  );

  const resetTour = useCallback(() => {
    clearTourCompleted(user?.id);
    setCompleted(false);
  }, [user?.id]);

  // Auto-start on first visit to /i420 dashboard (super_admin only)
  useEffect(() => {
    if (!user?.id || user.role !== "super_admin") return;
    if (autoStartedRef.current || isTourCompleted(user.id)) return;
    if (location.pathname !== I420_ROUTES.root) return;

    autoStartedRef.current = true;
    const timer = window.setTimeout(() => {
      void startTour("full");
    }, 600);

    return () => window.clearTimeout(timer);
  }, [user?.id, location.pathname, startTour]);

  useEffect(() => {
    return () => destroyDriver();
  }, [destroyDriver]);

  const value = useMemo<I420TourContextValue>(
    () => ({
      startTour,
      isRunning,
      isCompleted: completed,
      resetTour,
    }),
    [startTour, isRunning, completed, resetTour],
  );

  return (
    <I420TourContext.Provider value={value}>
      {children}
    </I420TourContext.Provider>
  );
}
