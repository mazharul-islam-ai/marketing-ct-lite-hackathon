import { Play, Pencil, Loader2, Clock, Square, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import { I420 } from "../i420Brand";
import type { FlowJSON, AgentRun } from "../types";
import { formatDistanceToNow } from "date-fns";
import { computeNextRunAt, extractCronFromFlow } from "@/lib/automationSchedule";

interface AutomationCardProps {
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
}

const STATUS_COLORS = {
  published: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
  draft:     "bg-amber-100/80 text-amber-700 border-amber-200",
  archived:  "bg-slate-100/80 text-slate-500 border-slate-200",
};

/** Parse a 5-part cron string to a human-readable description (best-effort) */
function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, , dow] = parts;

  const hourNum = parseInt(hour, 10);
  const minNum = parseInt(min, 10);
  const timeStr =
    !isNaN(hourNum) && !isNaN(minNum)
      ? `${String(hourNum).padStart(2, "0")}:${String(minNum).padStart(2, "0")}`
      : null;

  if (dom === "*" && dow === "*" && timeStr) return `Every day at ${timeStr}`;
  if (dom === "*" && dow !== "*" && timeStr) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNames = dow
      .split(",")
      .map((d) => days[parseInt(d, 10)] ?? d)
      .join(", ");
    return `Every ${dayNames} at ${timeStr}`;
  }
  if (min === "*" && hour === "*") return "Every minute";
  if (min === "*/5") return "Every 5 minutes";
  if (min === "*/15") return "Every 15 minutes";
  if (min === "*/30") return "Every 30 minutes";
  if (hour === "*/1" || hour === "*") return "Every hour";
  return cron;
}

export function AutomationCard({
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
}: AutomationCardProps) {

  const cronExpression = extractCronFromFlow(flowJson);
  const cronHuman = cronExpression ? cronToHuman(cronExpression) : null;
  const nextRun = cronExpression ? computeNextRunAt(cronExpression) : null;
  const nextRunLabel = nextRun
    ? `in ${formatDistanceToNow(nextRun)}`
    : null;

  const allNodes = flowJson
    ? [...(flowJson.trigger ? [flowJson.trigger] : []), ...flowJson.steps]
    : [];
  const nodeCount = allNodes.length;

  const lastRunTime = currentRun?.completed_at ?? currentRun?.started_at;
  const lastRunStatus = currentRun?.status;

  const runStatusLabel =
    lastRunStatus === "completed" ? "✓ Success"
    : lastRunStatus === "failed"  ? "✗ Failed"
    : lastRunStatus === "running" || lastRunStatus === "queued" ? "Running…"
    : null;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[520px] transition-shadow duration-200">
      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          ab.cardShell,
          "w-full overflow-hidden transition-all duration-300",
          isRunActive && "border-l-2 border-[hsl(160_55%_42%)]",
        )}
      >
        {/* Header — teal/emerald gradient */}
        <div className={cn(ab.automationCardHeader, "px-5 pt-5 pb-4 relative")}>
          {/* decorative circles removed */}

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white truncate leading-tight">
                  {agentName || I420.newWorkflowLabel}
                </h2>
                {agentDescription ? (
                  <p className="text-[11px] text-white/75 mt-0.5 line-clamp-1">{agentDescription}</p>
                ) : cronHuman ? (
                  <p className="text-[11px] text-white/75 mt-0.5">{cronHuman}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-col items-end">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-white">
                <Settings2 className="w-2.5 h-2.5" />
                Automation
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                  STATUS_COLORS[agentStatus],
                )}
              >
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
          {/* Schedule info */}
          {(cronExpression || nextRunLabel) && (
            <div className="flex items-start justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                {cronExpression && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-600 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                      {cronExpression}
                    </span>
                    {cronHuman && <span className="text-slate-400">({cronHuman})</span>}
                  </div>
                )}
              </div>
              {nextRunLabel && (
                <div className="text-[11px] text-right shrink-0">
                  <p className="text-slate-400">Next run</p>
                  <p className="font-semibold text-emerald-600">{nextRunLabel}</p>
                </div>
              )}
            </div>
          )}

          {/* Last run */}
          {lastRunTime && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Last:</span>
              {runStatusLabel && (
                <span
                  className={cn(
                    "font-medium",
                    lastRunStatus === "completed" && "text-emerald-600",
                    lastRunStatus === "failed" && "text-red-500",
                    (lastRunStatus === "running" || lastRunStatus === "queued") && "text-blue-500",
                  )}
                >
                  {runStatusLabel}
                </span>
              )}
              <span>{formatDistanceToNow(new Date(lastRunTime), { addSuffix: true })}</span>
            </div>
          )}

          {allNodes.length === 0 && (
            <p className="text-xs text-slate-400 italic">No nodes yet</p>
          )}

          {/* Stats */}
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
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[hsl(250_18%_92%)] flex items-center justify-between bg-[hsl(160_20%_98%)]">
          <Button
            variant={isEditOpen ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 px-3 text-xs gap-1.5",
              isEditOpen
                ? "bg-[hsl(248_50%_62%)] hover:bg-[hsl(248_50%_58%)] text-white border-0"
                : "border-[hsl(160_18%_85%)] hover:border-[hsl(160_35%_65%)] hover:text-[hsl(160_45%_38%)]",
            )}
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
              className="h-8 px-4 text-xs gap-1.5 bg-[hsl(160_55%_42%)] hover:bg-[hsl(160_55%_38%)] text-white border-0"
              onClick={onRun}
              disabled={isTriggering || allNodes.length === 0 || !canRun}
            >
              {isTriggering ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
