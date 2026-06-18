import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsJson = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS") ?? Deno.env.get("GMAIL_OAUTH_CREDENTIALS");
    if (!credentialsJson) {
      throw new Error("Google OAuth credentials not configured (GOOGLE_DRIVE_OAUTH_CREDENTIALS)");
    }

    const credentials = JSON.parse(credentialsJson);
    const clientId = credentials.web?.client_id || credentials.client_id;
    if (!clientId) throw new Error("client_id not found in credentials");

    const { redirectUri } = await req.json().catch(() => ({}));
    const origin = new URL(req.url).origin;
    const callbackUri = redirectUri || `${origin.replace("/functions/v1/gmail-oauth-init", "")}/gmail-oauth-callback`;

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
