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
    const GEMINI_API_KEY = typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : "";

    if (action === "status") {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: GEMINI_API_KEY.length > 0,
          enabled: GEMINI_API_KEY.length > 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Gemini API key is missing. Add it in Configure dialog.",
          configured: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "list_models") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        { method: "GET", headers: { "Content-Type": "application/json" } },
      );

      if (!response.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: "Failed to fetch Gemini models", models: [] }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const data = await response.json();
      const models = ((data.models ?? []) as Array<{ name: string; supportedGenerationMethods?: string[] }>)
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .sort();

      return new Response(
        JSON.stringify({ ok: true, configured: true, models }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "test") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
          GEMINI_API_KEY,
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with: Gemini integration test successful!" }] }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to connect to Gemini API";
        if (response.status === 401 || response.status === 403) errorMessage = "Invalid Gemini API key";
        if (response.status === 429) errorMessage = "Gemini API rate limit exceeded";
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
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join(" ").trim() ?? "";

      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          response: text,
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
