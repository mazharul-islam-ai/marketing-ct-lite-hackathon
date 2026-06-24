import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, Sparkles, Settings2, Workflow, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { I420 } from "@/pages/adminpanel/agent-builder/i420Brand";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";
import { I420_ROUTES, isI420StudioEditorPath } from "@/lib/i420Routes";

export default function I420StudioLayout() {
  const location = useLocation();
  const isEditor = isI420StudioEditorPath(location.pathname);

  if (isEditor) {
    return (
      <div className={cn("min-h-screen i420-studio", ab.pageBg, ab.fontBody)}>
        <Outlet />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col i420-studio", ab.pageBg, ab.fontBody)}>
      <header className={cn(ab.studioHeader, "justify-between gap-4")}>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" asChild>
            <NavLink to="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </NavLink>
          </Button>
          <span className={cn(ab.i420Badge, "gap-1")}>
            <Sparkles className="h-3 w-3" />
            {I420.name}
          </span>
          <span className={cn("text-sm font-semibold truncate", ab.fontHeading, ab.textForeground)}>
            {I420.studioLabel}
          </span>
        </div>

        <nav className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <NavLink
              to={I420_ROUTES.automations}
              className={({ isActive }) => cn(isActive && ab.navActive)}
            >
              <Workflow className="h-3.5 w-3.5" />
              Automations
            </NavLink>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <NavLink
              to={I420_ROUTES.settings}
              className={({ isActive }) => cn(isActive && ab.navActive)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </NavLink>
          </Button>
          <Button size="sm" className={cn("h-8 text-xs gap-1.5", ab.accentBtn)} asChild>
            <NavLink to={I420_ROUTES.new}>
              <Plus className="h-3.5 w-3.5" />
              {I420.newWorkflowLabel}
            </NavLink>
          </Button>
        </nav>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
