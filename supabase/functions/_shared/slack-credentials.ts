import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function fromEnv(): { clientId: string; clientSecret: string } | null {
  const credentialsJson = Deno.env.get("SLACK_OAUTH_CREDENTIALS");
  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson);
      const clientId = credentials.client_id ?? credentials.clientId ?? "";
      const clientSecret = credentials.client_secret ?? credentials.clientSecret ?? "";
      if (clientId && clientSecret) return { clientId, clientSecret };
    } catch {
      // ignore malformed JSON
    }
  }

  const clientId = Deno.env.get("SLACK_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET") ?? "";
  if (clientId && clientSecret) return { clientId, clientSecret };

  return null;
}

export async function resolveSlackOAuthCredentials(
  supabase: SupabaseClient,
): Promise<{ clientId: string; clientSecret: string }> {
  const { data: row } = await supabase
    .from("organization_integrations")
    .select("config")
    .eq("integration_type", "slack")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const config = (row?.config ?? {}) as Record<string, string>;
  const dbClientId = (config.client_id ?? config.clientId ?? "").trim();
  const dbClientSecret = (config.client_secret ?? config.clientSecret ?? "").trim();

  if (dbClientId && dbClientSecret) {
    return { clientId: dbClientId, clientSecret: dbClientSecret };
  }

  const envCreds = fromEnv();
  if (envCreds) return envCreds;

  throw new Error(
    "Configure Client ID and Client Secret in Integrations Hub (Admin → Integrations → Slack).",
  );
}
