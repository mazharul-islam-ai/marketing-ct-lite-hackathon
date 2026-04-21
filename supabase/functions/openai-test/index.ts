import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, apiKey } = await req.json();
    const OPENAI_API_KEY = typeof apiKey === 'string' && apiKey.trim().length > 0
      ? apiKey.trim()
      : '';

    if (!OPENAI_API_KEY) {
      console.error('No OpenAI key provided in request payload');
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'OpenAI API key is missing. Add it in Configure dialog.',
          configured: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log('OpenAI test action:', action);

      // Test the OpenAI API with a simple request
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      console.log("OpenAI API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenAI API error:", errorData);

        let errorMessage = "Failed to connect to OpenAI API";
        if (response.status === 401) {
          errorMessage = "Invalid OpenAI API key";
        } else if (response.status === 429) {
          errorMessage = "OpenAI API rate limit exceeded";
        } else if (response.status >= 500) {
          errorMessage = "OpenAI service temporarily unavailable";
        }

        return new Response(
          JSON.stringify({
            ok: false,
            error: errorMessage,
            configured: true,
            status_code: response.status,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const data = await response.json();
      console.log("OpenAI models retrieved:", data.data?.length || 0);

      // Check if we have access to common models
      const availableModels = data.data?.map((model: any) => model.id) || [];
      const hasGPTModels = availableModels.some(
        (id: string) => id.includes("gpt-4") || id.includes("gpt-3.5") || id.includes("gpt-5"),
      );

      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          models_available: availableModels.length,
          has_gpt_models: hasGPTModels,
          sample_models: availableModels.slice(0, 5),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "status") {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: OPENAI_API_KEY.length > 0,
          enabled: OPENAI_API_KEY.length > 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate a simple test completion to verify full functionality
    if (action === "generate_test") {
      console.log("Testing OpenAI text generation...");

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: 'You are a test assistant. Respond with exactly: "OpenAI integration test successful!"',
            },
            {
              role: "user",
              content: "Test the connection",
            },
          ],
          max_tokens: 20,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenAI generation test failed:", errorData);
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Failed to generate test response",
            configured: true,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "";

      console.log("Generated test response:", generatedText);

      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          generation_test: true,
          test_response: generatedText,
          model_used: "gpt-4o-mini",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unknown action",
        configured: true,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("OpenAI test function error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
        configured: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
