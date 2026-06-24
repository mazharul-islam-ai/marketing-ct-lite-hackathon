import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles, Workflow, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { I420 } from "@/pages/adminpanel/agent-builder/i420Brand";
import { I420_ROUTES } from "@/lib/i420Routes";

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
    <div className="relative overflow-hidden rounded-xl border border-[hsl(248_35%_82%)] bg-gradient-to-br from-[hsl(248_45%_97%)] via-[hsl(250_33%_98%)] to-[hsl(270_40%_97%)] p-6">
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-[hsl(248_50%_62%/0.15)] blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(248_50%_62%)] px-2 py-0.5 text-[11px] font-bold tracking-tight text-white">
              <Sparkles className="h-3 w-3" />
              {I420.name}
            </span>
            <h2 className="text-xl font-bold tracking-tight">{I420.studioLabel}</h2>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">{I420.tagline}</p>
          {stats && (
            <p className="text-xs text-muted-foreground">
              {stats.agents} agents · {stats.automations} active automations · {stats.published} published to workspace
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="gap-2 bg-[hsl(248_50%_62%)] hover:bg-[hsl(248_50%_58%)]"
            onClick={() => navigate(I420_ROUTES.root)}
          >
            Open Studio
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(I420_ROUTES.automations)}>
            <Workflow className="h-4 w-4" />
            Automations
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/ai-agents")}>
            <Bot className="h-4 w-4" />
            Published Agents
          </Button>
        </div>
      </div>
    </div>
  );
}
