import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function slackApiPost(token: string, method: string, body: Record<string, string>) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  return response.json() as Promise<Record<string, unknown>>;
}

async function resolveChannelId(token: string, channel: string): Promise<string> {
  const trimmed = channel.trim();
  if (!trimmed) throw new Error("channel is required");
  if (/^[CGD][A-Z0-9]+$/i.test(trimmed)) return trimmed;

  const name = trimmed.replace(/^#/, "").toLowerCase();
  let cursor = "";

  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      types: "public_channel,private_channel",
      limit: "200",
      exclude_archived: "true",
    };
    if (cursor) params.cursor = cursor;

    const data = await slackApiPost(token, "conversations.list", params);
    if (!data.ok) {
      throw new Error(String(data.error ?? "conversations.list failed"));
    }

    const channels = (data.channels ?? []) as Array<{ id?: string; name?: string }>;
    const match = channels.find((c) => (c.name ?? "").toLowerCase() === name);
    if (match?.id) return match.id;

    cursor = String(data.response_metadata && typeof data.response_metadata === "object"
      ? (data.response_metadata as { next_cursor?: string }).next_cursor ?? ""
      : "");
    if (!cursor) break;
  }

  throw new Error(`Channel not found: ${channel}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "fetch_history";

    const { data: row } = await supabase
      .from("organization_integrations")
      .select("config, is_active")
      .eq("integration_type", "slack")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const config = (row?.config ?? {}) as Record<string, string>;
    const botToken = (config.bot_token ?? "").trim();
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "Slack is not connected. Connect via Integrations Hub first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "fetch_history") {
      const channelInput = String(body.channel ?? "#general");
      const limit = Math.min(Math.max(Number(body.limit ?? 25) || 25, 1), 100);
      const channelId = await resolveChannelId(botToken, channelInput);

      const history = await slackApiPost(botToken, "conversations.history", {
        channel: channelId,
        limit: String(limit),
      });

      if (!history.ok) {
        return new Response(
          JSON.stringify({ error: history.error ?? "conversations.history failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const rawMessages = (history.messages ?? []) as Array<Record<string, unknown>>;
      const messages = rawMessages.map((m) => ({
        ts: m.ts ?? "",
        user: m.user ?? m.bot_id ?? "",
        text: m.text ?? "",
        channel: channelId,
        type: m.type ?? "message",
      }));

      return new Response(
        JSON.stringify({
          messages,
          count: messages.length,
          channel: channelId,
          channel_input: channelInput,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
