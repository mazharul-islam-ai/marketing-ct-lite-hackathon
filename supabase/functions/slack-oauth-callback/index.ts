import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveSlackOAuthCredentials } from "../_shared/slack-credentials.ts";

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
    if (!redirectUri) throw new Error("redirectUri is required");

    const { clientId, clientSecret } = await resolveSlackOAuthCredentials(supabase);

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.ok) {
      throw new Error(tokenData.error ?? "Slack token exchange failed");
    }

    const botToken = tokenData.access_token as string;
    if (!botToken) throw new Error("No bot access token returned from Slack");

    const { data: existing } = await supabase
      .from("organization_integrations")
      .select("id, config")
      .eq("integration_type", "slack")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;
    const config = {
      ...existingConfig,
      bot_token: botToken,
      team_id: tokenData.team?.id ?? "",
      team_name: tokenData.team?.name ?? "",
      bot_user_id: tokenData.bot_user_id ?? "",
      app_id: tokenData.app_id ?? "",
      scope: tokenData.scope ?? "",
      connected_by: user.id,
      connected_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("organization_integrations")
        .update({ config, is_active: true })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("organization_integrations")
        .insert({ integration_type: "slack", config, is_active: true });
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        team: { id: config.team_id, name: config.team_name },
        scope: config.scope,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
