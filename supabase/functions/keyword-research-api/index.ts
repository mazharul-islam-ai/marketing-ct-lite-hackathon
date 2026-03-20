import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestionResult {
  keyword: string;
  search_volume: number | null;
  competition: 'low' | 'medium' | 'high' | null;
  relevance_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'suggest_keywords':
        return await suggestKeywords(supabaseClient, user.id, params);
      
      case 'save_keyword':
        return await saveKeyword(supabaseClient, user.id, params);
      
      case 'get_keywords':
        return await getKeywords(supabaseClient, params);
      
      case 'update_keyword':
        return await updateKeyword(supabaseClient, params);
      
      case 'delete_keyword':
        return await deleteKeyword(supabaseClient, params);
      
      case 'track_blog_usage':
        return await trackBlogUsage(supabaseClient, params);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in keyword-research-api:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function suggestKeywords(supabase: any, userId: string, params: any) {
  const { brand_id, seed_keyword, count = 10 } = params;

  // Check cache first
  const { data: cached } = await supabase
    .from('keyword_suggestions')
    .select('suggestions')
    .eq('brand_id', brand_id)
    .eq('seed_keyword', seed_keyword)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    return new Response(JSON.stringify({ 
      suggestions: cached.suggestions,
      cached: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Call Lovable AI Gateway for suggestions
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prompt = `You are an SEO keyword research expert. Given the seed keyword "${seed_keyword}", suggest ${count} highly relevant related keywords that would be good for SEO content creation.

For each keyword, estimate:
1. Monthly search volume (number)
2. Competition level (low/medium/high)
3. Relevance score (0-100, how related to seed keyword)

Return ONLY a JSON array of objects with: keyword, search_volume, competition, relevance_score. No markdown, no explanations.`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'You are an SEO keyword research expert. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds to your workspace.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const errorText = await aiResponse.text();
    console.error('Lovable AI Gateway error:', aiResponse.status, errorText);
    return new Response(JSON.stringify({ error: 'Failed to get suggestions from AI' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices[0].message.content;
  
  // Parse JSON from response
  let suggestions: SuggestionResult[] = [];
  try {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    suggestions = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    return new Response(JSON.stringify({ error: 'Invalid response format from AI' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Cache the suggestions
  await supabase
    .from('keyword_suggestions')
    .insert({
      brand_id,
      user_id: userId,
      seed_keyword,
      suggestions,
      model_used: 'google/gemini-3-flash-preview',
      prompt_used: prompt,
    });

  return new Response(JSON.stringify({ 
    suggestions,
    cached: false 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function saveKeyword(supabase: any, userId: string, params: any) {
  const { 
    brand_id, 
    keyword, 
    search_volume, 
    competition, 
    difficulty_score,
    priority = 'medium',
    tags = [],
    notes 
  } = params;

  const { data, error } = await supabase
    .from('keyword_research')
    .insert({
      brand_id,
      user_id: userId,
      keyword,
      keyword_normalized: keyword.toLowerCase().trim(),
      search_volume,
      competition,
      difficulty_score,
      priority,
      tags,
      notes,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return new Response(JSON.stringify({ error: 'Keyword already exists for this brand' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }

  return new Response(JSON.stringify({ keyword: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getKeywords(supabase: any, params: any) {
  const { brand_id, status, priority } = params;

  let query = supabase
    .from('keyword_research')
    .select('*')
    .eq('brand_id', brand_id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);

  const { data, error } = await query;
  if (error) throw error;

  return new Response(JSON.stringify({ keywords: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateKeyword(supabase: any, params: any) {
  const { keyword_id, updates } = params;

  const { data, error } = await supabase
    .from('keyword_research')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', keyword_id)
    .select()
    .single();

  if (error) throw error;

  // If rank was updated, add to history
  if (updates.current_rank !== undefined) {
    await supabase
      .from('keyword_ranking_history')
      .insert({
        keyword_id,
        rank: updates.current_rank,
        search_volume: updates.search_volume,
      });
  }

  return new Response(JSON.stringify({ keyword: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function deleteKeyword(supabase: any, params: any) {
  const { keyword_id } = params;

  const { error } = await supabase
    .from('keyword_research')
    .delete()
    .eq('id', keyword_id);

  if (error) throw error;

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function trackBlogUsage(supabase: any, params: any) {
  const { keyword_id, blog_id, keyword_type } = params;

  // Link keyword to blog
  await supabase
    .from('keyword_blog_usage')
    .insert({
      keyword_id,
      blog_id,
      keyword_type,
    });

  // Update keyword usage stats
  const { data: keyword } = await supabase
    .from('keyword_research')
    .select('used_in_blog_count')
    .eq('id', keyword_id)
    .single();

  if (keyword) {
    await supabase
      .from('keyword_research')
      .update({
        used_in_blog_count: keyword.used_in_blog_count + 1,
        last_used_in_blog: new Date().toISOString(),
      })
      .eq('id', keyword_id);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
