import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ab } from "../agentBuilderTheme";
import type { FlowJSON } from "../types";
import { formatDistanceToNow } from "date-fns";
import { computeNextRunAt, extractCronFromFlow } from "@/lib/automationSchedule";

const TRIGGER_LABELS: Record<string, string> = {
  manual_trigger: "Manual agent",
  webhook_trigger: "Webhook trigger",
  cron_trigger: "Scheduled",
  db_trigger: "Database trigger",
  crm_event_trigger: "CRM event trigger",
};

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
  if (min === "*/5") return "Every 5 minutes";
  if (min === "*/15") return "Every 15 minutes";
  if (min === "*/30") return "Every 30 minutes";
  return cron;
}

interface CardMetaStripProps {
  variant: "agent" | "automation";
  flowJson: FlowJSON | null;
}

export function CardMetaStrip({ variant, flowJson }: CardMetaStripProps) {
  if (variant === "agent") {
    const triggerType = flowJson?.trigger?.type;
    const label = triggerType ? (TRIGGER_LABELS[triggerType] ?? triggerType) : "—";
    return (
      <div className={cn(ab.cardMetaStrip, ab.textMuted)}>
        <span className="truncate" title={label}>
          {label}
        </span>
      </div>
    );
  }

  const cronExpression = extractCronFromFlow(flowJson);
  const cronHuman = cronExpression ? cronToHuman(cronExpression) : null;
  const nextRun = cronExpression ? computeNextRunAt(cronExpression) : null;
  const nextRunLabel = nextRun ? `Next: in ${formatDistanceToNow(nextRun)}` : null;

  if (!cronExpression) {
    return (
      <div className={cn(ab.cardMetaStrip, ab.textMuted)}>
        <span className="truncate">—</span>
      </div>
    );
  }

  const title = `${cronExpression}${cronHuman ? ` (${cronHuman})` : ""}${nextRunLabel ? ` · ${nextRunLabel}` : ""}`;

  return (
    <div className={cn(ab.cardMetaStrip, "gap-2 text-slate-500")} title={title}>
      <Clock className="w-3 h-3 text-emerald-500 shrink-0" />
      <span className="font-mono text-[10px] text-slate-600 truncate shrink min-w-0">{cronExpression}</span>
      {cronHuman && (
        <span className="text-slate-400 truncate hidden sm:inline min-w-0">({cronHuman})</span>
      )}
      {nextRunLabel && (
        <span className="ml-auto text-[10px] font-medium text-emerald-600 truncate shrink-0">
          {nextRunLabel}
        </span>
      )}
    </div>
  );
}
