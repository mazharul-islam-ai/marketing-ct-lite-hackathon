import { memo } from "react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import type { FlowJSON } from "../types";
import {
  buildFlowSteps,
  truncateSteps,
  type FlowStepItem,
} from "../buildFlowSteps";

interface FlowStepStripProps {
  flowJson: FlowJSON | null;
  variant?: "agent" | "automation";
  isRunActive?: boolean;
  isCompiling?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

const STEP_INDEX_BADGES = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

function OverflowChip({ count, labels }: { count: number; labels: string[] }) {
  if (count <= 0) return null;
  const title = labels.length > 0 ? labels.join(" → ") : undefined;
  return (
    <span className={ab.stepStripOverflowChip} title={title}>
      +{count} more
    </span>
  );
}

function AgentStepChip({
  step,
  isActive,
  reducedMotion,
}: {
  step: FlowStepItem;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center gap-0.5 max-w-[88px] shrink-0",
        isActive &&
          !reducedMotion &&
          ab.stepStripRunningAgent,
        isActive && reducedMotion && "ring-2 ring-[hsl(18_52%_52%)] ring-offset-1",
      )}
      title={step.modelSubtitle ? `${step.label} · ${step.modelSubtitle}` : step.label}
    >
      <span
        className={cn(
          ab.nodeChip,
          "rounded-full px-2.5 py-1 flex items-center gap-1 border",
          step.chipBg,
          step.chipText,
        )}
      >
        <span className="text-xs leading-none">{step.icon}</span>
        <span className="truncate text-[10px] font-semibold">{step.label}</span>
      </span>
      {step.modelSubtitle && (
        <span className="text-[9px] text-slate-400 font-mono truncate max-w-full px-0.5">
          {step.modelSubtitle}
        </span>
      )}
      {step.category === "trigger" && !step.modelSubtitle && (
        <span className="text-[9px] text-slate-400 truncate max-w-full">trigger</span>
      )}
    </div>
  );
}

function AutomationStepTicket({
  step,
  isActive,
  reducedMotion,
}: {
  step: FlowStepItem;
  isActive: boolean;
  reducedMotion: boolean;
}) {
  const badge = STEP_INDEX_BADGES[step.stepIndex - 1] ?? String(step.stepIndex);

  return (
    <div
      className={cn(
        "relative inline-flex flex-col items-center max-w-[72px] shrink-0 pt-2",
        isActive &&
          !reducedMotion &&
          "animate-pulse",
      )}
      title={step.modelSubtitle ? `${step.label} · ${step.modelSubtitle}` : step.label}
    >
      <span className="absolute -top-0.5 left-0 text-[9px] font-mono text-slate-400 leading-none select-none">
        {badge}
      </span>
      <span
        className={cn(
          "inline-flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 w-full",
          step.chipBg,
          isActive && "ring-2 ring-[hsl(30_15%_55%)] ring-offset-1",
        )}
      >
        <span className="text-sm leading-none">{step.icon}</span>
        <span className={cn("text-[10px] font-semibold truncate w-full text-center", step.chipText)}>
          {step.label}
        </span>
      </span>
      {step.modelSubtitle && (
        <span className="text-[8px] text-slate-400 font-mono truncate max-w-full mt-0.5">
          {step.modelSubtitle}
        </span>
      )}
    </div>
  );
}

function AgentConnector() {
  return (
    <span className={cn("text-sm font-medium shrink-0 select-none px-0.5", ab.stepStripAgentConnector)}>
      →
    </span>
  );
}

function AutoConnector() {
  return (
    <span className="text-slate-300 shrink-0 select-none px-1 text-xs">—</span>
  );
}

function StepStripSkeleton({ variant }: { variant: "agent" | "automation" }) {
  const count = variant === "agent" ? 3 : 4;
  const widths = variant === "agent" ? ["w-16", "w-20", "w-14"] : ["w-12", "w-12", "w-12", "w-12"];

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={cn(
              ab.skeletonBar,
              widths[i] ?? "w-14",
              variant === "agent" ? "h-7 rounded-full" : "h-12 rounded-md",
            )}
            aria-hidden
          />
          {i < count - 1 &&
            (variant === "agent" ? (
              <span className={cn("text-sm opacity-30", ab.stepStripAgentConnector)}>→</span>
            ) : (
              <span className="text-slate-200 text-xs">—</span>
            ))}
        </div>
      ))}
    </div>
  );
}

function AutomationProgressDots({
  total,
  activeIndex,
  reducedMotion,
}: {
  total: number;
  activeIndex: number;
  reducedMotion: boolean;
}) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 mt-3">
      {Array.from({ length: total }).map((_, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;

        if (isDone) {
          return (
            <span
              key={i}
              className={cn("text-[10px] font-bold", ab.stepStripRunningAutoDone)}
            >
              ✓
            </span>
          );
        }

        if (isActive) {
          return (
            <span
              key={i}
              className={cn(
                "w-2 h-2 rounded-full",
                ab.stepStripRunningAutoActive,
                !reducedMotion && "animate-pulse",
              )}
            />
          );
        }

        return (
          <span
            key={i}
            className={cn("w-2 h-2 rounded-full", ab.stepStripRunningAutoPending)}
          />
        );
      })}
    </div>
  );
}

function AgentStepStrip({
  visible,
  overflowCount,
  overflowLabels,
  isRunActive,
  reducedMotion,
}: {
  visible: FlowStepItem[];
  overflowCount: number;
  overflowLabels: string[];
  isRunActive: boolean;
  reducedMotion: boolean;
}) {
  const activeIndex = isRunActive ? Math.min(1, visible.length - 1) : -1;

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap px-1">
      {visible.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          {i > 0 && <AgentConnector />}
          <AgentStepChip
            step={step}
            isActive={isRunActive && i === activeIndex}
            reducedMotion={reducedMotion}
          />
        </div>
      ))}
      {overflowCount > 0 && (
        <>
          <AgentConnector />
          <OverflowChip count={overflowCount} labels={overflowLabels} />
        </>
      )}
    </div>
  );
}

function AutomationStepStrip({
  visible,
  overflowCount,
  overflowLabels,
  isRunActive,
  reducedMotion,
}: {
  visible: FlowStepItem[];
  overflowCount: number;
  overflowLabels: string[];
  isRunActive: boolean;
  reducedMotion: boolean;
}) {
  const totalSteps = visible.length + overflowCount;
  const activeIndex = isRunActive ? Math.min(1, visible.length - 1) : -1;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full flex items-center justify-center min-h-[80px]">
        <div
          className={cn("absolute left-4 right-4 h-px top-1/2 -translate-y-1/2", ab.stepStripAutoRail)}
          aria-hidden
        />
        <div className="relative flex items-center justify-center gap-0.5 flex-wrap z-[1]">
          {visible.map((step, i) => (
            <div key={step.id} className="flex items-center">
              {i > 0 && <AutoConnector />}
              <AutomationStepTicket
                step={step}
                isActive={isRunActive && i === activeIndex}
                reducedMotion={reducedMotion}
              />
            </div>
          ))}
          {overflowCount > 0 && (
            <>
              <AutoConnector />
              <div className="relative pt-2">
                <OverflowChip count={overflowCount} labels={overflowLabels} />
              </div>
            </>
          )}
        </div>
      </div>
      {isRunActive && (
        <AutomationProgressDots
          total={Math.min(totalSteps, 4)}
          activeIndex={activeIndex}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}

function FlowStepStrip({
  flowJson,
  variant = "agent",
  isRunActive = false,
  isCompiling = false,
  reducedMotion = false,
  className,
}: FlowStepStripProps) {
  const steps = buildFlowSteps(flowJson);
  const { visible, overflowCount, overflowLabels } = truncateSteps(steps, 4);

  return (
    <div
      className={cn(
        "relative w-full shrink-0 overflow-hidden rounded-xl border border-[hsl(35_15%_88%)] bg-[hsl(40_25%_99%)] pointer-events-none flex items-center justify-center px-3",
        isCompiling && "opacity-60",
        className,
      )}
    >
      {isCompiling ? (
        <StepStripSkeleton variant={variant} />
      ) : variant === "agent" ? (
        <AgentStepStrip
          visible={visible}
          overflowCount={overflowCount}
          overflowLabels={overflowLabels}
          isRunActive={isRunActive}
          reducedMotion={reducedMotion}
        />
      ) : (
        <AutomationStepStrip
          visible={visible}
          overflowCount={overflowCount}
          overflowLabels={overflowLabels}
          isRunActive={isRunActive}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}

export default memo(FlowStepStrip);
