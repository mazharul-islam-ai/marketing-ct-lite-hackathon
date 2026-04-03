/**
 * Generate SEO Blog Edge Function
 * Orchestrates blog generation with strict validation rules
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlogValidator, ValidationResult } from "../_shared/blog-validator.ts";
import { ReferenceSummarizer, getOrCreateSummary } from "../_shared/reference-summarizer.ts";
import {
  SYSTEM_PROMPT,
  REPAIR_SYSTEM_PROMPT,
  buildUserPrompt,
  buildRepairPrompt,
  parseLLMResponse,
  BlogGenerationInput,
} from "../_shared/blog-prompts.ts";
import { searchBrandEmbeddings, searchKnowledgeEmbeddings } from "../_shared/integrations/pgvector.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  primary_keyword: string;
  primary_reference: string;
  additional_notes?: string;
  brand_name: string;
  brand_id: string;
  tone?: string;
  audience?: string;
}

interface BlogOutput {
  title: string;
  paragraphs: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Starting SEO blog generation...");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Parse request
    const body: RequestBody = await req.json();

    console.log("Request from user:", user.id, "for brand:", body.brand_id);

    // Validate required fields (only primary keyword is mandatory)
    if (!body.primary_keyword || !body.brand_name || !body.brand_id) {
      throw new Error("Missing required fields: primary_keyword, brand_name, brand_id");
    }

    // Fetch agent configuration from database
    console.log("Fetching SEO Blog Generator agent configuration...");
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from("ai_agents")
      .select("system_prompt")
      .eq("slug", "seo-blog-generator")
      .single();

    if (agentError) {
      console.warn("Could not fetch agent config, using defaults:", agentError);
    }

    const systemPrompt = agentConfig?.system_prompt || SYSTEM_PROMPT;

    // Initialize Lovable API client (OpenAI-compatible gateway)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const lovableClient = {
      async chat(messages: Array<{ role: string; content: string }>) {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.3,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
          content: data.choices[0].message.content,
          usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          cost_usd: 0,
          model: "gpt-4o-mini",
        };
      },
    };

    console.log("Using Lovable AI gateway with gpt-4o-mini");

    // Initialize summarizer
    const summarizer = new ReferenceSummarizer(lovableClient as any);

    // Step 1: Create blog record
    console.log("Creating blog record...");
    const { data: blogRecord, error: insertError } = await supabaseClient
      .from("seo_blog_content")
      .insert({
        user_id: user.id,
        brand_id: body.brand_id,
        primary_keyword: body.primary_keyword,
        primary_reference: body.primary_reference,
        additional_notes: body.additional_notes,
        brand_name: body.brand_name,
        tone: body.tone || "informative",
        audience: body.audience || "general business audience",
        status: "generating",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    const blogId = blogRecord.id;
    const startTime = Date.now();

    // Step 2: Summarize references
    console.log("Summarizing references...");

    const primarySummary = await getOrCreateSummary(supabaseClient, summarizer, body.primary_reference, "primary");

    // Update summary in database
    await supabaseClient
      .from("seo_blog_content")
      .update({
        primary_reference_summary: primarySummary.summary,
      })
      .eq("id", blogId);

    // Step 2.5: Collect knowledge base context AND brand analytics/KPIs
    console.log("Collecting knowledge base context and brand data...");
    const [knowledgeContext, analyticsContext, kpisContext] = await Promise.all([
      collectKnowledgeContext(supabaseClient, body.brand_id, body.primary_keyword, body.additional_notes || ""),
      collectBrandAnalytics(supabaseClient, body.brand_id),
      collectBrandKPIs(supabaseClient, body.brand_id),
    ]);

    // Combine all brand context
    const fullBrandContext = [knowledgeContext, analyticsContext, kpisContext].filter(Boolean).join("\n\n");

    // Step 3: Generate initial blog
    console.log("Generating initial blog...");

    const generationInput: BlogGenerationInput = {
      primary_keyword: body.primary_keyword,
      primary_reference_summary: primarySummary.summary,
      secondary_keyword: body.secondary_keyword,
      third_keyword: body.third_keyword,
      additional_notes: body.additional_notes,
      brand_name: body.brand_name,
      tone: body.tone || "informative",
      audience: body.audience || "general business audience",
      knowledge_context: fullBrandContext || undefined,
    };

    let currentAttempt = 1;
    let totalTokens = primarySummary.tokens_used;
    let totalCost = 0;

    const initialResult = await generateAndValidate(
      lovableClient as any,
      generationInput,
      systemPrompt,
      buildUserPrompt(generationInput),
      blogId,
      currentAttempt,
      "initial",
      supabaseClient,
    );

    let blog = initialResult.blog;
    let validation = initialResult.validation;
    totalTokens += initialResult.tokens;
    totalCost += initialResult.cost;

    // Step 4: If validation failed, attempt repair (up to 3 attempts)
    const maxRepairAttempts = 3;
    while (!validation.valid && currentAttempt <= maxRepairAttempts) {
      console.log(`Validation failed. Attempting repair ${currentAttempt}/${maxRepairAttempts}...`);
      console.log("Errors:", validation.errors);

      // Check if word count is the primary issue
      const hasWordCountError = validation.errors.some((e) => e.includes("Word count"));
      const wordCountErrorOnly = hasWordCountError && validation.errors.length <= 2;

      if (hasWordCountError) {
        console.log("🔴 Word count issue detected - prioritizing this in repair");
      }

      currentAttempt++;

      const repairResult = await generateAndValidate(
        lovableClient as any,
        generationInput,
        REPAIR_SYSTEM_PROMPT,
        buildRepairPrompt(blog.title, blog.paragraphs, validation.errors, generationInput),
        blogId,
        currentAttempt,
        "repair",
        supabaseClient,
      );

      totalTokens += repairResult.tokens;
      totalCost += repairResult.cost;

      // Check if word count was fixed
      const previousWordCountError = validation.errors.find((e) => e.includes("Word count"));
      const currentWordCountError = repairResult.validation.errors.find((e) => e.includes("Word count"));
      const wordCountFixed = previousWordCountError && !currentWordCountError;

      if (wordCountFixed) {
        console.log("✅ Word count issue resolved!");
      }

      // Use repair result if it's valid or has fewer errors
      if (repairResult.validation.valid) {
        blog = repairResult.blog;
        validation = repairResult.validation;
        console.log("Repair successful! Blog now passes validation.");
        break;
      } else if (repairResult.validation.errors.length < validation.errors.length) {
        blog = repairResult.blog;
        validation = repairResult.validation;
        console.log(
          `Repair improved validation. Errors reduced from ${validation.errors.length} to ${repairResult.validation.errors.length}`,
        );
      } else if (wordCountFixed && repairResult.validation.errors.length === validation.errors.length) {
        // Word count was fixed even though error count stayed same (word count error replaced with different error)
        blog = repairResult.blog;
        validation = repairResult.validation;
        console.log("Word count fixed, using repair result");
      } else {
        console.log("Repair did not improve validation. Retrying if attempts remain...");
      }
    }

    if (!validation.valid) {
      console.log(
        `Final result after ${currentAttempt - 1} repair attempts: Still has ${validation.errors.length} validation errors`,
      );
      const stillHasWordCountError = validation.errors.some((e) => e.includes("Word count"));
      if (stillHasWordCountError) {
        console.log("⚠️  WARNING: Word count issue persists after all repair attempts");
      }
    }

    // Step 5: Update final blog record
    const generationTime = Date.now() - startTime;

    console.log("Updating blog record with results...");
    console.log("Valid:", validation.valid, "Errors:", validation.errors.length);

    const { error: updateError } = await supabaseClient
      .from("seo_blog_content")
      .update({
        title: blog.title,
        paragraphs: blog.paragraphs,
        validation_result: validation,
        is_valid: validation.valid,
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
        generation_attempts: currentAttempt,
        total_tokens_used: totalTokens,
        prompt_tokens: totalTokens, // Approximation
        cost_usd: totalCost,
        generation_time_ms: generationTime,
        status: validation.valid ? "validated" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", blogId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    // Step 6: Return result
    console.log("Blog generation complete!");

    return new Response(
      JSON.stringify({
        success: true,
        blog_id: blogId,
        title: blog.title,
        paragraphs: blog.paragraphs,
        validation: validation,
        meta: {
          attempts: currentAttempt,
          total_tokens: totalTokens,
          cost_usd: totalCost,
          generation_time_ms: generationTime,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error generating blog:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

// ========== Helper Functions ==========

/**
 * Collect knowledge base context for blog generation
 * Searches both brand-specific and company global knowledge
 */
async function collectKnowledgeContext(
  supabaseClient: any,
  brandId: string,
  primaryKeyword: string,
  additionalNotes: string,
): Promise<string> {
  try {
    console.log(`[Knowledge] Collecting context for brand ${brandId}...`);

    // Use primary keyword for search query
    const queryText = primaryKeyword;

    // Fetch active category IDs for company knowledge search
    const { data: categories } = await supabaseClient
      .from("company_knowledge_categories")
      .select("id")
      .eq("is_active", true);

    const categoryIds = categories?.map((c: any) => c.id) || [];
    console.log(`[Knowledge] Found ${categoryIds.length} active knowledge categories`);

    // Search both knowledge bases in parallel
    const [brandKnowledge, globalKnowledge] = await Promise.all([
      // Brand-specific knowledge
      searchBrandEmbeddings(
        supabaseClient,
        queryText,
        [brandId],
        3, // top 3 results
        0.7, // similarity threshold
      ),
      // Company global knowledge (only if categories exist)
      categoryIds.length > 0
        ? searchKnowledgeEmbeddings(
            supabaseClient,
            queryText,
            categoryIds,
            3, // top 3 results
            0.7, // similarity threshold
          )
        : Promise.resolve([]),
    ]);

    console.log(`[Knowledge] Found ${brandKnowledge.length} brand knowledge snippets`);
    console.log(`[Knowledge] Found ${globalKnowledge.length} company knowledge snippets`);

    // Format knowledge context
    const knowledgePieces: string[] = [];

    if (brandKnowledge.length > 0) {
      knowledgePieces.push("BRAND KNOWLEDGE:");
      brandKnowledge.forEach((content, i) => {
        knowledgePieces.push(`${i + 1}. ${content}`);
      });
    }

    if (globalKnowledge.length > 0) {
      if (knowledgePieces.length > 0) knowledgePieces.push(""); // blank line
      knowledgePieces.push("COMPANY KNOWLEDGE:");
      globalKnowledge.forEach((content, i) => {
        knowledgePieces.push(`${i + 1}. ${content}`);
      });
    }

    const knowledgeContext = knowledgePieces.join("\n");

    if (knowledgeContext.trim()) {
      console.log(`[Knowledge] Collected ${knowledgePieces.length} knowledge snippets`);
      return knowledgeContext;
    } else {
      console.log("[Knowledge] No relevant knowledge found");
      return "";
    }
  } catch (error) {
    console.error("[Knowledge] Error collecting knowledge context:", error);
    // Don't fail the entire generation if knowledge search fails
    return "";
  }
}

async function generateAndValidate(
  openai: any,
  input: BlogGenerationInput,
  systemPrompt: string,
  userPrompt: string,
  blogId: string,
  attemptNumber: number,
  attemptType: "initial" | "repair",
  supabase: any,
): Promise<{
  blog: BlogOutput;
  validation: ValidationResult;
  tokens: number;
  cost: number;
}> {
  console.log(`Attempt ${attemptNumber} (${attemptType}): Calling Lovable AI...`);

  // Call Lovable AI gateway
  const response = await openai.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  console.log("Lovable AI response received. Parsing...");

  // Parse response
  let blog: BlogOutput;
  try {
    blog = parseLLMResponse(response.content);
    console.log("Parsed successfully. Title:", blog.title?.substring(0, 50));
  } catch (parseError) {
    console.error("Failed to parse LLM response:", response.content);
    throw new Error(`LLM returned invalid JSON: ${parseError instanceof Error ? parseError.message : "Parse error"}`);
  }

  // Validate
  console.log("Validating blog...");
  const validator = new BlogValidator({
    primary_keyword: input.primary_keyword,
    brand_name: input.brand_name,
  });

  const validation = validator.validate(blog.title, blog.paragraphs);

  console.log(`Validation result: ${validation.valid ? "PASS" : "FAIL"}`);
  if (!validation.valid) {
    console.log("Errors:", validation.errors.length);
    validation.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  // Log attempt
  await supabase.from("seo_blog_generation_logs").insert({
    blog_id: blogId,
    attempt_number: attemptNumber,
    attempt_type: attemptType,
    system_prompt: systemPrompt.substring(0, 1000), // Truncate for storage
    user_prompt: userPrompt.substring(0, 1000),
    llm_response: response.content.substring(0, 2000),
    llm_raw_response: blog,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    was_valid: validation.valid,
    tokens_used: response.usage.total_tokens,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
  });

  return {
    blog,
    validation,
    tokens: response.usage.total_tokens,
    cost: response.cost_usd,
  };
}

/**
 * Collect Google Analytics data for the brand
 */
async function collectBrandAnalytics(supabaseClient: any, brandId: string): Promise<string> {
  try {
    console.log(`[Analytics] Collecting analytics for brand ${brandId}...`);

    // Fetch recent analytics data from brand_analytics_data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analyticsData, error } = await supabaseClient
      .from("brand_analytics_data")
      .select("data_type, metrics, date_range_start, date_range_end")
      .eq("brand_id", brandId)
      .gte("date_range_start", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date_range_end", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[Analytics] Error fetching analytics:", error);
      return "";
    }

    if (!analyticsData || analyticsData.length === 0) {
      console.log("[Analytics] No recent analytics data found");
      return "";
    }

    // Format analytics context
    const analyticsPieces: string[] = ["BRAND ANALYTICS (Last 30 Days):"];

    for (const record of analyticsData) {
      const metrics = record.metrics as Record<string, any>;
      if (metrics) {
        const metricLines: string[] = [];
        for (const [key, value] of Object.entries(metrics)) {
          if (typeof value === "number") {
            metricLines.push(`  - ${key}: ${value.toLocaleString()}`);
          }
        }
        if (metricLines.length > 0) {
          analyticsPieces.push(`${record.data_type}:`);
          analyticsPieces.push(...metricLines);
        }
      }
    }

    if (analyticsPieces.length > 1) {
      console.log(`[Analytics] Collected ${analyticsData.length} analytics records`);
      return analyticsPieces.join("\n");
    }

    return "";
  } catch (error) {
    console.error("[Analytics] Error collecting analytics context:", error);
    return "";
  }
}

/**
 * Collect Brand KPIs
 */
async function collectBrandKPIs(supabaseClient: any, brandId: string): Promise<string> {
  try {
    console.log(`[KPIs] Collecting KPIs for brand ${brandId}...`);

    const { data: kpis, error } = await supabaseClient
      .from("brand_kpis")
      .select("name, type, current_value, target_value, description")
      .eq("brand_id", brandId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[KPIs] Error fetching KPIs:", error);
      return "";
    }

    if (!kpis || kpis.length === 0) {
      console.log("[KPIs] No KPIs found");
      return "";
    }

    // Format KPIs context
    const kpiLines: string[] = ["BRAND KEY PERFORMANCE INDICATORS:"];

    for (const kpi of kpis) {
      let line = `- ${kpi.name} (${kpi.type}): ${kpi.current_value}`;
      if (kpi.target_value) {
        const progress = Math.round((kpi.current_value / kpi.target_value) * 100);
        line += ` / Target: ${kpi.target_value} (${progress}% achieved)`;
      }
      if (kpi.description) {
        line += ` - ${kpi.description}`;
      }
      kpiLines.push(line);
    }

    console.log(`[KPIs] Collected ${kpis.length} KPIs`);
    return kpiLines.join("\n");
  } catch (error) {
    console.error("[KPIs] Error collecting KPIs context:", error);
    return "";
  }
}
