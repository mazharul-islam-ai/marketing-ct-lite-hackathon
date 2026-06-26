import { HelpCircle, Map, Bug, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ab } from "@/pages/adminpanel/agent-builder/agentBuilderTheme";
import { useI420TourOptional } from "@/features/i420-tour/useI420Tour";
import type { TourSection } from "@/features/i420-tour/tourSteps";

interface I420TourHelpButtonProps {
  className?: string;
  variant?: "ghost" | "outline";
}

export function I420TourHelpButton({
  className,
  variant = "ghost",
}: I420TourHelpButtonProps) {
  const tour = useI420TourOptional();
  if (!tour) return null;

  const start = (section: TourSection) => {
    void tour.startTour(section);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", className)}
          aria-label="i420 help and tour"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Help</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          i420 guided tour
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("full")}
          disabled={tour.isRunning}
        >
          <Play className="h-3.5 w-3.5" />
          Start full tour
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Jump to section
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("dashboard")}
          disabled={tour.isRunning}
        >
          <Map className="h-3.5 w-3.5" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("settings")}
          disabled={tour.isRunning}
        >
          <Map className="h-3.5 w-3.5" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("studio")}
          disabled={tour.isRunning}
        >
          <Map className="h-3.5 w-3.5" />
          Studio editor
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("workspace")}
          disabled={tour.isRunning}
        >
          <Map className="h-3.5 w-3.5" />
          Workspace /ai-agents
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-xs cursor-pointer"
          onClick={() => start("automations")}
          disabled={tour.isRunning}
        >
          <Map className="h-3.5 w-3.5" />
          Automations
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn("gap-2 text-xs cursor-pointer", ab.accentText)}
          onClick={() => start("debug")}
          disabled={tour.isRunning}
        >
          <Bug className="h-3.5 w-3.5" />
          Troubleshooting guide
        </DropdownMenuItem>
        {tour.isCompleted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer"
              onClick={() => {
                tour.resetTour();
                void tour.startTour("full");
              }}
              disabled={tour.isRunning}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset &amp; replay tour
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
