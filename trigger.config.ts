import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_mqhzfjulsoqmhdykfkdm",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    extensions: [
      syncEnvVars(async () => {
        const vars: { name: string; value: string }[] = [];
        if (process.env.ENCRYPTION_KEY) {
          vars.push({ name: "ENCRYPTION_KEY", value: process.env.ENCRYPTION_KEY });
        }
        return vars;
      }),
    ],
  },
});
