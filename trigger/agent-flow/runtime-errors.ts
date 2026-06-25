/**
 * Runtime error hints for Trigger.dev flow execution (mirrors supabase/functions/_shared/runtime-errors.ts).
 */

export interface RuntimeErrorInfo {
  error_code: string;
  message: string;
  hint: string;
}

const ERROR_CATALOG: Record<string, Omit<RuntimeErrorInfo, "error_code">> = {
  not_in_channel: {
    message: "Slack bot is not a member of the target channel",
    hint: "In Slack, open the channel and run /invite @YourBotName, then re-run the flow.",
  },
  channel_not_found: {
    message: "Slack channel was not found",
    hint: "Check the channel ID or name in the slack_fetch_messages node config.",
  },
  missing_scope: {
    message: "Slack app is missing required OAuth scopes",
    hint: "Reinstall the Slack app from Integrations Hub after updating scopes.",
  },
  invalid_auth: {
    message: "Slack authentication failed",
    hint: "Reconnect Slack in Admin → Integrations Hub.",
  },
};

export function enrichRuntimeError(
  rawError: string,
  context?: { channel?: string },
): RuntimeErrorInfo {
  const lower = rawError.toLowerCase();
  let code = "unknown";

  for (const key of Object.keys(ERROR_CATALOG)) {
    if (lower.includes(key)) {
      code = key;
      break;
    }
  }

  const catalog = ERROR_CATALOG[code];
  if (catalog) {
    let hint = catalog.hint;
    if (code === "not_in_channel" && context?.channel) {
      hint = `In Slack channel ${context.channel}, run /invite @YourBotName, then re-run.`;
    }
    return { error_code: code, message: catalog.message, hint };
  }

  return {
    error_code: "unknown",
    message: rawError,
    hint: "Check the failed step config and integration settings, then re-run.",
  };
}

export function formatRuntimeErrorMessage(info: RuntimeErrorInfo): string {
  return `${info.message}. ${info.hint}`;
}
