interface LlmUsage {
  promptTokens: number
  completionTokens: number
}

export async function callLlmJson<T>(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ result: T; usage: LlmUsage }> {
  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini error: ${await response.text()}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");
    return {
      result: JSON.parse(text) as T,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  if (provider === "claude") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt + "\nRespond with ONLY valid JSON.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
    const data = await response.json();
    const text = (data.content?.[0]?.text ?? "").replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return {
      result: JSON.parse(text) as T,
      usage: { promptTokens: data.usage?.input_tokens ?? 0, completionTokens: data.usage?.output_tokens ?? 0 },
    };
  }

  const endpoint = provider === "perplexity"
    ? "https://api.perplexity.ai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`LLM error: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  const cleaned = content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return {
    result: JSON.parse(cleaned) as T,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function resolveCompilerApiKey(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
): Promise<{ provider: string; model: string; apiKey: string }> {
  const providers = [
    { name: "openai", type: "openai", env: "OPENAI_KEY", model: "gpt-4o-mini" },
    { name: "gemini", type: "google_gemini", env: "GEMINI_API_KEY", model: "gemini-1.5-flash" },
    { name: "claude", type: "anthropic", env: "ANTHROPIC_API_KEY", model: "claude-3-5-haiku-20241022" },
  ];

  for (const p of providers) {
    const { data } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("integration_type", p.type)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const cfg = data?.config as Record<string, string> | null;
    const key = (cfg?.api_key ?? cfg?.apiKey ?? process.env[p.env] ?? "").trim();
    if (key) return { provider: p.name, model: p.model, apiKey: key };
  }
  throw new Error("No AI provider configured for compiler");
}
