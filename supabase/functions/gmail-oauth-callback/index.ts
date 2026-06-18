import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, redirectUri } = await req.json();
    if (!code) throw new Error("Authorization code is required");

    const credentialsJson = Deno.env.get("GOOGLE_DRIVE_OAUTH_CREDENTIALS") ?? Deno.env.get("GMAIL_OAUTH_CREDENTIALS");
    if (!credentialsJson) throw new Error("Google OAuth credentials not configured");

    const credentials = JSON.parse(credentialsJson);
    const clientId = credentials.web?.client_id || credentials.client_id;
    const clientSecret = credentials.web?.client_secret || credentials.client_secret;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    const config = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      client_id: clientId,
      client_secret: clientSecret,
      connected_by: user.id,
      connected_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("organization_integrations")
      .select("id")
      .eq("integration_type", "gmail")
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("organization_integrations")
        .update({ config, is_active: true })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("organization_integrations")
        .insert({ integration_type: "gmail", config, is_active: true });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
