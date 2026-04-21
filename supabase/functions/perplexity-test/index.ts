import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token || '');

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Perplexity API key is missing. Add it in Configure dialog.",
          configured: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { action, apiKey, prompt, model, temperature, max_tokens, topic, leader_id, url, save_to_trends, save_to_uploads } = await req.json();
    const PERPLEXITY_API_KEY = typeof apiKey === 'string' && apiKey.trim().length > 0
      ? apiKey.trim()
      : '';

    if (action === 'status') {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: PERPLEXITY_API_KEY.length > 0,
          enabled: PERPLEXITY_API_KEY.length > 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Perplexity API key is missing. Add it in Configure dialog.',
          configured: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Perplexity action:', action, 'user:', user.email);

    // ============= RESEARCH ACTION =============
    // Research a topic using Perplexity and optionally save to weekly_trends
    if (action === "research") {
      const startTime = Date.now();
      const researchTopic = topic || prompt;

      if (!researchTopic) {
        return new Response(JSON.stringify({ ok: false, error: "Topic or prompt is required for research" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Researching topic:", researchTopic);

      const systemPrompt = `You are a content strategist specializing in technology and business topics. 
Your task is to research and provide actionable content insights.

Return your response in this exact JSON format:
{
  "topic_summary": "A 2-3 sentence overview of the topic",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "content_angles": [
    {"angle": "angle title", "description": "brief description of this content angle"},
    {"angle": "angle title", "description": "brief description of this content angle"},
    {"angle": "angle title", "description": "brief description of this content angle"}
  ],
  "trending_aspects": ["what's hot right now about this topic"],
  "target_audience_insights": "Who would be most interested in this content",
  "suggested_headline": "A compelling headline for a LinkedIn post about this topic"
}`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "sonar-pro",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Research this topic for LinkedIn content creation: ${researchTopic}. Focus on recent developments, trending aspects, and actionable insights. Return valid JSON only.`,
            },
          ],
          temperature: temperature ?? 0.3,
          max_tokens: max_tokens || 2000,
          search_recency_filter: "week",
        }),
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Perplexity research error:", errorData);

        await supabase.from("integration_logs").insert({
          integration_type: "perplexity",
          action: "research",
          request_payload: { topic: researchTopic, model: model || "sonar-pro" },
          response_data: { error: errorData },
          status: "error",
          execution_time_ms: executionTime,
          error_message: "Research API call failed",
          performed_by: user.id,
        });

        return new Response(JSON.stringify({ ok: false, error: "Research failed", details: errorData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || "";
      const citations = data.citations || [];

      console.log("Research completed, parsing response");

      // Try to parse the JSON response
      let parsedResearch;
      try {
        // Extract JSON from potential markdown code blocks
        const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/) ||
          responseContent.match(/```\s*([\s\S]*?)\s*```/) || [null, responseContent];
        parsedResearch = JSON.parse(jsonMatch[1] || responseContent);
      } catch (parseError) {
        console.error("Failed to parse research JSON:", parseError);
        parsedResearch = {
          topic_summary: responseContent,
          key_points: [],
          content_angles: [],
          trending_aspects: [],
          target_audience_insights: "",
          suggested_headline: researchTopic,
        };
      }

      // Log success
      await supabase.from("integration_logs").insert({
        integration_type: "perplexity",
        action: "research",
        request_payload: { topic: researchTopic, model: model || "sonar-pro" },
        response_data: { parsed: parsedResearch, citations },
        status: "success",
        execution_time_ms: executionTime,
        performed_by: user.id,
      });

      // Optionally save to weekly_trends
      let savedTrend = null;
      if (save_to_trends && leader_id) {
        const currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        const weekStartStr = currentWeekStart.toISOString().split("T")[0];

        const { data: trendData, error: trendError } = await supabase
          .from("weekly_trends")
          .insert({
            leader_id,
            week_start: weekStartStr,
            topic_title: parsedResearch.suggested_headline || researchTopic,
            topic_summary: parsedResearch.topic_summary || responseContent.substring(0, 500),
            relevance_score: 80,
            status: "draft",
            source_url: citations[0] || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (trendError) {
          console.error("Failed to save trend:", trendError);
        } else {
          savedTrend = trendData;
          console.log("Saved research to weekly_trends:", trendData.id);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          research: parsedResearch,
          citations,
          execution_time_ms: executionTime,
          saved_trend: savedTrend,
          usage: data.usage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============= SCRAPE ACTION =============
    // Scrape and summarize a URL for knowledge base
    if (action === "scrape") {
      const startTime = Date.now();

      if (!url) {
        return new Response(JSON.stringify({ ok: false, error: "URL is required for scraping" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Scraping URL:", url);

      const systemPrompt = `You are a content analyst. Analyze the provided URL and extract key information for a knowledge base.

Return your response in this exact JSON format:
{
  "title": "The main title or topic of the content",
  "summary": "A comprehensive 3-4 sentence summary of the content",
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "quotes": ["Notable quote 1", "Notable quote 2"],
  "content_type": "article|tutorial|case_study|news|documentation|other",
  "relevance_tags": ["tag1", "tag2", "tag3"],
  "content_date": "YYYY-MM-DD if available, or null"
}`;

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "sonar",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyze and summarize the content from this URL for our knowledge base: ${url}. Return valid JSON only.`,
            },
          ],
          temperature: 0.2,
          max_tokens: max_tokens || 1500,
        }),
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Perplexity scrape error:", errorData);

        await supabase.from("integration_logs").insert({
          integration_type: "perplexity",
          action: "scrape",
          request_payload: { url },
          response_data: { error: errorData },
          status: "error",
          execution_time_ms: executionTime,
          error_message: "Scrape API call failed",
          performed_by: user.id,
        });

        return new Response(JSON.stringify({ ok: false, error: "Scrape failed", details: errorData }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || "";

      console.log("Scrape completed, parsing response");

      // Try to parse the JSON response
      let parsedScrape;
      try {
        const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/) ||
          responseContent.match(/```\s*([\s\S]*?)\s*```/) || [null, responseContent];
        parsedScrape = JSON.parse(jsonMatch[1] || responseContent);
      } catch (parseError) {
        console.error("Failed to parse scrape JSON:", parseError);
        parsedScrape = {
          title: "Scraped Content",
          summary: responseContent,
          key_takeaways: [],
          quotes: [],
          content_type: "other",
          relevance_tags: [],
          content_date: null,
        };
      }

      // Log success
      await supabase.from("integration_logs").insert({
        integration_type: "perplexity",
        action: "scrape",
        request_payload: { url },
        response_data: { parsed: parsedScrape },
        status: "success",
        execution_time_ms: executionTime,
        performed_by: user.id,
      });

      // Optionally save to leader_uploads
      let savedUpload = null;
      if (save_to_uploads && leader_id) {
        const { data: uploadData, error: uploadError } = await supabase
          .from("leader_uploads")
          .insert({
            leader_id,
            file_name: parsedScrape.title || `Scraped: ${new URL(url).hostname}`,
            file_url: url,
            file_summary: parsedScrape.summary,
            file_type: "url",
            source_type: "url_scrape",
          })
          .select()
          .single();

        if (uploadError) {
          console.error("Failed to save upload:", uploadError);
        } else {
          savedUpload = uploadData;
          console.log("Saved scrape to leader_uploads:", uploadData.id);
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          scrape: parsedScrape,
          source_url: url,
          execution_time_ms: executionTime,
          saved_upload: savedUpload,
          usage: data.usage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============= TEST ACTION (existing) =============
    if (action === "test") {
      const startTime = Date.now();
      const testPrompt = prompt || "What are the top 5 trending topics in AI and technology this week?";
      const testModel = model || "llama-3.1-sonar-small-128k-online";
      const testTemp = temperature ?? 0.2;
      const testMaxTokens = max_tokens || 1000;

      console.log("Testing Perplexity API with model:", testModel);

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: testModel,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant that provides concise, accurate information about current trends and topics.",
            },
            {
              role: "user",
              content: testPrompt,
            },
          ],
          temperature: testTemp,
          max_tokens: testMaxTokens,
          return_images: false,
          return_related_questions: false,
        }),
      });

      const executionTime = Date.now() - startTime;
      console.log("Perplexity API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Perplexity API error:", errorData);

        let errorMessage = "Failed to connect to Perplexity API";
        if (response.status === 401) {
          errorMessage = "Invalid Perplexity API key";
        } else if (response.status === 429) {
          errorMessage = "Perplexity API rate limit exceeded";
        } else if (response.status >= 500) {
          errorMessage = "Perplexity service temporarily unavailable";
        }

        // Log error to database
        await supabase.from("integration_logs").insert({
          integration_type: "perplexity",
          action: "test",
          request_payload: { prompt: testPrompt, model: testModel, temperature: testTemp, max_tokens: testMaxTokens },
          response_data: { error: errorData },
          status: "error",
          execution_time_ms: executionTime,
          error_message: errorMessage,
          performed_by: user.id,
        });

        return new Response(
          JSON.stringify({
            ok: false,
            error: errorMessage,
            configured: true,
            status_code: response.status,
            execution_time_ms: executionTime,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || "";

      console.log("Perplexity test successful, response length:", responseContent.length);

      // Log success to database
      await supabase.from("integration_logs").insert({
        integration_type: "perplexity",
        action: "test",
        request_payload: { prompt: testPrompt, model: testModel, temperature: testTemp, max_tokens: testMaxTokens },
        response_data: { content: responseContent, usage: data.usage },
        status: "success",
        execution_time_ms: executionTime,
        performed_by: user.id,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          connected: true,
          response: responseContent,
          model_used: testModel,
          execution_time_ms: executionTime,
          usage: data.usage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unknown action. Supported actions: test, status, research, scrape",
        configured: true,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Perplexity function error:", error);
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
