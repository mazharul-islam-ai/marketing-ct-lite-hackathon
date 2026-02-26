import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackStats {
  openBugs: number;
  openFeatures: number;
  inProgress: number;
  resolved: number;
  closed: number;
  criticalBugs: number;
  highBugs: number;
  bugsByStatus: { open: number; in_progress: number; resolved: number; closed: number };
  featuresByStatus: { open: number; in_progress: number; resolved: number; closed: number };
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: ["feedback-stats"],
    queryFn: async (): Promise<FeedbackStats> => {
      const { data, error } = await (supabase as any)
        .from("feedback_reports")
        .select("id, type, status, priority, deleted_at")
        .is("deleted_at", null);

      if (error) throw error;

      const items = data || [];

      const bugs = items.filter((f) => f.type === "bug");
      const features = items.filter((f) => f.type === "feature");

      const bugsByStatus = {
        open: bugs.filter((f) => f.status === "open").length,
        in_progress: bugs.filter((f) => f.status === "in_progress").length,
        resolved: bugs.filter((f) => f.status === "resolved").length,
        closed: bugs.filter((f) => f.status === "closed").length,
      };

      const featuresByStatus = {
        open: features.filter((f) => f.status === "open").length,
        in_progress: features.filter((f) => f.status === "in_progress").length,
        resolved: features.filter((f) => f.status === "resolved").length,
        closed: features.filter((f) => f.status === "closed").length,
      };

      return {
        openBugs: bugsByStatus.open,
        openFeatures: featuresByStatus.open,
        inProgress: items.filter((f) => f.status === "in_progress").length,
        resolved: items.filter((f) => f.status === "resolved").length,
        closed: items.filter((f) => f.status === "closed").length,
        criticalBugs: bugs.filter((f) => f.priority === "critical").length,
        highBugs: bugs.filter((f) => f.priority === "high").length,
        bugsByStatus,
        featuresByStatus,
      };
    },
  });
}
