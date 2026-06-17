import { schedules, logger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { executeAgentRun, type AgentRunPayload } from "./execute-agent-run";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const QUEUE_NAME = "agent_runs";
const VISIBILITY_TIMEOUT_SECONDS = 30;
const MAX_MESSAGES_PER_POLL = 10;

// ── Poll pgmq every 10 seconds and fire execute-agent-run per message ────────
export const pollAgentRunQueue = schedules.task({
  id: "poll-agent-run-queue",
  cron: "*/1 * * * *", // every minute (Trigger.dev scheduled tasks min is 1 min)
  maxDuration: 55,
  run: async () => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    logger.info("Polling pgmq agent_runs queue");

    // Read up to 10 messages with 30s visibility timeout
    const { data: messages, error } = await supabase.rpc("pgmq_read", {
      queue_name: QUEUE_NAME,
      vt: VISIBILITY_TIMEOUT_SECONDS,
      qty: MAX_MESSAGES_PER_POLL,
    });

    if (error) {
      logger.error("Failed to read pgmq queue", { error: error.message });
      return { polled: 0, triggered: 0 };
    }

    if (!messages || messages.length === 0) {
      logger.info("No messages in queue");
      return { polled: 0, triggered: 0 };
    }

    logger.info(`Found ${messages.length} messages in queue`);

    let triggered = 0;
    const errors: string[] = [];

    for (const msg of messages) {
      const payload = msg.message as AgentRunPayload;

      try {
        // Verify run still exists and is in queued state
        const { data: run } = await supabase
          .from("agent_runs")
          .select("id, status")
          .eq("id", payload.run_id)
          .single();

        if (!run) {
          logger.warn("Run not found, deleting message", { run_id: payload.run_id });
          await deleteMessage(supabase, msg.msg_id);
          continue;
        }

        if (run.status !== "queued") {
          logger.info("Run already processed, deleting stale message", {
            run_id: payload.run_id,
            status: run.status,
          });
          await deleteMessage(supabase, msg.msg_id);
          continue;
        }

        // Trigger the execution task
        await executeAgentRun.trigger(payload, {
          tags: [`agent_${payload.agent_id}`, `run_${payload.run_id}`],
        });

        // Delete message from queue after successful trigger
        await deleteMessage(supabase, msg.msg_id);
        triggered++;

        logger.info("Triggered execute-agent-run", { run_id: payload.run_id });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error("Failed to trigger run", { run_id: payload.run_id, error: errMsg });
        errors.push(errMsg);

        // Check read_ct — if exceeded 3 retries, move to dead letter
        if (msg.read_ct >= 3) {
          logger.error("Message exceeded retry limit, marking run as failed", {
            run_id: payload.run_id,
            read_ct: msg.read_ct,
          });

          await supabase
            .from("agent_runs")
            .update({
              status: "failed",
              error_message: `Queue processing failed after ${msg.read_ct} attempts: ${errMsg}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", payload.run_id);

          await deleteMessage(supabase, msg.msg_id);
        }
      }
    }

    return {
      polled: messages.length,
      triggered,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

async function deleteMessage(
  supabase: ReturnType<typeof createClient>,
  msgId: number,
) {
  await supabase.rpc("pgmq_delete", {
    queue_name: QUEUE_NAME,
    msg_id: msgId,
  });
}
