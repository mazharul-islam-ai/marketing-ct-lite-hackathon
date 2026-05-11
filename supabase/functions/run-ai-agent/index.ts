import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchKnowledgeEmbeddings, searchAgentMemories, searchBrandEmbeddings } from "../_shared/integrations/pgvector.ts";
import { calculateAgentCost } from "../_shared/cost-calculator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentRunRequest {
  agent_id: string;
  execution_context: {
    timeframe?: string;
    filters?: any;
    office_ids?: string[];
    user_id: string;
    prompt?: string;
    context?: string;
    model?: string;
    leader_id?: string;
    topic?: string;
    keywords?: string[];
    content_source?: any;
    metadata?: any;
    competitors?: string[];
    brandId?: string;
    brandName?: string;
    // Chief of Staff agent properties
    scope?: string;
    risk_threshold_days?: number;
    include?: string[];
  };
}

interface AIAnalysisResponse {
  summary: string;
  key_findings: string[];
  recommendations: string[];
  action_items: Array<{
    type: 'task';
    description: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    due_date?: string;
    confidence: number;
  }>;
  metrics: {
    total_items_analyzed: number;
    anomalies_found: number;
    high_priority_issues: number;
  };
  confidence_score?: number;
}

type ProviderName = "openai" | "gemini" | "perplexity" | "claude" | "grok";

interface AgentProviderConfig {
  model_provider?: ProviderName | string;
  model_version?: string;
  external_data_sources?: Record<string, unknown> | null;
  fallback_provider?: string;
}

interface ProviderPreference {
  provider: ProviderName;
  version: string;
  apiModel: string;
}

interface ProviderCallResult {
  text: string;
  responseTime: number;
  provider: ProviderName;
  version: string;
  apiModel: string;
  usage?: {
    totalTokens?: number | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
  };
}

function normalizeProviderName(value?: string | null): ProviderName {
  const normalized = (value || "openai").toLowerCase();
  if (normalized === "gemini") return "gemini";
  if (normalized === "perplexity") return "perplexity";
  if (normalized === "claude") return "claude";
  if (normalized === "grok") return "grok";
  return "openai";
}

function normalizeProviderVersion(provider: ProviderName, version?: string | null) {
  if (provider === "gemini") {
    const requested = version && version.length > 0 ? version : "2.0-pro";
    const apiModel = requested.startsWith("gemini-") ? requested : `gemini-${requested}`;
    return { version: requested, apiModel };
  }

  if (provider === "perplexity") {
    const requested = version && version.length > 0 ? version : "v4";
    const apiModel = requested.toLowerCase() === "v4" ? "sonar-reasoning-pro" : requested;
    return { version: requested, apiModel };
  }

  if (provider === "claude") {
    const requested = version && version.length > 0 ? version : "claude-3-5-sonnet-20241022";
    return { version: requested, apiModel: requested };
  }

  if (provider === "grok") {
    const requested = version && version.length > 0 ? version : "grok-3-mini";
    return { version: requested, apiModel: requested };
  }

  const requested = version && version.length > 0 ? version : "gpt-4o-mini";
  return { version: requested, apiModel: requested };
}

function parseFallbackProvider(value?: string | null): ProviderPreference | null {
  if (!value) return null;
  const [providerPart, versionPart] = value.split(":");
  const provider = normalizeProviderName(providerPart);
  const { version, apiModel } = normalizeProviderVersion(provider, versionPart || undefined);
  return { provider, version, apiModel };
}

function buildProviderPreferences(config: AgentProviderConfig | null | undefined): ProviderPreference[] {
  const list: ProviderPreference[] = [];
  const primaryProvider = normalizeProviderName(config?.model_provider as string | undefined);
  const primary = normalizeProviderVersion(primaryProvider, config?.model_version);
  list.push({ provider: primaryProvider, version: primary.version, apiModel: primary.apiModel });

  const fallback = parseFallbackProvider(config?.fallback_provider);
  if (fallback) {
    list.push(fallback);
  }

  // Always ensure OpenAI mini is present as ultimate fallback
  const defaultFallback = normalizeProviderVersion("openai", "gpt-4o-mini");
  list.push({ provider: "openai", version: defaultFallback.version, apiModel: defaultFallback.apiModel });

  const seen = new Set<string>();
  return list.filter((pref) => {
    const key = `${pref.provider}:${pref.apiModel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readIntegrationConfig(client: any, integration: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('organization_integrations')
    .select('config')
    .eq('integration', integration)
    .maybeSingle();

  if (error) {
    console.error(`[run-ai-agent] Failed to read integration config for ${integration}`, error);
    return null;
  }

  return (data?.config ?? null) as Record<string, unknown> | null;
}

const getAgentKnowledgeCollections = (agent: any, defaultCollection: string | null): string[] => {
  if (Array.isArray(agent?.knowledge_collections)) {
    return agent.knowledge_collections.filter((value: unknown) => typeof value === 'string');
  }

  const config = agent?.config as Record<string, unknown> | null;
  if (config) {
    const direct = config.knowledge_collections;
    if (Array.isArray(direct)) {
      return direct.filter((value) => typeof value === 'string') as string[];
    }

    const nested = (config.knowledge as Record<string, unknown> | undefined)?.collections;
    if (Array.isArray(nested)) {
      return nested.filter((value) => typeof value === 'string') as string[];
    }
  }

  return defaultCollection ? [defaultCollection] : [];
};

async function collectKnowledgeContext(client: any, agent: any, queryText: string): Promise<string> {
  if (!queryText) {
    return '';
  }

  try {
    // Get category IDs from agent configuration
    const categoryIds = getAgentKnowledgeCollections(agent, null);
    if (!categoryIds.length) {
      console.log('[run-ai-agent] No knowledge categories configured for agent');
      return '';
    }

    // Search knowledge embeddings using pgvector
    const snippets = await searchKnowledgeEmbeddings(
      client,
      queryText,
      categoryIds,
      5,
      0.7
    );

    return snippets.join('\n\n');
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect knowledge context', error);
    return '';
  }
}

interface BrandKnowledgeResult {
  context: string;
  snippetCount: number;
  fileCount: number;
  charCount: number;
  usedEmbeddings: boolean;
  usedFileSummaries: boolean;
}

/**
 * Collect brand-specific knowledge context using pgvector similarity search
 * with fallback to file summaries when embeddings are missing
 */
async function collectBrandKnowledgeContext(client: any, brandId: string, queryText: string): Promise<BrandKnowledgeResult> {
  const emptyResult: BrandKnowledgeResult = {
    context: '',
    snippetCount: 0,
    fileCount: 0,
    charCount: 0,
    usedEmbeddings: false,
    usedFileSummaries: false,
  };

  if (!queryText || !brandId) {
    return emptyResult;
  }

  try {
    console.log(`[run-ai-agent] Collecting brand knowledge for brand ${brandId}`);
    
    // Search brand knowledge embeddings using pgvector
    const snippets = await searchBrandEmbeddings(
      client,
      queryText,
      [brandId],
      10,
      0.5  // Lower threshold to get more results
    );

    if (snippets.length > 0) {
      console.log(`[run-ai-agent] Found ${snippets.length} brand knowledge snippets via embeddings`);
      const context = snippets.join('\n\n');
      return {
        context,
        snippetCount: snippets.length,
        fileCount: 0,
        charCount: context.length,
        usedEmbeddings: true,
        usedFileSummaries: false,
      };
    }
    
    // Fallback 1: get chunks directly from embeddings table
    const { data: knowledgeChunks } = await client
      .from('brand_knowledge_embeddings')
      .select('chunk_text')
      .eq('brand_id', brandId)
      .limit(15);

    if (knowledgeChunks && knowledgeChunks.length > 0) {
      console.log(`[run-ai-agent] Fallback: found ${knowledgeChunks.length} knowledge chunks`);
      const context = knowledgeChunks.map((f: any) => f.chunk_text).join('\n\n');
      return {
        context,
        snippetCount: knowledgeChunks.length,
        fileCount: 0,
        charCount: context.length,
        usedEmbeddings: true,
        usedFileSummaries: false,
      };
    }
    
    // Fallback 2: Use file summaries from brand_knowledge_files
    const { data: knowledgeFiles } = await client
      .from('brand_knowledge_files')
      .select('file_name, file_summary, file_type')
      .eq('brand_id', brandId)
      .not('file_summary', 'is', null)
      .limit(20);

    if (knowledgeFiles && knowledgeFiles.length > 0) {
      console.log(`[run-ai-agent] Fallback 2: Using ${knowledgeFiles.length} file summaries`);
      const summaries = knowledgeFiles.map((f: any) => 
        `**${f.file_name}** (${f.file_type})\n${f.file_summary}`
      );
      const context = `## KNOWLEDGE BASE FILE SUMMARIES\n\n${summaries.join('\n\n---\n\n')}`;
      return {
        context,
        snippetCount: 0,
        fileCount: knowledgeFiles.length,
        charCount: context.length,
        usedEmbeddings: false,
        usedFileSummaries: true,
      };
    }

    console.log(`[run-ai-agent] No brand knowledge found for brand ${brandId}`);
    return emptyResult;
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect brand knowledge context', error);
    return emptyResult;
  }
}

/**
 * Fetch brand analytics data for context - ENHANCED
 */
async function collectBrandAnalyticsContext(client: any, brandId: string): Promise<string> {
  if (!brandId) {
    return '';
  }

  try {
    // Fetch recent analytics data with more detail
    const { data: analyticsData } = await client
      .from('brand_analytics_data')
      .select('data_type, metrics, date_range_start, date_range_end, dimensions, raw_data')
      .eq('brand_id', brandId)
      .order('date_range_end', { ascending: false })
      .limit(30);

    if (!analyticsData || analyticsData.length === 0) {
      console.log(`[run-ai-agent] No analytics data found for brand ${brandId}`);
      return '';
    }

    // Group analytics by data type and summarize
    const grouped: Record<string, any[]> = {};
    analyticsData.forEach((d: any) => {
      const type = d.data_type || 'unknown';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(d);
    });

    const sections: string[] = [];
    
    for (const [type, records] of Object.entries(grouped)) {
      const summary = records.map((d: any) => {
        const metrics = d.metrics || {};
        const metricStr = Object.entries(metrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return `  - ${d.date_range_start} to ${d.date_range_end}: ${metricStr}`;
      }).join('\n');
      
      sections.push(`### ${type.replace(/_/g, ' ').toUpperCase()}\n${summary}`);
    }

    console.log(`[run-ai-agent] Found ${analyticsData.length} analytics records for brand`);
    return sections.join('\n\n');
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect brand analytics context', error);
    return '';
  }
}

/**
 * Fetch brand KPIs for context - ENHANCED
 */
async function collectBrandKPIsContext(client: any, brandId: string): Promise<string> {
  if (!brandId) {
    return '';
  }

  try {
    const { data: kpis } = await client
      .from('brand_kpis')
      .select('name, current_value, target_value, type, description, display_order')
      .eq('brand_id', brandId)
      .order('display_order', { ascending: true });

    if (!kpis || kpis.length === 0) {
      console.log(`[run-ai-agent] No KPIs found for brand ${brandId}`);
      return '';
    }

    const kpiLines = kpis.map((k: any) => {
      const progress = k.target_value ? Math.round((k.current_value / k.target_value) * 100) : null;
      const progressStr = progress !== null ? ` (${progress}% of target)` : '';
      const symbol = k.type === 'currency' ? '$' : k.type === 'percentage' ? '%' : '';
      const prefix = k.type === 'currency' ? '$' : '';
      const suffix = k.type === 'percentage' ? '%' : '';
      
      return `- **${k.name}**: ${prefix}${k.current_value}${suffix}${k.target_value ? ` → Target: ${prefix}${k.target_value}${suffix}` : ''}${progressStr}${k.description ? ` | ${k.description}` : ''}`;
    });

    console.log(`[run-ai-agent] Found ${kpis.length} KPIs for brand`);
    return `### BRAND KPIs\n${kpiLines.join('\n')}`;
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect brand KPIs context', error);
    return '';
  }
}

/**
 * Fetch complete brand information
 */
async function collectBrandInfoContext(client: any, brandId: string): Promise<{ info: string; brandData: any }> {
  if (!brandId) {
    return { info: '', brandData: null };
  }

  try {
    const { data: brand } = await client
      .from('brands')
      .select('name, description, website_url, status, type, monthly_budget, active_integrations, team_members')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return { info: '', brandData: null };
    }

    const lines = [
      `### BRAND INFORMATION`,
      `- **Name**: ${brand.name}`,
      `- **Description**: ${brand.description || 'No description'}`,
      `- **Website**: ${brand.website_url || 'Not set'}`,
      `- **Status**: ${brand.status}`,
      `- **Type**: ${brand.type || 'Not specified'}`,
      `- **Monthly Budget**: ${brand.monthly_budget ? `$${brand.monthly_budget}` : 'Not set'}`,
      `- **Active Integrations**: ${brand.active_integrations?.join(', ') || 'None'}`,
      `- **Team Size**: ${brand.team_members?.length || 0} members`,
    ];

    console.log(`[run-ai-agent] Collected brand info for ${brand.name}`);
    return { info: lines.join('\n'), brandData: brand };
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect brand info context', error);
    return { info: '', brandData: null };
  }
}

async function collectMemoryContext(client: any, agent: any, queryText: string, fallbackUserId: string): Promise<string> {
  const userId = typeof agent?.created_by === 'string' && agent.created_by.length > 0 ? agent.created_by : fallbackUserId;

  if (!userId) {
    return '';
  }

  try {
    // Search agent memories using pgvector
    const snippets = await searchAgentMemories(
      client,
      queryText,
      userId,
      agent.id,
      5,
      0.6
    );

    return snippets.join('\n\n');
  } catch (error) {
    console.error('[run-ai-agent] Failed to collect memory context', error);
    return '';
  }
}

function getProviderApiKey(provider: ProviderName) {
  switch (provider) {
    case "gemini":
      return { key: Deno.env.get("GEMINI_API_KEY") || null, envVar: "GEMINI_API_KEY" };
    case "perplexity":
      return { key: Deno.env.get("PERPLEXITY_API_KEY") || null, envVar: "PERPLEXITY_API_KEY" };
    case "claude":
      return { key: Deno.env.get("CLAUDE_API_KEY") || null, envVar: "CLAUDE_API_KEY" };
    case "grok":
      return { key: Deno.env.get("grok") || null, envVar: "grok" };
    default:
      return { key: Deno.env.get("OPENAI_KEY") || null, envVar: "OPENAI_KEY" };
  }
}

function summarizeExternalSources(config: AgentProviderConfig | null | undefined): string | null {
  if (!config?.external_data_sources || typeof config.external_data_sources !== "object") {
    return null;
  }

  try {
    const entries = Object.entries(config.external_data_sources)
      .filter(([_, value]) => value && typeof value === "object" && (value as { enabled?: boolean }).enabled)
      .map(([name, value]) => {
        const record = value as Record<string, unknown>;
        const version = typeof record.version === "string" ? record.version : undefined;
        const modes = Array.isArray(record.modes) ? record.modes : [];
        const modesText = modes.length > 0 ? `modes: ${modes.join(", ")}` : "";
        return `${name}${version ? ` v${version}` : ""}${modesText ? ` (${modesText})` : ""}`;
      });

    if (entries.length === 0) return null;
    return entries.join("; ");
  } catch (_error) {
    return null;
  }
}

async function callOpenAI(
  versionLabel: string,
  apiModel: string,
  systemPrompt: string,
  userPrompt: string,
  modelParams: Record<string, unknown>,
  forceJson: boolean = false
): Promise<ProviderCallResult> {
  const { key } = getProviderApiKey("openai");
  if (!key) {
    throw new Error("Missing OpenAI API key");
  }

  const start = Date.now();
  
  // Sanitize modelParams to avoid setting both max_tokens and max_completion_tokens
  const sanitizedParams = { ...modelParams };
  if (sanitizedParams.max_tokens !== undefined && sanitizedParams.max_completion_tokens !== undefined) {
    // Prefer max_completion_tokens for newer models, remove max_tokens
    delete sanitizedParams.max_tokens;
  }
  
  const requestBody: any = {
    ...sanitizedParams,
    model: apiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  };
  
  // Enable JSON response format for compatible models
  if (forceJson && (apiModel.includes('gpt-4') || apiModel.includes('gpt-5'))) {
    requestBody.response_format = { type: "json_object" };
  }
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content || "";
  const elapsed = Date.now() - start;
  const usage = json.usage || {};

  return {
    text,
    responseTime: elapsed,
    provider: "openai",
    version: versionLabel,
    apiModel,
    usage: {
      totalTokens: usage.total_tokens ?? null,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
    },
  };
}

async function callGemini(
  versionLabel: string,
  apiModel: string,
  systemPrompt: string,
  userPrompt: string,
  modelParams: Record<string, unknown>
): Promise<ProviderCallResult> {
  const { key } = getProviderApiKey("gemini");
  if (!key) {
    throw new Error("Missing Gemini API key");
  }

  const maxOutputTokens = typeof modelParams.max_tokens === "number"
    ? modelParams.max_tokens
    : typeof modelParams.max_completion_tokens === "number"
      ? modelParams.max_completion_tokens
      : 2048;
  const temperature = typeof modelParams.temperature === "number" ? modelParams.temperature : 0.7;

  const payload: any = {
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json", // Force JSON output
    },
  };

  const start = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const candidates = json.candidates || [];
  const text = candidates
    .flatMap((candidate: { content?: { parts?: Array<{ text?: string }> } }) =>
      candidate.content?.parts?.map((part) => part?.text || "") ?? [])
    .join("\n");
  const elapsed = Date.now() - start;
  
  // Extract usage metadata from Gemini response
  const usageMetadata = json.usageMetadata || {};

  return {
    text,
    responseTime: elapsed,
    provider: "gemini",
    version: versionLabel,
    apiModel,
    usage: {
      totalTokens: usageMetadata.totalTokenCount ?? null,
      promptTokens: usageMetadata.promptTokenCount ?? null,
      completionTokens: usageMetadata.candidatesTokenCount ?? null,
    },
  };
}

async function callPerplexity(
  versionLabel: string,
  apiModel: string,
  systemPrompt: string,
  userPrompt: string,
  modelParams: Record<string, unknown>,
  externalSummary: string | null
): Promise<ProviderCallResult> {
  const { key } = getProviderApiKey("perplexity");
  if (!key) {
    throw new Error("Missing Perplexity API key");
  }

  const temperature = typeof modelParams.temperature === "number" ? modelParams.temperature : 0.2;
  const messages = [
    { role: "system", content: externalSummary ? `${systemPrompt}\n\nExternal data sources available: ${externalSummary}` : systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const payload = {
    model: apiModel,
    temperature,
    return_related_questions: false,
    messages,
  };

  const start = Date.now();
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content || "";
  const elapsed = Date.now() - start;

  return {
    text,
    responseTime: elapsed,
    provider: "perplexity",
    version: versionLabel,
    apiModel,
  };
}

async function callClaude(
  versionLabel: string,
  apiModel: string,
  systemPrompt: string,
  userPrompt: string,
  modelParams: Record<string, unknown>
): Promise<ProviderCallResult> {
  const { key } = getProviderApiKey("claude");
  if (!key) {
    throw new Error("Missing Claude API key");
  }

  const maxTokens = typeof modelParams.max_tokens === "number"
    ? modelParams.max_tokens
    : typeof modelParams.max_completion_tokens === "number"
      ? modelParams.max_completion_tokens
      : 2048;
  const temperature = typeof modelParams.temperature === "number" ? modelParams.temperature : 0.7;

  const payload = {
    model: apiModel,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt
      }
    ],
  };

  const start = Date.now();
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  const text = json.content?.[0]?.text || "";
  const elapsed = Date.now() - start;
  const usage = json.usage || {};

  return {
    text,
    responseTime: elapsed,
    provider: "claude",
    version: versionLabel,
    apiModel,
    usage: {
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      promptTokens: usage.input_tokens ?? null,
      completionTokens: usage.output_tokens ?? null,
    },
  };
}

async function callGrok(
  versionLabel: string,
  apiModel: string,
  systemPrompt: string,
  userPrompt: string,
  modelParams: Record<string, unknown>
): Promise<ProviderCallResult> {
  const { key } = getProviderApiKey("grok");
  if (!key) {
    throw new Error("Missing Grok API key (grok)");
  }

  const start = Date.now();

  const requestBody: any = {
    ...modelParams,
    model: apiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
  };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  // Defensive extraction: some OpenAI-compatible providers return content as
  // an array [{type:"text", text:"..."}] instead of a plain string
  const msg = json.choices?.[0]?.message?.content;
  const text = typeof msg === "string" ? msg : msg?.[0]?.text ?? "";
  const elapsed = Date.now() - start;
  const usage = json.usage || {};

  return {
    text,
    responseTime: elapsed,
    provider: "grok",
    version: versionLabel,
    apiModel,
    usage: {
      totalTokens: usage.total_tokens ?? null,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
    },
  };
}

// LinkedIn Content Generation Handler
async function handleLinkedInContentGeneration(client: any, executionContext: any): Promise<{ systemPrompt: string; userPrompt: string; toolConfig?: any }> {
  const leaderId = executionContext.leader_id;
  const sourceType = executionContext.source_type || 'custom';
  const sourceId = executionContext.source_id;
  const customContent = executionContext.custom_content;
  const headlineIdea = executionContext.headline_idea;
  const callToAction = executionContext.call_to_action;
  const influencerStyleIds = executionContext.influencer_styles || [];
  const model = executionContext.model || 'gpt-5-mini-2025-08-07';

  console.log('🎯 LinkedIn generation for leader:', leaderId);

  // Fetch leader
  const { data: leader, error: leaderError } = await client
    .from('thought_leaders')
    .select('*')
    .eq('id', leaderId)
    .single();

  if (leaderError || !leader) throw new Error('Leader not found');

  // Build content brief
  let contentBrief = '';
  if (sourceType === 'trend' && sourceId) {
    const { data: trend } = await client
      .from('weekly_trends')
      .select('*')
      .eq('id', sourceId)
      .single();
    if (trend) {
      contentBrief = `Weekly Trend: ${trend.topic_title}\n${trend.topic_summary}`;
    }
  } else if (sourceType === 'custom' && customContent) {
    contentBrief = `Custom Brief:\n${customContent}`;
  }

  if (headlineIdea) contentBrief += `\n\nHeadline Idea: ${headlineIdea}`;
  if (callToAction) contentBrief += `\n\nCall to Action: ${callToAction}`;

  // Fetch influencer styles
  let influencerContext = '';
  if (influencerStyleIds.length > 0) {
    const { data: influencers } = await client
      .from('influencer_style_library')
      .select('*')
      .in('id', influencerStyleIds)
      .eq('is_active', true);

    if (influencers && influencers.length > 0) {
      influencerContext = '\n\nINFLUENCER STYLES TO BLEND:\n' + influencers
        .map((inf: any) => `${inf.influencer_name}:\n${inf.style_description}\n\nSample Posts:\n${inf.sample_posts?.join('\n\n') || ''}`)
        .join('\n\n---\n\n');
    }
  }

  // Fetch leader uploads for context
  const { data: leaderUploads } = await client
    .from('leader_uploads')
    .select('file_name, file_summary, extracted_text')
    .eq('leader_id', leaderId)
    .eq('is_indexed', true);

  let leaderDocsContext = '';
  if (leaderUploads && leaderUploads.length > 0) {
    leaderDocsContext = '\n\nLEADER DOCUMENTS:\n' + leaderUploads
      .map((doc: any) => `${doc.file_name}:\n${doc.file_summary || doc.extracted_text?.substring(0, 500) || 'No summary'}`)
      .join('\n\n---\n\n');
  }

  // Fetch company knowledge
  const { data: knowledgeEntries } = await client
    .from('knowledge_base')
    .select('title, content')
    .eq('is_active', true)
    .limit(20);

  let companyKnowledge = '';
  if (knowledgeEntries && knowledgeEntries.length > 0) {
    companyKnowledge = '\n\nCOMPANY KNOWLEDGE:\n' + knowledgeEntries
      .map((entry: any) => `${entry.title}:\n${entry.content}`)
      .join('\n\n---\n\n');
  }

  // Fetch agent template if configured
  let templatePrompt = '';
  if (leader.agent_template_id) {
    const { data: template } = await client
      .from('linkedin_agent_templates')
      .select('system_prompt')
      .eq('id', leader.agent_template_id)
      .eq('is_active', true)
      .single();
    if (template) templatePrompt = template.system_prompt;
  }

  // Build system prompt
  const systemPrompt = templatePrompt || `You are a LinkedIn content strategist helping ${leader.name} (${leader.title || 'Professional'}${leader.department ? ' at ' + leader.department : ''}) create engaging posts.

Tone: ${leader.persona_tone || 'professional and authentic'}
${leader.personal_context?.bio ? `Bio: ${leader.personal_context.bio}` : ''}

${companyKnowledge}

${leaderDocsContext}

${influencerContext}

Generate content that:
1. Opens with a strong hook
2. Provides valuable insights
3. Matches ${leader.name}'s authentic voice
4. Includes a clear call to action
5. Connects to actionable takeaways`;

  // Build user prompt
  const userPrompt = `${contentBrief}

Generate a compelling LinkedIn post that engages ${leader.name}'s audience.`;

  // Define structured output tool for LinkedIn posts
  const linkedinPostTool = {
    type: "function",
    function: {
      name: "generate_linkedin_post",
      description: "Generate a LinkedIn post with structured output",
      parameters: {
        type: "object",
        properties: {
          post_title: { type: "string", description: "Post title/hook" },
          post_body: { type: "string", description: "Full post content" },
          carousel_outline: {
            type: "array",
            items: { type: "string" },
            description: "Optional carousel slide outlines"
          },
          caption_ideas: {
            type: "array",
            items: { type: "string" },
            description: "Alternative caption variations"
          }
        },
        required: ["post_title", "post_body"]
      }
    }
  };

  console.log(`✅ LinkedIn context built for ${leader.name}`);

  return {
    systemPrompt,
    userPrompt,
    toolConfig: {
      tools: [linkedinPostTool],
      tool_choice: { type: "function", function: { name: "generate_linkedin_post" } }
    }
  };
}

async function getClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  });
}

async function requireAuth(client: any): Promise<string | null> {
  const { data: { user } } = await client.auth.getUser();
  return user?.id || null;
}

async function fetchConfigurations(client: any) {
  const { data: config, error } = await client
    .from('ai_configurations')
    .select('business_context, model_settings, prompts')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    businessContext: config?.business_context || {},
    modelSettings: config?.model_settings || { default_model: 'gpt-4o-mini' },
    prompts: config?.prompts || {}
  };
}

function getModelParameters(modelSettings: any) {
  const model = modelSettings.default_model || 'gpt-4o-mini';
  const params: any = { model };
  
  // Newer models (GPT-5, O3, O4) use max_completion_tokens and don't support temperature
  if (model.includes('gpt-5') || model.includes('o3') || model.includes('o4')) {
    if (modelSettings.max_completion_tokens) {
      params.max_completion_tokens = modelSettings.max_completion_tokens;
    }
    // Don't set temperature for newer models
  } else {
    // Legacy models (GPT-4, GPT-4o) use max_tokens and support temperature
    if (modelSettings.max_tokens) {
      params.max_tokens = modelSettings.max_tokens;
    }
    if (modelSettings.temperature !== undefined) {
      params.temperature = modelSettings.temperature;
    }
  }
  
  return params;
}

function assemblePrompt(
  agent: any,
  businessContext: any,
  prompts: any,
  executionContext: any,
  knowledgeContext?: string,
  memoryContext?: string,
) {
  let systemPrompt = agent.system_prompt;

  // Replace business context variables
  if (businessContext.company_name) {
    systemPrompt = systemPrompt.replace(/\{company_name\}/g, businessContext.company_name);
  }
  if (businessContext.industry) {
    systemPrompt = systemPrompt.replace(/\{industry\}/g, businessContext.industry);
  }

  // Add seasonal context if available
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  const seasonalRule = businessContext.seasonal_rules?.[`Q${currentQuarter}`];
  if (seasonalRule) {
    systemPrompt += `\n\nSeasonal Context: ${seasonalRule}`;
  }

  // Add company policies
  if (businessContext.company_policies) {
    systemPrompt += `\n\nCompany Policies: ${businessContext.company_policies}`;
  }

  if (knowledgeContext) {
    systemPrompt += `\n\nKnowledge Context (Company Knowledge Base):\n${knowledgeContext}`;
  }

  if (memoryContext) {
    systemPrompt += `\n\nAgent Memory (Mem0):\n${memoryContext}`;
  }

  return systemPrompt;
}

function parseAIResponse(responseText: string): AIAnalysisResponse & { _parse_error?: string } {
  // Attempt 1: Direct JSON parsing
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.log('[parseAIResponse] Direct JSON parse failed, trying cleanup approaches...');
  }
  
  // Attempt 2: Extract JSON from markdown code blocks
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e2) {
      console.log('[parseAIResponse] Code block JSON parse failed');
    }
  }
  
  // Attempt 3: Find the largest JSON-like block
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let jsonStr = jsonMatch[0];
    
    // Attempt 3a: Direct parse
    try {
      return JSON.parse(jsonStr);
    } catch (e3) {
      console.log('[parseAIResponse] JSON pattern match failed, trying cleanup');
    }
    
    // Attempt 3b: Fix trailing commas
    try {
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(jsonStr);
    } catch (e4) {
      console.log('[parseAIResponse] Trailing comma fix failed');
    }
    
    // Attempt 3c: Fix unescaped quotes in strings
    try {
      jsonStr = jsonMatch[0].replace(/:\s*"([^"]*?)(?<!\\)"/g, (match, content) => {
        const escaped = content.replace(/(?<!\\)"/g, '\\"');
        return `: "${escaped}"`;
      });
      return JSON.parse(jsonStr);
    } catch (e5) {
      console.log('[parseAIResponse] Quote escaping fix failed');
    }
  }
  
  // Attempt 4: Look for key sections and build structured response
  const summaryMatch = responseText.match(/(?:summary|Summary|SUMMARY)[:\s]*["']?([^"\n]+)/);
  const findingsMatch = responseText.match(/(?:findings|Findings|key_findings)[:\s]*\[([^\]]+)\]/);
  const recommendationsMatch = responseText.match(/(?:recommendations|Recommendations)[:\s]*\[([^\]]+)\]/);
  
  if (summaryMatch || findingsMatch || recommendationsMatch) {
    console.log('[parseAIResponse] Extracting partial structured data from text');
    
    const extractArrayItems = (match: RegExpMatchArray | null): string[] => {
      if (!match) return [];
      return match[1]
        .split(',')
        .map(s => s.replace(/["\n]/g, '').trim())
        .filter(s => s.length > 0);
    };
    
    return {
      summary: summaryMatch ? summaryMatch[1].trim() : responseText.substring(0, 1000),
      key_findings: extractArrayItems(findingsMatch),
      recommendations: extractArrayItems(recommendationsMatch),
      action_items: [],
      metrics: {
        total_items_analyzed: 0,
        anomalies_found: 0,
        high_priority_issues: 0
      },
      confidence_score: 0.6,
      _parse_error: 'Partial extraction from non-JSON response'
    };
  }
  
  // Final fallback: Return full text as summary (don't truncate!)
  console.log('[parseAIResponse] All parse attempts failed, using full text fallback');
  return {
    summary: responseText.length > 2000 ? responseText.substring(0, 2000) + '...' : responseText,
    key_findings: ['⚠️ Response format was not valid JSON - showing raw analysis'],
    recommendations: ['Consider adjusting AI model or prompt configuration for structured output'],
    action_items: [],
    metrics: {
      total_items_analyzed: 0,
      anomalies_found: 0,
      high_priority_issues: 0
    },
    confidence_score: 0.4,
    _parse_error: 'Could not parse JSON response'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const client = await getClient(req);
  const userId = await requireAuth(client);

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: corsHeaders 
    });
  }

  try {
    const body: AgentRunRequest = await req.json();
    const { agent_id, execution_context } = body;

    console.log('Running AI agent:', agent_id);

    // Fetch agent configuration
    const { data: agent, error: agentError } = await client
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found or access denied');
    }

    // Handle Chief of Staff agent - delegate to dedicated function
    if (agent.slug === 'chief-of-staff') {
      console.log('🎯 Routing to Chief of Staff agent handler');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      const chiefResponse = await fetch(`${supabaseUrl}/functions/v1/chief-of-staff-agent`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          office_ids: execution_context.office_ids,
          scope: execution_context.scope,
          risk_threshold_days: execution_context.risk_threshold_days,
          include: execution_context.include,
        }),
      });

      if (!chiefResponse.ok) {
        const errorText = await chiefResponse.text();
        throw new Error(`Chief of Staff agent failed: ${chiefResponse.status} - ${errorText}`);
      }

      const chiefData = await chiefResponse.json();
      return new Response(JSON.stringify(chiefData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle LinkedIn content generation specially
    if (agent.slug === 'linkedin-content-gen') {
      console.log('🎯 Routing to LinkedIn content generation handler');
      const linkedinContext = await handleLinkedInContentGeneration(client, execution_context);
      
      // Use OpenAI directly with structured output
      const model = execution_context.model || 'gpt-5-mini-2025-08-07';
      const OPENAI_KEY = Deno.env.get('OPENAI_KEY');
      if (!OPENAI_KEY) throw new Error('OPENAI_KEY not configured');

      const startTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: linkedinContext.systemPrompt },
            { role: 'user', content: linkedinContext.userPrompt }
          ],
          tools: linkedinContext.toolConfig?.tools,
          tool_choice: linkedinContext.toolConfig?.tool_choice,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI error:', error);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      // Extract tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error('No tool call in response');

      const postData = JSON.parse(toolCall.function.arguments);

      // Calculate cost for this run
      const linkedinCostUsd = calculateAgentCost(
        'openai',
        model,
        data.usage?.prompt_tokens ?? 0,
        data.usage?.completion_tokens ?? 0
      );

      // Store in ai_agent_runs
      const { data: runRecord, error: runError } = await client
        .from('ai_agent_runs')
        .insert({
          agent_id: agent.id,
          executed_by: userId,
          execution_context,
          ai_summary: {
            post: postData,
            model_used: model,
            tokens_used: data.usage?.total_tokens || 0,
            generation_time_ms: generationTime,
            prompt_tokens: data.usage?.prompt_tokens || 0,
            completion_tokens: data.usage?.completion_tokens || 0
          },
          status: 'completed',
          category: 'content_generation',
          title: `LinkedIn Post for ${execution_context.leader_id}`,
          cost_usd: linkedinCostUsd,
          total_tokens: data.usage?.total_tokens || null,
          prompt_tokens: data.usage?.prompt_tokens || null,
          completion_tokens: data.usage?.completion_tokens || null,
          model_provider: 'openai',
          model_version: model,
          execution_time_ms: generationTime
        })
        .select()
        .single();

      if (runError) throw runError;

      return new Response(
        JSON.stringify({
          success: true,
          run_id: runRecord.id,
          post: postData,
          meta: {
            model_used: model,
            tokens_used: data.usage?.total_tokens || 0,
            generation_time_ms: generationTime
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch system configurations
    const configs = await fetchConfigurations(client);
    
    const promptSeed = execution_context.prompt
      || execution_context.context
      || execution_context.topic
      || agent.name;

    const knowledgeContext = await collectKnowledgeContext(client, agent, promptSeed);
    const memoryContext = await collectMemoryContext(client, agent, promptSeed, userId);

    // Collect brand-specific context if brandId is provided
    let brandKnowledgeContext = '';
    let brandAnalyticsContext = '';
    let brandKPIsContext = '';
    let brandInfoContext = '';
    let brandData: any = null;
    let brandKnowledgeStats: BrandKnowledgeResult | null = null;
    const brandId = execution_context.brandId as string | undefined;
    const brandName = execution_context.brandName as string | undefined;
    
    if (brandId) {
      console.log(`[run-ai-agent] Collecting brand-specific context for brand ${brandId}`);
      
      // Parallel fetch of brand contexts
      const [brandKnowledgeResult, brandAnalytics, brandKPIs, brandInfo] = await Promise.all([
        collectBrandKnowledgeContext(client, brandId, promptSeed),
        collectBrandAnalyticsContext(client, brandId),
        collectBrandKPIsContext(client, brandId),
        collectBrandInfoContext(client, brandId),
      ]);
      
      brandKnowledgeContext = brandKnowledgeResult.context;
      brandKnowledgeStats = brandKnowledgeResult;
      brandAnalyticsContext = brandAnalytics;
      brandKPIsContext = brandKPIs;
      brandInfoContext = brandInfo.info;
      brandData = brandInfo.brandData;
      
      console.log(`[run-ai-agent] Brand context collected - Knowledge: ${brandKnowledgeResult.charCount} chars (${brandKnowledgeResult.snippetCount} snippets, ${brandKnowledgeResult.fileCount} files), Analytics: ${brandAnalytics.length} chars, KPIs: ${brandKPIs.length} chars, Info: ${brandInfo.info.length} chars`);
    }

    // Assemble system prompt with business context
    let systemPrompt = assemblePrompt(
      agent,
      configs.businessContext,
      configs.prompts,
      execution_context,
      knowledgeContext,
      memoryContext,
    );

    // Append brand-specific context if available - with clear sections
    if (brandInfoContext) {
      systemPrompt += `\n\n---\n## BRAND DATA FOR ANALYSIS\n\n${brandInfoContext}`;
    }
    if (brandKPIsContext) {
      systemPrompt += `\n\n${brandKPIsContext}`;
    }
    if (brandAnalyticsContext) {
      systemPrompt += `\n\n### ANALYTICS DATA (Google Analytics & Other Sources)\n${brandAnalyticsContext}`;
    }
    if (brandKnowledgeContext) {
      systemPrompt += `\n\n### KNOWLEDGE BASE CONTENT\n${brandKnowledgeContext}`;
    }
    
    // Add explicit instruction to use the actual brand data
    if (brandId && (brandInfoContext || brandKPIsContext || brandAnalyticsContext || brandKnowledgeContext)) {
      systemPrompt += `\n\n---\n## CRITICAL INSTRUCTION\nYou MUST base your analysis on the ACTUAL brand data provided above. Reference specific KPIs, analytics metrics, and knowledge base content in your response. Do NOT generate hypothetical or placeholder data. Use the real brand name "${brandName || brandData?.name || 'the brand'}" in your analysis.`;
    }
    
    // Prepare model parameters
    const modelParams = getModelParameters(configs.modelSettings);
    
    // Simulate data fetching (replace with actual data queries based on agent.data_sources)
    const analysisData = {
      timeframe: execution_context.timeframe || 'current_month',
      category: agent.category,
      context: execution_context.context || 'Sample data for analysis',
      prompt: execution_context.prompt || null,
      keywords: execution_context.keywords || [],
      content_source: execution_context.content_source || null,
      metadata: execution_context.metadata || null,
      competitors: execution_context.competitors || [],
      knowledge_snippets: knowledgeContext ? knowledgeContext.split('\n\n').slice(0, 5) : [],
      memory_highlights: memoryContext ? memoryContext.split('\n\n').slice(0, 5) : [],
    };
    
    // Build user prompt based on agent category
    let userPrompt = '';
    
    if (agent.category === 'image_generation' && execution_context.prompt) {
      // Special handling for image generation prompt coaching
      userPrompt = `
Please analyze and improve the following image generation prompt:

Original Prompt: "${execution_context.prompt}"

Provide your response in the following JSON structure:
{
  "improved_prompt": "The enhanced version of the prompt with specific details about lighting, composition, camera angles, art style, and quality modifiers",
  "changes_made": ["Change 1: Added specific lighting details", "Change 2: Included camera angle", "Change 3: Specified art style"],
  "suggestions": ["Consider adding time of day for better lighting context", "Specify the mood or emotion you want to convey"],
  "confidence_score": 0.85
}
`;
    } else if (brandId && agent.slug === 'brand-performance-optimization') {
      // Special handling for brand performance optimization - ENHANCED
      const userRequest = execution_context.prompt || 'Provide a comprehensive performance analysis';
      
      // Override max_tokens for detailed output (use only max_completion_tokens for newer models)
      delete modelParams.max_tokens;
      modelParams.max_completion_tokens = 4096;
      
      // Increase token limit for very detailed output
      modelParams.max_completion_tokens = 8192;
      
      userPrompt = `
## ANALYSIS REQUEST
${userRequest}

## CONTEXT
- Brand: ${brandName || brandData?.name || 'Unknown'}
- Brand ID: ${brandId}
- Timeframe: ${execution_context.timeframe || '30 days'}
- Analysis Date: ${new Date().toISOString().split('T')[0]}

Using ALL the brand data provided in the system context (KPIs, analytics, and knowledge base), provide a COMPREHENSIVE, data-driven analysis with specific numbers, metrics, and actionable insights.

## REQUIRED OUTPUT FORMAT (Respond with ONLY valid JSON, no markdown or extra text)
{
  "summary": "Comprehensive 4-5 paragraph executive summary. Must reference at least 5 specific KPIs or metrics from the provided data. Include: 1) Current performance status with key numbers, 2) Major trends observed (positive and negative), 3) Comparison to targets or benchmarks, 4) Critical areas requiring attention, 5) Overall strategic assessment and outlook.",
  
  "key_findings": [
    {
      "title": "Finding title",
      "description": "Detailed finding with specific data points and context. Reference actual numbers from analytics or KPIs.",
      "impact": "high|medium|low",
      "category": "performance|growth|risk|opportunity"
    }
  ],
  
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed strategic or tactical recommendation",
      "rationale": "Why this recommendation based on the data",
      "expected_outcome": "Specific expected improvement with estimated numbers",
      "timeline": "immediate|short-term|medium-term|long-term",
      "priority": "critical|high|medium|low"
    }
  ],
  
  "action_items": [
    {
      "type": "task",
      "title": "Action item title",
      "description": "Detailed description of what needs to be done",
      "steps": [
        "Step 1: Specific first step",
        "Step 2: Specific second step", 
        "Step 3: Specific third step"
      ],
      "priority": "high|medium|low",
      "expected_impact": "Quantified expected improvement or outcome",
      "effort": "low|medium|high",
      "owner_suggestion": "Marketing|Sales|Operations|Leadership|Technical",
      "deadline_suggestion": "This week|Next 2 weeks|This month|Next quarter",
      "confidence": 0.9,
      "success_metrics": ["Metric 1 to track", "Metric 2 to track"]
    }
  ],
  
  "opportunities": [
    {
      "title": "Growth opportunity title",
      "description": "Detailed description of the opportunity",
      "potential_value": "Estimated value or impact",
      "required_investment": "What resources/effort needed",
      "risk_level": "low|medium|high"
    }
  ],
  
  "risks": [
    {
      "title": "Risk title",
      "description": "Description of the risk or concern",
      "severity": "critical|high|medium|low",
      "likelihood": "high|medium|low",
      "mitigation": "Suggested mitigation approach"
    }
  ],
  
  "metrics": {
    "kpis_analyzed": 5,
    "analytics_records_reviewed": 10,
    "knowledge_sources_referenced": 3,
    "high_priority_issues": 2,
    "medium_priority_issues": 3,
    "improvement_opportunities": 4,
    "quick_wins_identified": 2,
    "overall_health_score": "7.5/10",
    "trend_direction": "improving|stable|declining"
  },
  
  "data_sources_used": ["Brand KPIs", "Google Analytics", "Knowledge Base"],
  "confidence_score": 0.85,
  "analysis_depth": "comprehensive"
}

CRITICAL INSTRUCTIONS:
1. Respond with ONLY valid JSON - no markdown code blocks, no explanatory text before or after
2. Every finding and recommendation MUST reference specific data from the brand context
3. Do NOT use placeholder values like "X" or "TBD" - use real numbers from the provided data
4. If certain data is missing, note it explicitly but still analyze what IS available
5. Provide actionable, specific recommendations - not generic advice
6. Include AT LEAST 6-8 key findings with detailed descriptions
7. Include AT LEAST 5-7 recommendations with rationale and expected outcomes
8. Include AT LEAST 5-7 action items, each with 3-5 specific steps
9. Include AT LEAST 3 opportunities and 3 risks
10. Each action item MUST have specific steps, not just a description
`;
    } else {
      // Standard agent analysis prompt
      const keywordBlock = Array.isArray(execution_context.keywords) && execution_context.keywords.length > 0
        ? `\nTarget Keywords: ${JSON.stringify(execution_context.keywords)}`
        : '';
      const competitorBlock = Array.isArray(execution_context.competitors) && execution_context.competitors.length > 0
        ? `\nCompetitors: ${JSON.stringify(execution_context.competitors)}`
        : '';
      const sourceBlock = execution_context.content_source
        ? `\nContent Source: ${JSON.stringify(execution_context.content_source)}`
        : '';

      userPrompt = `
Analyze the following data and provide a structured response in JSON format:

Data Context: ${JSON.stringify(analysisData)}
Analysis Category: ${agent.category}
Timeframe: ${execution_context.timeframe || 'current_month'}${keywordBlock}${competitorBlock}${sourceBlock}

Please provide your analysis in the following JSON structure:
{
  "summary": "Brief summary of findings",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "action_items": [
    {
      "type": "task",
      "description": "Action description",
      "priority": "high|medium|low",
      "confidence": 0.85
    }
  ],
  "metrics": {
    "total_items_analyzed": 100,
    "anomalies_found": 5,
    "high_priority_issues": 2
  },
  "confidence_score": 0.85
}
`;
    }

    const providerConfig = agent.config as AgentProviderConfig | undefined;
    const providerPreferences = buildProviderPreferences(providerConfig);
    const externalSummary = summarizeExternalSources(providerConfig);

    let callResult: ProviderCallResult | null = null;
    const providerErrors: string[] = [];

    for (const pref of providerPreferences) {
      try {
        if (pref.provider === 'gemini') {
          callResult = await callGemini(pref.version, pref.apiModel, systemPrompt, userPrompt, modelParams);
        } else if (pref.provider === 'perplexity') {
          callResult = await callPerplexity(pref.version, pref.apiModel, systemPrompt, userPrompt, modelParams, externalSummary);
        } else if (pref.provider === 'claude') {
          callResult = await callClaude(pref.version, pref.apiModel, systemPrompt, userPrompt, modelParams);
        } else if (pref.provider === 'grok') {
          callResult = await callGrok(pref.version, pref.apiModel, systemPrompt, userPrompt, modelParams);
        } else {
          // Force JSON response for brand performance optimization
          const forceJson = agent.slug === 'brand-performance-optimization';
          callResult = await callOpenAI(pref.version, pref.apiModel, systemPrompt, userPrompt, modelParams, forceJson);
        }
        console.log(`AI provider selected: ${callResult.provider} (${callResult.apiModel}) in ${callResult.responseTime}ms`);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`${pref.provider}:${pref.apiModel} -> ${message}`);
        console.warn(`Provider ${pref.provider} failed:`, message);
      }
    }

    if (!callResult) {
      throw new Error(`All AI providers failed. Attempts: ${providerErrors.join(' | ')}`);
    }

    const aiResponseText = callResult.text;
    console.log('Raw AI Response:', aiResponseText);

    // Parse AI response with enhanced error handling
    const parsedResponse = parseAIResponse(aiResponseText);

    const providerMeta = {
      provider: callResult.provider,
      version: callResult.version,
      api_model: callResult.apiModel,
      response_time_ms: callResult.responseTime,
      total_tokens: callResult.usage?.totalTokens ?? null,
      prompt_tokens: callResult.usage?.promptTokens ?? null,
      completion_tokens: callResult.usage?.completionTokens ?? null,
    };

    // Calculate cost for this agent run
    const agentCostUsd = calculateAgentCost(
      providerMeta.provider,
      providerMeta.api_model,
      providerMeta.prompt_tokens ?? 0,
      providerMeta.completion_tokens ?? 0
    );

    const runOutput = {
      provider_meta: providerMeta,
      knowledge_context: knowledgeContext || null,
      memory_context: memoryContext || null,
      result: parsedResponse,
      raw_response: aiResponseText,
      executed_at: new Date().toISOString(),
    };

    // Create agent run record - include provider metadata in ai_summary
    const aiSummaryWithMeta = {
      ...parsedResponse,
      _meta: {
        provider: providerMeta.provider,
        model: providerMeta.api_model,
        response_time_ms: providerMeta.response_time_ms,
        total_tokens: providerMeta.total_tokens,
        prompt_tokens: providerMeta.prompt_tokens,
        completion_tokens: providerMeta.completion_tokens,
        cost_usd: agentCostUsd,
        brand_context_used: {
          has_knowledge: !!brandKnowledgeContext,
          has_analytics: !!brandAnalyticsContext,
          has_kpis: !!brandKPIsContext,
          has_info: !!brandInfoContext,
          knowledge_snippets: brandKnowledgeStats?.snippetCount ?? 0,
          knowledge_files: brandKnowledgeStats?.fileCount ?? 0,
          knowledge_chars: brandKnowledgeStats?.charCount ?? 0,
          used_embeddings: brandKnowledgeStats?.usedEmbeddings ?? false,
          used_file_summaries: brandKnowledgeStats?.usedFileSummaries ?? false,
          analytics_chars: brandAnalyticsContext?.length ?? 0,
          kpis_chars: brandKPIsContext?.length ?? 0,
        },
        warnings: [
          ...(brandId && !brandKnowledgeContext ? ['No brand knowledge base content found - analysis based on analytics and KPIs only'] : []),
          ...(brandId && !brandAnalyticsContext ? ['No analytics data found for this brand'] : []),
          ...(brandId && !brandKPIsContext ? ['No KPIs configured for this brand'] : []),
          ...(brandKnowledgeStats?.usedFileSummaries ? ['Using file summaries instead of indexed embeddings - consider re-indexing knowledge base'] : []),
        ].filter(Boolean),
        executed_at: new Date().toISOString(),
      }
    };

    const { data: agentRun, error: runError } = await client
      .from('ai_agent_runs')
      .insert({
        agent_id,
        executed_by: userId,
        execution_context,
        ai_summary: aiSummaryWithMeta,
        generated_tasks: parsedResponse.action_items || [],
        status: 'completed',
        title: `${agent.name} - ${brandName || brandData?.name || new Date().toISOString().split('T')[0]}`,
        category: agent.category,
        business_context: brandId ? `Brand: ${brandName || brandData?.name}` : null,
        cost_usd: agentCostUsd,
        total_tokens: providerMeta.total_tokens,
        prompt_tokens: providerMeta.prompt_tokens,
        completion_tokens: providerMeta.completion_tokens,
        model_provider: providerMeta.provider,
        model_version: providerMeta.api_model,
        execution_time_ms: providerMeta.response_time_ms,
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating agent run:', runError);
      throw runError;
    }

    console.log('Agent run completed successfully:', agentRun.id);

    return new Response(JSON.stringify({
      success: true,
      run_id: agentRun.id,
      summary: parsedResponse.summary,
      tasks_created: parsedResponse.action_items?.length || 0,
      provider_meta: providerMeta,
      data_sources_used: {
        knowledge_base: !!brandKnowledgeContext,
        analytics: !!brandAnalyticsContext,
        kpis: !!brandKPIsContext,
        brand_info: !!brandInfoContext,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in run-ai-agent function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});