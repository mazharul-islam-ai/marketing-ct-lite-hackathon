/** Compute next run time for simple 5-field cron (minute hour dom month dow). Times are UTC. */
export function computeNextRunAt(cronExpression: string, from = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return new Date(from.getTime() + 60 * 60 * 1000);
  }

  const [minuteStr, hourStr] = parts;
  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  if (hourStr !== "*") {
    next.setUTCHours(parseInt(hourStr, 10));
  }
  if (minuteStr !== "*") {
    next.setUTCMinutes(parseInt(minuteStr, 10));
  }

  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

export function extractCronFromFlow(flow: {
  trigger?: { type: string; config?: Record<string, unknown> } | null;
} | null): string | null {
  if (!flow?.trigger || flow.trigger.type !== "cron_trigger") return null;
  const schedule = flow.trigger.config?.schedule ?? flow.trigger.config?.cron_expression;
  return typeof schedule === "string" && schedule.trim() ? schedule.trim() : "0 8 * * *";
}

/** Read optional timezone label from cron_trigger config (for UI display). */
export function extractCronTimezoneLabel(flow: {
  trigger?: { type: string; config?: Record<string, unknown> } | null;
} | null): string | null {
  if (!flow?.trigger || flow.trigger.type !== "cron_trigger") return null;
  const label = flow.trigger.config?.timezone_label;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}
