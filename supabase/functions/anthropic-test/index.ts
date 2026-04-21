import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, apiKey } = await req.json();
    const ANTHROPIC_API_KEY = typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : "";

    if (action === "status") {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: ANTHROPIC_API_KEY.length > 0,
          enabled: ANTHROPIC_API_KEY.length > 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Anthropic API key is missing. Add it in Configure dialog.",
          configured: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "test") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 20,
          messages: [{ role: "user", content: "Reply with: Anthropic integration test successful!" }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to connect to Anthropic API";
        if (response.status === 401) errorMessage = "Invalid Anthropic API key";
        if (response.status === 429) errorMessage = "Anthropic API rate limit exceeded";
        return new Response(
          JSON.stringify({
            ok: false,
            error: errorMessage,
            configured: true,
            status_code: response.status,
            details: errorText,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          response: data?.content?.[0]?.text ?? "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action", configured: true }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
        configured: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
