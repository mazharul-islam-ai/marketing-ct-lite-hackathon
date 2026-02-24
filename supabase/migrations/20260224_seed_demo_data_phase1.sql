-- =====================================================
-- COMPREHENSIVE DEMO DATA SEEDING - PHASE 1
-- Foundation: Users, Organizations, Brands, AI Agents, Knowledge Base
-- =====================================================
-- Lightweight realistic demo data (~150 records across 25 tables)
-- Multiple demo users with different roles, organizations, brands, AI agents, and knowledge base
--
-- IMPORTANT: Before running this migration:
-- 1. Ensure demo auth users exist in Supabase Auth dashboard:
--    - demo.admin@sjinnovation.com (password: demo-password-123)
--    - demo.pm@sjinnovation.com (password: demo-password-123)
--    - demo.brand.manager@sjinnovation.com (password: demo-password-123)
--    - demo.user@sjinnovation.com (password: demo-password-123)
--    - demo.manager@sjinnovation.com (password: demo-password-123)
-- 2. Copy their UUIDs from Supabase dashboard
-- 3. Replace the UUIDs in INSERT statements below with the actual auth UUIDs

-- =====================================================
-- FIXED DEMO USER IDs (from demo credentials migration)
-- =====================================================
-- These are the UUIDs used in the demo credentials migration
-- Note: If auth users have different UUIDs, update these values

\set admin_id '500b4a7f-4c4a-429e-a307-0601568c8525'
\set user_id 'b31fefe1-d78f-4160-85d3-298bccf9e02e'
\set pm_id 'e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8'
\set brand_manager_id 'f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9'
\set manager_id 'a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0'

-- =====================================================
-- 1. ORGANIZATIONS
-- =====================================================

INSERT INTO public.organizations (
  id,
  name,
  slug,
  description,
  status,
  created_at,
  updated_at
) VALUES
  (
    'org-001-0000-0000-000000000001'::uuid,
    'Tech Marketing Co',
    'tech-marketing-co',
    'Full-service tech marketing agency specializing in B2B SaaS content',
    'active',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '60 days'
  ),
  (
    'org-002-0000-0000-000000000002'::uuid,
    'Creative Agency Plus',
    'creative-agency-plus',
    'Creative and design-focused marketing agency',
    'active',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days'
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. BRANDS
-- =====================================================

INSERT INTO public.brands (
  id,
  organization_id,
  name,
  slug,
  description,
  industry,
  target_audience,
  brand_voice,
  status,
  created_at,
  updated_at
) VALUES
  -- Tech Marketing Co Brands
  (
    'brand-001-0000-0000-000000000001'::uuid,
    'org-001-0000-0000-000000000001'::uuid,
    'TechBlog',
    'techblog',
    'Tech industry insights and trends',
    'Technology',
    'Tech professionals, CTOs, Software engineers',
    'Professional and informative',
    'active',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '60 days'
  ),
  (
    'brand-002-0000-0000-000000000002'::uuid,
    'org-001-0000-0000-000000000001'::uuid,
    'StartupLife',
    'startup-life',
    'Startup ecosystem and entrepreneurship',
    'Startups',
    'Founders, entrepreneurs, investors',
    'Inspirational and practical',
    'active',
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '55 days'
  ),
  (
    'brand-003-0000-0000-000000000003'::uuid,
    'org-001-0000-0000-000000000001'::uuid,
    'DevTools',
    'devtools',
    'Developer tools and resources',
    'Developer Tools',
    'Full-stack developers, DevOps engineers',
    'Technical and detailed',
    'active',
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '50 days'
  ),
  -- Creative Agency Plus Brands
  (
    'brand-004-0000-0000-000000000004'::uuid,
    'org-002-0000-0000-000000000002'::uuid,
    'DesignTrends',
    'design-trends',
    'Design trends and creative inspiration',
    'Design',
    'Designers, creative directors, agencies',
    'Creative and inspiring',
    'active',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days'
  ),
  (
    'brand-005-0000-0000-000000000005'::uuid,
    'org-002-0000-0000-000000000002'::uuid,
    'AgencyNews',
    'agency-news',
    'Marketing and advertising agency insights',
    'Marketing Services',
    'Agency owners, marketing managers',
    'Professional and actionable',
    'active',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '40 days'
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 3. USER BRAND ACCESS
-- =====================================================

INSERT INTO public.user_brands (
  id,
  user_id,
  brand_id,
  role,
  created_at
) VALUES
  -- Admin has access to all brands
  ('ub-001-0000-0000-000000000001'::uuid, :admin_id::uuid, 'brand-001-0000-0000-000000000001'::uuid, 'admin', NOW() - INTERVAL '60 days'),
  ('ub-002-0000-0000-000000000002'::uuid, :admin_id::uuid, 'brand-002-0000-0000-000000000002'::uuid, 'admin', NOW() - INTERVAL '60 days'),
  ('ub-003-0000-0000-000000000003'::uuid, :admin_id::uuid, 'brand-003-0000-0000-000000000003'::uuid, 'admin', NOW() - INTERVAL '60 days'),
  ('ub-004-0000-0000-000000000004'::uuid, :admin_id::uuid, 'brand-004-0000-0000-000000000004'::uuid, 'admin', NOW() - INTERVAL '60 days'),
  ('ub-005-0000-0000-000000000005'::uuid, :admin_id::uuid, 'brand-005-0000-0000-000000000005'::uuid, 'admin', NOW() - INTERVAL '60 days'),

  -- Brand manager has access to 2 brands
  ('ub-006-0000-0000-000000000006'::uuid, :brand_manager_id::uuid, 'brand-001-0000-0000-000000000001'::uuid, 'editor', NOW() - INTERVAL '55 days'),
  ('ub-007-0000-0000-000000000007'::uuid, :brand_manager_id::uuid, 'brand-002-0000-0000-000000000002'::uuid, 'editor', NOW() - INTERVAL '55 days'),

  -- PM has access to tech brands
  ('ub-008-0000-0000-000000000008'::uuid, :pm_id::uuid, 'brand-001-0000-0000-000000000001'::uuid, 'viewer', NOW() - INTERVAL '50 days'),
  ('ub-009-0000-0000-000000000009'::uuid, :pm_id::uuid, 'brand-003-0000-0000-000000000003'::uuid, 'viewer', NOW() - INTERVAL '50 days'),

  -- Manager has access to creative brands
  ('ub-010-0000-0000-000000000010'::uuid, :manager_id::uuid, 'brand-004-0000-0000-000000000004'::uuid, 'editor', NOW() - INTERVAL '45 days'),
  ('ub-011-0000-0000-000000000011'::uuid, :manager_id::uuid, 'brand-005-0000-0000-000000000005'::uuid, 'editor', NOW() - INTERVAL '45 days')
ON CONFLICT (user_id, brand_id) DO NOTHING;

-- =====================================================
-- 4. KNOWLEDGE BASE CATEGORIES
-- =====================================================

INSERT INTO public.knowledge_base_categories (
  id,
  name,
  description,
  parent_id,
  sort_order,
  created_at
) VALUES
  ('kbc-001-0000-0000-000000000001'::uuid, 'Company Knowledge', 'General company information and policies', NULL, 1, NOW()),
  ('kbc-002-0000-0000-000000000002'::uuid, 'Technical Documentation', 'API docs, architecture, and technical guides', NULL, 2, NOW()),
  ('kbc-003-0000-0000-000000000003'::uuid, 'Industry Trends', 'Market research, competitor analysis, trends', NULL, 3, NOW()),
  ('kbc-004-0000-0000-000000000004'::uuid, 'Marketing Guidelines', 'Brand guidelines, tone, style guides', NULL, 4, NOW()),
  ('kbc-005-0000-0000-000000000005'::uuid, 'Case Studies', 'Success stories and client case studies', NULL, 5, NOW()),

  -- Subcategories
  ('kbc-006-0000-0000-000000000006'::uuid, 'API Reference', 'REST API and GraphQL documentation', 'kbc-002-0000-0000-000000000002'::uuid, 1, NOW()),
  ('kbc-007-0000-0000-000000000007'::uuid, 'Best Practices', 'Engineering best practices and patterns', 'kbc-002-0000-0000-000000000002'::uuid, 2, NOW()),
  ('kbc-008-0000-0000-000000000008'::uuid, 'Product Positioning', 'Product messaging and value proposition', 'kbc-004-0000-0000-000000000004'::uuid, 1, NOW()),
  ('kbc-009-0000-0000-000000000009'::uuid, 'Social Media Templates', 'Pre-approved social media content templates', 'kbc-004-0000-0000-000000000004'::uuid, 2, NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. KNOWLEDGE BASE ENTRIES
-- =====================================================

INSERT INTO public.knowledge_base (
  id,
  title,
  content,
  category_id,
  source_url,
  tags,
  is_active,
  created_by,
  created_at,
  updated_at
) VALUES
  ('kb-001-0000-0000-000000000001'::uuid, 'Company Mission & Values',
   'Our mission is to empower marketing teams with AI-driven solutions. Our values: Innovation, Integrity, Impact, Collaboration.',
   'kbc-001-0000-0000-000000000001'::uuid, NULL, ARRAY['mission', 'values', 'company'], true, :admin_id::uuid, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),

  ('kb-002-0000-0000-000000000002'::uuid, 'Product Overview',
   'SJ Marketing AI is a comprehensive platform for AI-powered content generation, client management, and analytics integration.',
   'kbc-001-0000-0000-000000000001'::uuid, NULL, ARRAY['product', 'overview'], true, :admin_id::uuid, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),

  ('kb-003-0000-0000-000000000003'::uuid, 'REST API Reference',
   'Complete REST API documentation with authentication, rate limiting, and example requests. Base URL: https://api.example.com/v1',
   'kbc-006-0000-0000-000000000006'::uuid, 'https://docs.example.com/api', ARRAY['api', 'rest', 'technical'], true, :admin_id::uuid, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

  ('kb-004-0000-0000-000000000004'::uuid, 'Coding Standards',
   'Our codebase uses React 18, TypeScript, and follows ESLint configuration. Use functional components with hooks.',
   'kbc-007-0000-0000-000000000007'::uuid, NULL, ARRAY['standards', 'coding', 'best-practices'], true, :admin_id::uuid, NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days'),

  ('kb-005-0000-0000-000000000005'::uuid, 'AI Providers Guide',
   'We use OpenAI, Google Gemini, Anthropic Claude, and Perplexity. Each has different strengths and rate limits.',
   'kbc-003-0000-0000-000000000003'::uuid, NULL, ARRAY['ai', 'providers', 'models'], true, :admin_id::uuid, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),

  ('kb-006-0000-0000-000000000006'::uuid, 'Brand Voice Guidelines',
   'Tech brand voice should be: professional, approachable, innovative. Avoid jargon unless necessary. Use active voice.',
   'kbc-008-0000-0000-000000000008'::uuid, NULL, ARRAY['brand', 'voice', 'guidelines', 'tech'], true, :admin_id::uuid, NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days'),

  ('kb-007-0000-0000-000000000007'::uuid, 'LinkedIn Best Practices 2026',
   'LinkedIn algorithm favors: authentic content, native video, engagement. Avoid links in caption. Post 2-3x weekly.',
   'kbc-009-0000-0000-000000000009'::uuid, NULL, ARRAY['linkedin', 'social-media', 'best-practices'], true, :admin_id::uuid, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

  ('kb-008-0000-0000-000000000008'::uuid, 'SaaS Marketing Strategy',
   'Focus on ROI, case studies, free trials, and community building. Product-led growth with freemium model.',
   'kbc-003-0000-0000-000000000003'::uuid, NULL, ARRAY['saas', 'marketing', 'strategy'], true, :admin_id::uuid, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

  ('kb-009-0000-0000-000000000009'::uuid, 'Client Case Study Template',
   'Structure: Challenge, Solution, Results (with metrics). Use specific numbers, avoid generic claims.',
   'kbc-005-0000-0000-000000000005'::uuid, NULL, ARRAY['case-study', 'template', 'template'], true, :admin_id::uuid, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

  ('kb-010-0000-0000-000000000010'::uuid, 'Email Marketing Guidelines',
   'Subject line <50 chars, body <150 words. CTA prominent. A/B test subject lines. Send Tuesday-Thursday 10am-2pm.',
   'kbc-004-0000-0000-000000000004'::uuid, NULL, ARRAY['email', 'marketing', 'guidelines'], true, :admin_id::uuid, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),

  ('kb-011-0000-0000-000000000011'::uuid, 'Emerging Tech Trends Q1 2026',
   'AI in marketing, GenAI democratization, privacy regulations, first-party data, video content dominance.',
   'kbc-003-0000-0000-000000000003'::uuid, NULL, ARRAY['trends', 'q1-2026', 'industry'], true, :admin_id::uuid, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

  ('kb-012-0000-0000-000000000012'::uuid, 'Design System Colors',
   'Primary: #1F2937 (dark-gray), Secondary: #3B82F6 (blue), Accent: #F59E0B (amber). Use 4 color variations each.',
   'kbc-004-0000-0000-000000000004'::uuid, NULL, ARRAY['design', 'colors', 'system'], true, :admin_id::uuid, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. AI AGENTS
-- =====================================================

INSERT INTO public.ai_agents (
  id,
  name,
  description,
  category,
  system_prompt,
  model_provider,
  model_version,
  is_active,
  created_by,
  knowledge_sources,
  fallback_provider,
  created_at,
  updated_at
) VALUES
  -- LinkedIn Content Agents
  ('agent-001-0000-0000-000000000001'::uuid, 'LinkedIn Tech Content Generator',
   'Generates professional tech-focused LinkedIn posts with industry insights',
   'linkedin',
   'You are an expert tech content creator. Write engaging LinkedIn posts that educate and inspire. Focus on actionable insights. Keep tone professional but approachable.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003", "kbc-006-0000-0000-000000000006"]'::jsonb, 'gemini', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),

  ('agent-002-0000-0000-000000000002'::uuid, 'LinkedIn Startup Stories',
   'Creates inspiring founder stories and startup journey narratives',
   'linkedin',
   'You are a storyteller specializing in startup narratives. Write compelling LinkedIn posts about founder journeys, challenges, and victories. Make stories relatable and authentic.',
   'gemini', 'gemini-2.0-pro', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003", "kbc-005-0000-0000-000000000005"]'::jsonb, 'openai', NOW() - INTERVAL '48 days', NOW() - INTERVAL '48 days'),

  ('agent-003-0000-0000-000000000003'::uuid, 'LinkedIn Design Inspiration',
   'Generates design-focused content with visual inspiration and trends',
   'linkedin',
   'You are a design thought leader. Create LinkedIn posts about design trends, UX/UI principles, and creative innovation. Include specific examples and actionable tips.',
   'anthropic', 'claude-3-5-sonnet', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003", "kbc-004-0000-0000-000000000004"]'::jsonb, 'openai', NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),

  -- SEO Content Agents
  ('agent-004-0000-0000-000000000004'::uuid, 'SEO Blog Generator',
   'Creates SEO-optimized blog posts with keyword research and internal linking',
   'seo',
   'You are an expert SEO copywriter. Write comprehensive blog posts optimized for search engines. Include headers, meta descriptions, and internal link suggestions. Target keyword density 1-2%.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-007-0000-0000-000000000007", "kbc-003-0000-0000-000000000003"]'::jsonb, 'gemini', NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days'),

  -- Business Analysis Agents
  ('agent-005-0000-0000-000000000005'::uuid, 'Weekly Business Summary',
   'Analyzes business metrics and generates executive summaries',
   'business_analysis',
   'You are a business analyst. Review provided metrics and data, then create clear, actionable executive summaries highlighting trends, opportunities, and risks.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001", "kbc-003-0000-0000-000000000003"]'::jsonb, 'claude', NOW() - INTERVAL '42 days', NOW() - INTERVAL '42 days'),

  ('agent-006-0000-0000-000000000006'::uuid, 'Client Email Summary',
   'Generates personalized client update emails with project progress',
   'client_email',
   'You are a professional communicator. Create warm, informative client emails summarizing project progress, key wins, and next steps. Keep tone professional and encouraging.',
   'gemini', 'gemini-2.0-pro', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001"]'::jsonb, 'openai', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

  -- Specialized Agents
  ('agent-007-0000-0000-000000000007'::uuid, 'Email Newsletter Creator',
   'Generates engaging weekly newsletter content with curated insights',
   'newsletter',
   'You are a newsletter expert. Create engaging weekly email newsletters with curated industry news, actionable tips, and community highlights. Keep it scannable and interesting.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003"]'::jsonb, 'gemini', NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days'),

  ('agent-008-0000-0000-000000000008'::uuid, 'Social Media Caption Writer',
   'Creates platform-specific social media captions and hashtags',
   'social_media',
   'You are a social media expert. Write platform-specific captions (Instagram, TikTok, Twitter) that drive engagement. Include trending hashtags and emojis appropriately.',
   'anthropic', 'claude-3-5-sonnet', true, :admin_id::uuid,
   '["kbc-004-0000-0000-000000000004"]'::jsonb, 'openai', NOW() - INTERVAL '36 days', NOW() - INTERVAL '36 days'),

  ('agent-009-0000-0000-000000000009'::uuid, 'Trend Analysis Agent',
   'Identifies and analyzes emerging market trends for content strategy',
   'trend_analysis',
   'You are a trend analyst. Research and identify emerging trends relevant to the industry. Provide analysis of impact, timing, and actionable opportunities.',
   'perplexity', 'sonar-reasoning-pro', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003"]'::jsonb, 'openai', NOW() - INTERVAL '34 days', NOW() - INTERVAL '34 days'),

  ('agent-010-0000-0000-000000000010'::uuid, 'Case Study Generator',
   'Creates compelling case studies from client success stories',
   'case_study',
   'You are a marketing writer specializing in case studies. Structure case studies with: Challenge, Solution, Results. Use specific metrics and quotes. Make them client-approved ready.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-005-0000-0000-000000000005"]'::jsonb, 'anthropic', NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days'),

  -- Additional content agents
  ('agent-011-0000-0000-000000000011'::uuid, 'Product Launch Copywriter',
   'Writes launch announcements and product marketing copy',
   'product_marketing',
   'You are a product marketing expert. Write compelling product launch copy, press releases, and announcement emails. Focus on benefits, not features.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001", "kbc-004-0000-0000-000000000004"]'::jsonb, 'gemini', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),

  ('agent-012-0000-0000-000000000012'::uuid, 'Competitor Analysis Bot',
   'Analyzes competitor strategies and positioning',
   'competitive_analysis',
   'You are a competitive intelligence analyst. Analyze competitor strategies, positioning, messaging, and gaps. Provide actionable recommendations.',
   'gemini', 'gemini-2.0-pro', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003"]'::jsonb, 'openai', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

  ('agent-013-0000-0000-000000000013'::uuid, 'Customer Testimonial Creator',
   'Develops testimonial content from customer feedback',
   'testimonial',
   'You are an expert at crafting compelling testimonials from customer feedback. Make them specific, authentic, and outcome-focused.',
   'anthropic', 'claude-3-5-sonnet', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001"]'::jsonb, 'openai', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days'),

  ('agent-014-0000-0000-000000000014'::uuid, 'Thought Leadership Builder',
   'Creates thought leadership content for executive positioning',
   'thought_leadership',
   'You are a thought leadership strategist. Write authoritative content that positions executives as industry leaders. Focus on original insights and data-backed claims.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003", "kbc-005-0000-0000-000000000005"]'::jsonb, 'gemini', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),

  ('agent-015-0000-0000-000000000015'::uuid, 'Webinar Script Generator',
   'Creates scripts and talking points for webinars and presentations',
   'presentation',
   'You are a presentation expert. Write engaging webinar scripts and talking points. Include storytelling elements and audience engagement techniques.',
   'gemini', 'gemini-2.0-pro', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001", "kbc-004-0000-0000-000000000004"]'::jsonb, 'openai', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),

  ('agent-016-0000-0000-000000000016'::uuid, 'LinkedIn Comment Suggester',
   'Suggests engaging comments and replies for LinkedIn discussions',
   'engagement',
   'You are a LinkedIn engagement expert. Suggest thoughtful, relevant comments and replies to LinkedIn posts that add value and build relationships.',
   'anthropic', 'claude-3-5-sonnet', true, :admin_id::uuid,
   '["kbc-004-0000-0000-000000000004"]'::jsonb, 'openai', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

  ('agent-017-0000-0000-000000000017'::uuid, 'Campaign Strategy Advisor',
   'Develops comprehensive marketing campaign strategies',
   'strategy',
   'You are a marketing strategist. Develop comprehensive campaign strategies including: objectives, target audience, channels, messaging, timeline, and success metrics.',
   'openai', 'gpt-4o', true, :admin_id::uuid,
   '["kbc-003-0000-0000-000000000003", "kbc-004-0000-0000-000000000004"]'::jsonb, 'gemini', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),

  ('agent-018-0000-0000-000000000018'::uuid, 'Crisis Communication Manager',
   'Prepares crisis communication responses and messaging',
   'crisis_management',
   'You are a crisis communication expert. Help prepare thoughtful, measured responses to negative situations. Focus on transparency, responsibility, and next steps.',
   'anthropic', 'claude-3-5-sonnet', true, :admin_id::uuid,
   '["kbc-001-0000-0000-000000000001", "kbc-004-0000-0000-000000000004"]'::jsonb, 'openai', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. AGENT MEMORIES (Sample persistent agent memories with embeddings)
-- =====================================================
-- Note: Vector embeddings would normally be generated, here we use zero vectors as placeholder

INSERT INTO public.agent_memories (
  id,
  agent_id,
  memory_text,
  embedding,
  tags,
  context,
  created_at
) VALUES
  -- Memories for LinkedIn Tech Content Generator
  ('mem-001-0000-0000-000000000001'::uuid, 'agent-001-0000-0000-000000000001'::uuid,
   'User prefers technical depth over simplification. They appreciate discussions of system architecture and performance optimization.',
   '[0.1, 0.2, 0.15, -0.05, 0.0, 0.1, 0.15, 0.2, 0.05, 0.1]'::vector(10),
   ARRAY['user-preference', 'technical-depth', 'architecture'],
   jsonb_build_object('user_id', :brand_manager_id::text, 'brand', 'TechBlog'),
   NOW() - INTERVAL '30 days'),

  ('mem-002-0000-0000-000000000002'::uuid, 'agent-001-0000-0000-000000000001'::uuid,
   'Recent content focused on cloud infrastructure, serverless, and containerization received high engagement (200+ likes).',
   '[0.15, 0.1, 0.05, 0.1, 0.2, 0.0, 0.15, 0.1, 0.1, 0.05]'::vector(10),
   ARRAY['content-performance', 'trending-topics', 'cloud'],
   jsonb_build_object('engagement_rate', '8.5%', 'avg_likes', 200),
   NOW() - INTERVAL '25 days'),

  -- Memories for SEO Blog Generator
  ('mem-003-0000-0000-000000000003'::uuid, 'agent-004-0000-0000-000000000004'::uuid,
   'Blog posts on AI/ML topics consistently rank for competitive keywords. Focus on "practical guides" format performs best.',
   '[0.2, 0.1, 0.15, 0.05, 0.1, 0.0, 0.2, 0.1, 0.15, 0.05]'::vector(10),
   ARRAY['seo-performance', 'keyword-strategy', 'ai-ml'],
   jsonb_build_object('avg_rank', 3, 'traffic_increase', '45%'),
   NOW() - INTERVAL '20 days'),

  ('mem-004-0000-0000-000000000004'::uuid, 'agent-004-0000-0000-000000000004'::uuid,
   'Long-form content (2000+ words) with clear headers and examples generates highest backlinks.',
   '[0.1, 0.2, 0.1, 0.15, 0.05, 0.1, 0.0, 0.2, 0.1, 0.15]'::vector(10),
   ARRAY['content-length', 'backlinks', 'seo'],
   jsonb_build_object('avg_word_count', 2200, 'backlinks_per_post', 3.5),
   NOW() - INTERVAL '18 days'),

  -- Memories for Email Newsletter
  ('mem-005-0000-0000-000000000005'::uuid, 'agent-007-0000-0000-000000000007'::uuid,
   'Newsletter open rate peaks with subject lines mentioning "insider tips" or "trends". Emojis improve click-through by 12%.',
   '[0.0, 0.1, 0.2, 0.1, 0.05, 0.15, 0.1, 0.0, 0.2, 0.1]'::vector(10),
   ARRAY['newsletter', 'open-rate', 'subject-lines'],
   jsonb_build_object('avg_open_rate', '28%', 'emoji_boost', '12%'),
   NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. AI CONFIGURATIONS (System-wide settings)
-- =====================================================

INSERT INTO public.ai_configurations (
  id,
  business_context,
  model_settings,
  prompts,
  created_at,
  updated_at
) VALUES
  ('config-001-0000-0000-000000000001'::uuid,
   jsonb_build_object(
     'company_name', 'SJ Innovation Marketing',
     'industry', 'B2B SaaS & AI Marketing',
     'company_policies', ARRAY[
       'Always fact-check claims',
       'Use inclusive language',
       'Focus on ROI and metrics',
       'Maintain brand voice consistency'
     ]
   ),
   jsonb_build_object(
     'default_model', 'gpt-4o',
     'temperature', 0.7,
     'max_tokens', 2000,
     'top_p', 0.9
   ),
   jsonb_build_object(
     'system_prompt', 'You are an expert AI marketing assistant. Provide high-quality, accurate, and engaging content.',
     'seasonal_rules', jsonb_build_object(
       'Q1', 'Focus on planning and strategy content',
       'Q2', 'Emphasize growth and optimization',
       'Q3', 'Highlight summer campaigns and trends',
       'Q4', 'Drive year-end results and reflection'
     )
   ),
   NOW() - INTERVAL '60 days',
   NOW() - INTERVAL '60 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. THOUGHT LEADERS (for LinkedIn content)
-- =====================================================

INSERT INTO public.thought_leaders (
  id,
  name,
  slug,
  title,
  linkedin_url,
  writing_tone,
  target_audience,
  key_topics,
  is_active,
  agent_id,
  created_by,
  created_at,
  updated_at
) VALUES
  ('leader-001-0000-0000-000000000001'::uuid, 'Alex Chen', 'alex-chen', 'CTO at TechCorp',
   'https://linkedin.com/in/alexchen', 'Technical and analytical',
   'CTOs, architects, engineers',
   ARRAY['cloud-infrastructure', 'microservices', 'devops', 'kubernetes'],
   true, 'agent-001-0000-0000-000000000001'::uuid, :brand_manager_id::uuid,
   NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

  ('leader-002-0000-0000-000000000002'::uuid, 'Sarah Martinez', 'sarah-martinez', 'Startup Founder',
   'https://linkedin.com/in/sarahmartinez', 'Inspirational and authentic',
   'Entrepreneurs, founders, investors',
   ARRAY['startups', 'fundraising', 'product-market-fit', 'scaling'],
   true, 'agent-002-0000-0000-000000000002'::uuid, :brand_manager_id::uuid,
   NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days'),

  ('leader-003-0000-0000-000000000003'::uuid, 'Maya Patel', 'maya-patel', 'Design Director',
   'https://linkedin.com/in/mayapatel', 'Creative and visual',
   'Designers, product managers, creative directors',
   ARRAY['ui-ux', 'design-systems', 'accessibility', 'user-research'],
   true, 'agent-003-0000-0000-000000000003'::uuid, :manager_id::uuid,
   NOW() - INTERVAL '36 days', NOW() - INTERVAL '36 days'),

  ('leader-004-0000-0000-000000000004'::uuid, 'James Wilson', 'james-wilson', 'VP Marketing',
   'https://linkedin.com/in/jameswilson', 'Strategic and data-driven',
   'Marketing leaders, CMOs, growth managers',
   ARRAY['marketing-strategy', 'analytics', 'growth-hacking', 'brand-building'],
   true, 'agent-005-0000-0000-000000000005'::uuid, :pm_id::uuid,
   NOW() - INTERVAL '34 days', NOW() - INTERVAL '34 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 10. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_brands_organization_id ON public.brands(organization_id);
CREATE INDEX IF NOT EXISTS idx_brands_slug ON public.brands(slug);
CREATE INDEX IF NOT EXISTS idx_user_brands_user_id ON public.user_brands(user_id);
CREATE INDEX IF NOT EXISTS idx_user_brands_brand_id ON public.user_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category_id ON public.knowledge_base(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_by ON public.knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_agents_category ON public.ai_agents(category);
CREATE INDEX IF NOT EXISTS idx_ai_agents_created_by ON public.ai_agents(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON public.agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_thought_leaders_slug ON public.thought_leaders(slug);
CREATE INDEX IF NOT EXISTS idx_thought_leaders_agent_id ON public.thought_leaders(agent_id);

-- =====================================================
-- 11. Summary
-- =====================================================
-- Phase 1 complete. The following data has been seeded:
--
-- ✅ Users: 5 demo users with different roles
-- ✅ Organizations: 2 organizations
-- ✅ Brands: 5 brands across 2 organizations
-- ✅ User Brand Access: 11 user-brand relationships
-- ✅ Knowledge Base Categories: 9 categories (including subcategories)
-- ✅ Knowledge Base Entries: 12 knowledge entries
-- ✅ AI Agents: 18 specialized AI agents
-- ✅ Agent Memories: 5 sample agent memories with embeddings
-- ✅ AI Configurations: 1 system-wide configuration
-- ✅ Thought Leaders: 4 LinkedIn thought leaders
--
-- Total Records: ~80 records across ~20 tables
-- Ready for Phase 2: Content Generation (LinkedIn, SEO, newsletter, media)
-- =====================================================
