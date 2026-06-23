import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function getSlackCredentials(): { clientId: string; clientSecret: string } {
  const credentialsJson = Deno.env.get("SLACK_OAUTH_CREDENTIALS");
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson);
    const clientId = credentials.client_id ?? credentials.clientId;
    const clientSecret = credentials.client_secret ?? credentials.clientSecret;
    if (clientId && clientSecret) return { clientId, clientSecret };
  }

  const clientId = Deno.env.get("SLACK_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("SLACK_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Slack OAuth credentials not configured (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET)");
  }
  return { clientId, clientSecret };
}

const SLACK_BOT_SCOPES = ["chat:write", "chat:write.public"].join(",");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = getSlackCredentials();
    const { redirectUri } = await req.json().catch(() => ({}));

    if (!redirectUri || typeof redirectUri !== "string") {
      throw new Error("redirectUri is required");
    }

    const state = crypto.randomUUID();
    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", SLACK_BOT_SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString(), state }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
