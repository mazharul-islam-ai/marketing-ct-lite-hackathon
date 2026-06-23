import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function runAuthTest(botToken: string) {
  const testResponse = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return testResponse.json() as Promise<{
    ok: boolean;
    error?: string;
    team?: string;
    team_id?: string;
    user?: string;
    url?: string;
  }>;
}

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

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "test";

    const { data: row } = await supabase
      .from("organization_integrations")
      .select("config, is_active")
      .eq("integration_type", "slack")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const config = (row?.config ?? {}) as Record<string, string>;
    const storedToken = (config.bot_token ?? "").trim();
    const inlineToken = typeof body.bot_token === "string" ? body.bot_token.trim() : "";
    const botToken = inlineToken || storedToken;
    const configured = !!storedToken;

    if (action === "status") {
      return new Response(
        JSON.stringify({
          configured,
          connected: configured,
          enabled: configured && row?.is_active === true,
          lastCheckedAt: new Date().toISOString(),
          config: configured
            ? { team_id: config.team_id, team_name: config.team_name, scope: config.scope }
            : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!botToken) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Slack is not connected. Connect via Integrations Hub → Add to Slack.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const testData = await runAuthTest(botToken);
    if (!testData.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: testData.error ?? "Slack auth.test failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const listResponse = await fetch("https://slack.com/api/conversations.list", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ types: "public_channel", limit: "1", exclude_archived: "true" }),
    });
    const listData = await listResponse.json() as { ok: boolean; error?: string };

    const readScopesOk = listData.ok;
    const scopeWarning = !readScopesOk && listData.error === "missing_scope"
      ? "Read scopes missing — reinstall the Slack app after adding channels:read and channels:history."
      : undefined;

    return new Response(
      JSON.stringify({
        ok: true,
        team: testData.team,
        team_id: testData.team_id,
        user: testData.user,
        url: testData.url,
        read_scopes_ok: readScopesOk,
        scope_warning: scopeWarning,
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
