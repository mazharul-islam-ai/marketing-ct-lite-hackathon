import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveSlackOAuthCredentials } from "../_shared/slack-credentials.ts";

const SLACK_BOT_SCOPES = [
  "chat:write",
  "chat:write.public",
  "channels:read",
  "channels:history",
  "groups:history",
  "im:history",
].join(",");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { clientId } = await resolveSlackOAuthCredentials(supabase);
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
