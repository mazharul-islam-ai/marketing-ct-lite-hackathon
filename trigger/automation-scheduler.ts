import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TRIGGER_SECRET_KEY = process.env.TRIGGER_SECRET_KEY ?? process.env.TRIGGER_API_KEY ?? "";
const TRIGGER_API_URL = "https://api.trigger.dev/api/v3/tasks/execute-agent-run/trigger";

function computeNextRunAt(cronExpression: string, from = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(from.getTime() + 60 * 60 * 1000);
  const [minuteStr, hourStr] = parts;
  const next = new Date(from);
  next.setUTCSeconds(0, 0);
  if (hourStr !== "*") next.setUTCHours(parseInt(hourStr, 10));
  if (minuteStr !== "*") next.setUTCMinutes(parseInt(minuteStr, 10));
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export const automationScheduler = schedules.task({
  id: "automation-scheduler",
  cron: "* * * * *",
  maxDuration: 55,
  run: async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    const { data: dueAutomations, error } = await supabase
      .from("automations")
      .select("id, agent_id, cron_expression")
      .eq("is_active", true)
      .eq("trigger_type", "cron")
      .lte("next_run_at", now);

    if (error) {
      logger.error("Failed to query automations", { error: error.message });
      return { triggered: 0 };
    }

    if (!dueAutomations?.length) return { triggered: 0 };

    let triggered = 0;

    for (const automation of dueAutomations) {
      try {
        const { data: agent } = await supabase
          .from("agents")
          .select("id, status, current_version_id")
          .eq("id", automation.agent_id)
          .single();

        if (!agent?.current_version_id || agent.status !== "published") {
          await supabase.from("automations").update({ is_active: false }).eq("id", automation.id);
          continue;
        }

        const { data: versionData } = await supabase
          .from("agent_versions")
          .select("id, version, flow_json")
          .eq("id", agent.current_version_id)
          .single();

        if (!versionData) continue;

        const { data: run, error: runError } = await supabase
          .from("agent_runs")
          .insert({
            agent_id: automation.agent_id,
            version_id: agent.current_version_id,
            status: "queued",
            trigger_type: "cron",
            input_data: { automation_id: automation.id },
            budget_limit: 5.0,
            step_count: 0,
            total_cost: 0,
            tokens_used: 0,
          })
          .select("id")
          .single();

        if (runError || !run) throw runError ?? new Error("Failed to create run");

        const taskPayload = {
          run_id: run.id,
          agent_id: automation.agent_id,
          version_id: agent.current_version_id,
          flow_json: versionData.flow_json,
          input_context: { automation_id: automation.id },
          budget_limit: 5.0,
          triggered_by: null,
          trigger_type: "cron",
        };

        let triggerDevRunId: string | null = null;
        if (TRIGGER_SECRET_KEY) {
          const tdRes = await fetch(TRIGGER_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TRIGGER_SECRET_KEY}`,
            },
            body: JSON.stringify({ payload: taskPayload }),
          });
          if (tdRes.ok) {
            const tdData = await tdRes.json();
            triggerDevRunId = tdData?.id ?? null;
            if (triggerDevRunId) {
              await supabase
                .from("agent_runs")
                .update({ trigger_dev_run_id: triggerDevRunId })
                .eq("id", run.id);
            }
          }
        }

        if (!triggerDevRunId) {
          await supabase.rpc("pgmq_send", {
            queue_name: "agent_runs",
            msg: { ...taskPayload, enqueued_at: new Date().toISOString() },
          });
        }

        const nextRun = computeNextRunAt(automation.cron_expression ?? "0 8 * * *");
        await supabase
          .from("automations")
          .update({ last_run_at: now, next_run_at: nextRun.toISOString() })
          .eq("id", automation.id);

        triggered++;
      } catch (err) {
        logger.error("Automation trigger failed", {
          automation_id: automation.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { triggered, total: dueAutomations.length };
  },
});
