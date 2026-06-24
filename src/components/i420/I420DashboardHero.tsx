import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles, Workflow, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { I420 } from "@/pages/adminpanel/agent-builder/i420Brand";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";
import { I420_ROUTES } from "@/lib/i420Routes";
import { cn } from "@/lib/utils";

export function I420DashboardHero() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["i420-dashboard-stats"],
    queryFn: async () => {
      const [agentsRes, automationsRes, publishedRes] = await Promise.all([
        supabase.from("agents" as never).select("id", { count: "exact", head: true }),
        supabase.from("automations" as never).select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("agents" as never)
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .eq("visibility", "workspace"),
      ]);
      return {
        agents: agentsRes.count ?? 0,
        automations: automationsRes.count ?? 0,
        published: publishedRes.count ?? 0,
      };
    },
  });

  return (
    <div className={cn("relative overflow-hidden rounded-xl border p-6", ab.border, ab.pageBg)}>
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-[hsl(18_52%_52%/0.08)] blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(ab.i420Badge, "gap-1")}>
              <Sparkles className="h-3 w-3" />
              {I420.name}
            </span>
            <h2 className={cn("text-xl font-bold tracking-tight", ab.fontHeading, ab.textForeground)}>
              {I420.studioLabel}
            </h2>
          </div>
          <p className={cn("max-w-xl text-sm", ab.textMuted)}>{I420.tagline}</p>
          {stats && (
            <p className={cn("text-xs", ab.textMuted)}>
              {stats.agents} agents · {stats.automations} active automations · {stats.published} published to workspace
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className={cn("gap-2", ab.accentBtn)} onClick={() => navigate(I420_ROUTES.root)}>
            Open Studio
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className={cn("gap-2", ab.border, "hover:bg-[hsl(40_20%_96%)]")}
            onClick={() => navigate(I420_ROUTES.automations)}
          >
            <Workflow className="h-4 w-4" />
            Automations
          </Button>
          <Button
            variant="outline"
            className={cn("gap-2", ab.border, "hover:bg-[hsl(40_20%_96%)]")}
            onClick={() => navigate("/ai-agents")}
          >
            <Bot className="h-4 w-4" />
            Published Agents
          </Button>
        </div>
      </div>
    </div>
  );
}
