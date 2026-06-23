import { Play, Pencil, Loader2, Bot, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import { I420 } from "../i420Brand";
import { FlowPreviewSceneLayer } from "../three/FlowPreviewSceneLayer";
import type { FlowJSON, AgentRun } from "../types";
import { formatDistanceToNow } from "date-fns";

interface AgentCardProps {
  agentName: string;
  agentDescription?: string | null;
  agentStatus: "draft" | "published" | "archived";
  flowJson: FlowJSON | null;
  currentRun: AgentRun | null;
  isRunActive: boolean;
  isTriggering: boolean;
  isEditOpen?: boolean;
  onEditToggle?: () => void;
  onRun: () => void;
  onStop: () => void;
  versionNumber?: number;
}

const STATUS_COLORS = {
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft:     "bg-amber-100 text-amber-700 border-amber-200",
  archived:  "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_DOTS = {
  published: "bg-emerald-500",
  draft:     "bg-amber-400",
  archived:  "bg-slate-400",
};

export function AgentCard({
  agentName,
  agentDescription,
  agentStatus,
  flowJson,
  currentRun,
  isRunActive,
  isTriggering,
  isEditOpen = false,
  onEditToggle,
  onRun,
  onStop,
  versionNumber,
}: AgentCardProps) {

  const allNodes = flowJson
    ? [...(flowJson.trigger ? [flowJson.trigger] : []), ...flowJson.steps]
    : [];

  const nodeCount = allNodes.length;

  const lastRunTime = currentRun?.completed_at ?? currentRun?.started_at;
  const lastRunStatus = currentRun?.status;

  const runStatusBadge =
    lastRunStatus === "completed"
      ? { label: "Success", cls: "text-emerald-600" }
      : lastRunStatus === "failed"
      ? { label: "Failed", cls: "text-red-600" }
      : lastRunStatus === "running" || lastRunStatus === "queued"
      ? { label: "Running…", cls: "text-[hsl(248_55%_58%)]" }
      : null;

  return (
    <div className={cn("flex flex-col items-center gap-3 w-full max-w-[520px]", ab.cardHoverTilt)}>
      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          ab.cardShell,
          ab.cardShell3d,
          "w-full overflow-hidden transition-all duration-300",
          isRunActive && ab.cardRunningGlow,
        )}
      >
        {/* Header */}
        <div className={cn(ab.agentCardHeader, "px-5 pt-5 pb-4 relative overflow-hidden")}>
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full bg-white/8" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate leading-tight">
                  {agentName || I420.newWorkflowLabel}
                </h2>
                {agentDescription && (
                  <p className="text-[11px] text-white/75 mt-0.5 line-clamp-1">{agentDescription}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping absolute" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white relative" />
                  Running…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {allNodes.length > 0 ? (
            <FlowPreviewSceneLayer
              flowJson={flowJson}
              variant="agent"
              isRunActive={isRunActive}
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No nodes yet — describe your agent in the chat</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
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
                <span>
                  Last run: {formatDistanceToNow(new Date(lastRunTime), { addSuffix: true })}
                </span>
              </>
            )}
            {runStatusBadge && (
              <>
                <span className="text-slate-200">·</span>
                <span className={runStatusBadge.cls}>{runStatusBadge.label}</span>
              </>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-[hsl(250_18%_92%)] flex items-center justify-between bg-[hsl(250_25%_98%)]">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 border-[hsl(250_18%_88%)] hover:border-[hsl(248_35%_75%)] hover:text-[hsl(248_45%_42%)]"
            onClick={onEditToggle}
          >
            <Pencil className="w-3 h-3" />
            {isEditOpen ? "Close Edit" : "Edit"}
          </Button>

          {isRunActive ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-4 text-xs gap-1.5"
              onClick={onStop}
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className={cn("h-8 px-4 text-xs gap-1.5", ab.accentBtn)}
              onClick={onRun}
              disabled={isTriggering || allNodes.length === 0}
            >
              {isTriggering ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
