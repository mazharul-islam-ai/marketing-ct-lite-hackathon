import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import type { FlowModelEntry } from "../extractFlowModels";

interface ModelChipRowProps {
  models: FlowModelEntry[];
  isCompiling?: boolean;
  className?: string;
}

export function ModelChipRow({ models, isCompiling = false, className }: ModelChipRowProps) {
  if (isCompiling) {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        <div className={cn(ab.skeletonBar, "w-20")} aria-hidden />
        <div className={cn(ab.skeletonBar, "w-24")} aria-hidden />
      </div>
    );
  }

  if (models.length === 0) {
    return <div className={cn(className, "min-h-[44px]")} aria-hidden />;
  }

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Models</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {models.map((entry) => (
          <span
            key={entry.model}
            className={cn(ab.modelChip)}
            title={`${entry.provider}: ${entry.model}`}
          >
            <span className="text-[9px] font-semibold text-[hsl(18_52%_52%)]">{entry.provider}</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono">{entry.model}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
