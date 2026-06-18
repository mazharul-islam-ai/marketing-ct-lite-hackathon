import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function refreshAccessToken(config: Record<string, string>): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Gmail token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

async function getGmailAccessToken(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const { data } = await supabase
    .from("organization_integrations")
    .select("id, config")
    .eq("integration_type", "gmail")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const config = (data?.config ?? {}) as Record<string, string>;
  const refreshToken = config.refresh_token ?? config.refreshToken;
  const clientId = config.client_id ?? config.clientId;
  const clientSecret = config.client_secret ?? config.clientSecret;

  if (!refreshToken && !config.access_token) {
    throw new Error("Gmail is not configured. Connect Gmail in Admin → Integrations Hub.");
  }

  const expiresAt = config.expires_at ? new Date(config.expires_at).getTime() : 0;
  if (config.access_token && expiresAt > Date.now() + 60_000) {
    return config.access_token;
  }

  if (!refreshToken || !clientId || !clientSecret) {
    if (config.access_token) return config.access_token;
    throw new Error("Gmail OAuth tokens incomplete — reconnect Gmail.");
  }

  const accessToken = await refreshAccessToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const newConfig = {
    ...config,
    access_token: accessToken,
    expires_at: new Date(Date.now() + 3500 * 1000).toISOString(),
  };

  if (data?.id) {
    await supabase
      .from("organization_integrations")
      .update({ config: newConfig })
      .eq("id", data.id);
  }

  return accessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "fetch_unread";
    const maxResults = Number(body.max_results ?? 25);

    if (action === "status") {
      const { data } = await supabase
        .from("organization_integrations")
        .select("id, is_active")
        .eq("integration_type", "gmail")
        .eq("is_active", true)
        .maybeSingle();

      return new Response(
        JSON.stringify({ configured: !!data, ok: !!data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getGmailAccessToken(supabase);

    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", "is:unread");
    listUrl.searchParams.set("maxResults", String(Math.min(maxResults, 50)));

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      throw new Error(`Gmail API list failed: ${await listRes.text()}`);
    }

    const listData = await listRes.json();
    const messageIds: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

    const emails: Array<{
      id: string;
      subject: string;
      from: string;
      snippet: string;
      date: string;
    }> = [];

    for (const id of messageIds.slice(0, maxResults)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) continue;

      const msg = await msgRes.json();
      const headers = (msg.payload?.headers ?? []) as Array<{ name: string; value: string }>;
      const getHeader = (name: string) => headers.find((h) => h.name === name)?.value ?? "";

      emails.push({
        id,
        subject: getHeader("Subject") || "(no subject)",
        from: getHeader("From") || "unknown",
        snippet: msg.snippet ?? "",
        date: getHeader("Date") || "",
      });
    }

    return new Response(
      JSON.stringify({ emails, count: emails.length, total_unread: messageIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", emails: [], count: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
