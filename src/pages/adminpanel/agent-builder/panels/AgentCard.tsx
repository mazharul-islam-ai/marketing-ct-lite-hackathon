import { Play, Pencil, Loader2, Bot, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import { I420 } from "../i420Brand";
import type { FlowJSON, AgentRun } from "../types";
import { formatDistanceToNow } from "date-fns";
import { extractFlowModels } from "../extractFlowModels";
import FlowStepStrip from "./FlowStepStrip";
import { ModelChipRow } from "./ModelChipRow";
import { BuilderArtifactCard } from "./BuilderArtifactCard";
import { CardMetaStrip } from "./CardMetaStrip";

interface AgentCardProps {
  agentName: string;
  agentDescription?: string | null;
  agentStatus: "draft" | "published" | "archived";
  flowJson: FlowJSON | null;
  currentRun: AgentRun | null;
  isRunActive: boolean;
  isTriggering: boolean;
  canRun?: boolean;
  isEditOpen?: boolean;
  onEditToggle?: () => void;
  onRun: () => void;
  onStop: () => void;
  versionNumber?: number;
  isCompiling?: boolean;
  justRevealed?: boolean;
  reducedMotion?: boolean;
}

const STATUS_COLORS = {
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_DOTS = {
  published: "bg-emerald-500",
  draft: "bg-amber-400",
  archived: "bg-slate-400",
};

export function AgentCard({
  agentName,
  agentDescription,
  agentStatus,
  flowJson,
  currentRun,
  isRunActive,
  isTriggering,
  canRun = true,
  isEditOpen = false,
  onEditToggle,
  onRun,
  onStop,
  versionNumber,
  isCompiling = false,
  justRevealed = false,
  reducedMotion = false,
}: AgentCardProps) {
  const allNodes = flowJson
    ? [...(flowJson.trigger ? [flowJson.trigger] : []), ...flowJson.steps]
    : [];
  const nodeCount = allNodes.length;
  const hasFlow = nodeCount > 0;
  const flowModels = extractFlowModels(flowJson);

  const lastRunTime = currentRun?.completed_at ?? currentRun?.started_at;
  const lastRunStatus = currentRun?.status;

  const runStatusBadge =
    lastRunStatus === "completed"
      ? { label: "Success", cls: "text-emerald-600" }
      : lastRunStatus === "failed"
        ? { label: "Failed", cls: "text-red-600" }
        : lastRunStatus === "running" || lastRunStatus === "queued"
          ? { label: "Running…", cls: "text-[hsl(18_52%_52%)]" }
          : null;

  return (
    <BuilderArtifactCard
      variant="agent"
      hasFlow={hasFlow}
      isCompiling={isCompiling}
      isRunActive={isRunActive}
      justRevealed={justRevealed}
      reducedMotion={reducedMotion}
      metaStrip={<CardMetaStrip variant="agent" flowJson={flowJson} />}
      header={
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", ab.accentMuted)}>
              <Bot className={cn("w-5 h-5", ab.accentText)} />
            </div>
            <div className="min-w-0">
              <h2 className={cn("text-sm font-bold truncate leading-tight", ab.textForeground, ab.fontHeading)}>
                {agentName || I420.newWorkflowLabel}
              </h2>
              {agentDescription && (
                <p className={cn("text-[11px] mt-0.5 line-clamp-1", ab.textMuted)}>{agentDescription}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className={cn(ab.cardTypePill, ab.accentSoft)}>Agent</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                STATUS_COLORS[agentStatus],
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOTS[agentStatus])} />
              {agentStatus}
            </span>
            {isRunActive && (
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border relative", ab.accentSoft)}>
                <span className={cn("w-1.5 h-1.5 rounded-full animate-ping absolute", ab.accentBg)} />
                <span className={cn("w-1.5 h-1.5 rounded-full relative", ab.accentBg)} />
                Running…
              </span>
            )}
          </div>
        </div>
      }
      skeleton={
        <FlowStepStrip
          flowJson={flowJson}
          variant="agent"
          isRunActive={isRunActive}
          isCompiling={isCompiling}
          reducedMotion={reducedMotion}
          className={ab.cardSkeletonViewport}
        />
      }
      models={<ModelChipRow models={flowModels} isCompiling={isCompiling} />}
      stats={
        isCompiling ? (
          <div className="flex items-center gap-3">
            <div className={cn(ab.skeletonBar, "w-[72px]")} aria-hidden />
            {versionNumber != null && (
              <>
                <span className="text-slate-200">·</span>
                <div className={cn(ab.skeletonBar, "w-8")} aria-hidden />
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-slate-500">
              {nodeCount} node{nodeCount !== 1 ? "s" : ""}
            </span>
            {versionNumber != null && (
              <>
                <span className="text-slate-200">·</span>
                <span>v{versionNumber}</span>
              </>
            )}
            {lastRunTime && (
              <>
                <span className="text-slate-200">·</span>
                <span>Last run: {formatDistanceToNow(new Date(lastRunTime), { addSuffix: true })}</span>
              </>
            )}
            {runStatusBadge && (
              <>
                <span className="text-slate-200">·</span>
                <span className={runStatusBadge.cls}>{runStatusBadge.label}</span>
              </>
            )}
          </div>
        )
      }
      footer={
        <>
          <Button
            variant={isEditOpen ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-3 text-xs gap-1.5",
              isEditOpen
                ? "bg-[hsl(18_52%_52%)] hover:bg-[hsl(18_52%_46%)] text-white border-0"
                : "border-[hsl(35_15%_88%)] hover:border-[hsl(18_30%_75%)] hover:text-[hsl(18_45%_38%)]",
            )}
            onClick={onEditToggle}
          >
            <Pencil className="w-3 h-3" />
            {isEditOpen ? "Close Edit" : "Edit"}
          </Button>
          {isRunActive ? (
            <Button variant="destructive" size="sm" className="h-8 px-4 text-xs gap-1.5" onClick={onStop}>
              <Square className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className={cn("h-8 px-4 text-xs gap-1.5", ab.accentBtn)}
              onClick={onRun}
              disabled={isTriggering || !hasFlow || !canRun}
            >
              {isTriggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </Button>
          )}
        </>
      }
    />
  );
}
