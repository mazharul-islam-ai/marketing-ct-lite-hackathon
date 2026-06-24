import { LayoutGrid, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";

export type CanvasViewMode = "card" | "flow";

interface CanvasToolbarProps {
  mode: CanvasViewMode;
  onModeChange: (mode: CanvasViewMode) => void;
  isRunActive?: boolean;
}

export function CanvasToolbar({ mode, onModeChange, isRunActive }: CanvasToolbarProps) {
  return (
    <div className={cn(ab.canvasToolbar, "justify-between")}>
      <div className="flex items-center gap-0.5 bg-[hsl(40_20%_96%)] rounded-lg p-0.5">
        <button
          onClick={() => onModeChange("card")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
            mode === "card" ? ab.viewToggleActive : ab.viewToggleInactive,
          )}
        >
          <LayoutGrid className="w-3 h-3" />
          Card
        </button>
        <button
          onClick={() => onModeChange("flow")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
            mode === "flow" ? ab.viewToggleActive : ab.viewToggleInactive,
          )}
        >
          <Workflow className="w-3 h-3" />
          Flow
        </button>
      </div>

      {isRunActive && (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[hsl(18_52%_52%)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(18_52%_52%)] animate-ping" />
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(18_52%_52%)] absolute animate-pulse" />
          Running…
        </div>
      )}
    </div>
  );
}
