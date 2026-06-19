import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FlowJSON } from "../types";

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveDraftOptions {
  isCompiling?: boolean;
  debounceMs?: number;
}

export function useAutoSaveDraft(
  agentId: string | null,
  versionId: string | null,
  flowJson: FlowJSON | null,
  options?: UseAutoSaveDraftOptions,
): { saveStatus: DraftSaveStatus } {
  const { isCompiling = false, debounceMs = 1500 } = options ?? {};
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const lastSavedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!agentId || !versionId || !flowJson || isCompiling) return;

    const serialized = JSON.stringify(flowJson);
    if (serialized === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      const { error } = await supabase
        .from("agent_versions" as never)
        .update({ flow_json: flowJson })
        .eq("id", versionId) as { error: unknown };

      if (error) {
        setSaveStatus("error");
        return;
      }

      lastSavedRef.current = serialized;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [agentId, versionId, flowJson, isCompiling, debounceMs]);

  return { saveStatus };
}
