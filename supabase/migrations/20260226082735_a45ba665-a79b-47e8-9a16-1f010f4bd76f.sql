
-- =====================================================
-- Fix demo seed SQL by seeding compatible data (v2)
-- Fixes prior error: CTE names aren't visible across statements.
-- =====================================================

-- =====================================================
-- Preconditions: demo users must exist in public.users
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.admin@sjinnovation.com') THEN
    RAISE EXCEPTION 'Missing row in public.users for demo.admin@sjinnovation.com';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.pm@sjinnovation.com') THEN
    RAISE EXCEPTION 'Missing row in public.users for demo.pm@sjinnovation.com';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.brand.manager@sjinnovation.com') THEN
    RAISE EXCEPTION 'Missing row in public.users for demo.brand.manager@sjinnovation.com';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.manager@sjinnovation.com') THEN
    RAISE EXCEPTION 'Missing row in public.users for demo.manager@sjinnovation.com';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.user@sjinnovation.com') THEN
    RAISE EXCEPTION 'Missing row in public.users for demo.user@sjinnovation.com';
  END IF;
END $$;

-- =====================================================
-- 1) BRANDS + USER_BRANDS
-- =====================================================
WITH brand_seed AS (
  SELECT * FROM (VALUES
    ('techblog',      'TechBlog',      'Tech industry insights and trends',         60),
    ('startup-life',  'StartupLife',   'Startup ecosystem and entrepreneurship',   55),
    ('devtools',      'DevTools',      'Developer tools and resources',            50),
    ('design-trends', 'DesignTrends',  'Design trends and creative inspiration',   45),
    ('agency-news',   'AgencyNews',    'Marketing and advertising agency insights',40)
  ) AS v(slug, name, description, days_ago)
),
upsert_brands AS (
  INSERT INTO public.brands (
    name,
    slug,
    description,
    is_active,
    created_by,
    created_at,
    updated_at
  )
  SELECT
    s.name,
    s.slug,
    s.description,
    true,
    (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
    NOW() - (s.days_ago || ' days')::interval,
    NOW() - (s.days_ago || ' days')::interval
  FROM brand_seed s
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id, slug
)
INSERT INTO public.user_brands (user_id, brand_id, created_at)
SELECT
  u.user_id,
  b.id,
  NOW() - INTERVAL '60 days'
FROM (
  SELECT (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com') AS user_id, 'techblog'      AS slug
  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'startup-life'
  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'devtools'
  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'design-trends'
  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'agency-news'

  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.user@sjinnovation.com'), 'techblog'
  UNION ALL SELECT (SELECT id FROM public.users WHERE email='demo.user@sjinnovation.com'), 'startup-life'
) u
JOIN upsert_brands b ON b.slug = u.slug
ON CONFLICT (user_id, brand_id) DO NOTHING;

-- =====================================================
-- 2) CONTENT
-- =====================================================

INSERT INTO public.generated_posts (
  id,
  leader_id,
  post_title,
  post_body,
  source_type,
  source_id,
  agent_id,
  generated_by,
  model_used,
  created_at
) VALUES
  ('10050001-0000-0000-0000-000000000001'::uuid, NULL, 'Kubernetes at Scale: Lessons from the Trenches',
   'After managing 500+ Kubernetes clusters in production, the #1 lesson: start with observability first. Resource limits aren''t suggestions—they''re survival.',
   'custom', NULL, NULL,
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   'gpt-4o', NOW() - INTERVAL '35 days'),

  ('10050002-0000-0000-0000-000000000002'::uuid, NULL, 'Why Your Microservices Architecture is Burning Money',
   'Most microservices architectures are premature optimization. We split a monolith into 47 services—costs tripled and latency increased.',
   'custom', NULL, NULL,
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   'gpt-4o', NOW() - INTERVAL '33 days'),

  ('10050003-0000-0000-0000-000000000003'::uuid, NULL, 'Founder Burnout Is Real',
   'Burnout doesn''t make you stronger—it makes you worse at your job. Build systems that let you recover before you break.',
   'custom', NULL, NULL,
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   'gpt-4o', NOW() - INTERVAL '19 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_generated_images (
  id,
  prompt,
  image_url,
  model,
  brand_id,
  generated_by,
  created_at
) VALUES
  ('a1000001-0000-0000-0000-000000000001'::uuid,
   'Professional headshot of a tech entrepreneur, modern office background, warm lighting',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024',
   'dall-e-3',
   (SELECT id FROM public.brands WHERE slug='techblog'),
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sora_videos (
  id,
  prompt,
  video_url,
  status,
  brand_id,
  generated_by,
  created_at
) VALUES
  ('c1de0001-0000-0000-0000-000000000001'::uuid,
   'Timelapse of a startup office from empty to bustling with activity, modern aesthetic',
   'https://example.com/videos/startup-timelapse.mp4',
   'completed',
   (SELECT id FROM public.brands WHERE slug='startup-life'),
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.content_performance_metrics (
  id,
  content_id,
  content_type,
  views,
  clicks,
  conversions,
  engagement_rate,
  brand_id,
  recorded_at
) VALUES
  ('be0f0001-0000-0000-0000-000000000001'::uuid,
   '10050001-0000-0000-0000-000000000001'::uuid,
   'linkedin_post',
   2450, 180, 3, 0.073,
   (SELECT id FROM public.brands WHERE slug='techblog'),
   NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3) CLIENTS + PROJECTS + TASKS + COMMENTS + WEEKLY SUMMARY
-- =====================================================

WITH client_seed AS (
  SELECT * FROM (VALUES
    ('acme-tech',            'Acme Tech Solutions',        'contact@acmetech.com',          '+1-555-0101', 'Acme Tech Solutions',        'Software Development', 'active', 90),
    ('cloudfirst',           'CloudFirst Inc',             'info@cloudfirst.io',            '+1-555-0102', 'CloudFirst Inc',             'Cloud Services',       'active', 85),
    ('datadriven-analytics', 'DataDriven Analytics',       'hello@datadrivenanalytics.com', '+1-555-0103', 'DataDriven Analytics',       'Analytics',            'active', 80)
  ) AS v(slug, name, email, phone, company, industry, status, days_ago)
),
upsert_clients AS (
  INSERT INTO public.clients (
    name, slug, email, phone, company, industry, status, metadata, created_at, updated_at
  )
  SELECT
    s.name,
    s.slug,
    s.email,
    s.phone,
    s.company,
    s.industry,
    s.status,
    jsonb_build_object('contract_value', CASE s.slug
      WHEN 'acme-tech' THEN 150000
      WHEN 'cloudfirst' THEN 200000
      ELSE 125000
    END),
    NOW() - (s.days_ago || ' days')::interval,
    NOW() - (s.days_ago || ' days')::interval
  FROM client_seed s
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company,
    industry = EXCLUDED.industry,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id, slug
),
project_seed AS (
  SELECT * FROM (VALUES
    ('acme-q1-campaign', 'Q1 Marketing Campaign', 'Comprehensive Q1 2026 marketing campaign', 'acme-tech', 60),
    ('cloudfirst-content', 'Content Marketing Program', 'Ongoing content marketing and thought leadership program', 'cloudfirst', 40)
  ) AS v(slug, name, description, client_slug, days_ago)
),
upsert_projects AS (
  INSERT INTO public.projects (
    name, slug, description, client_id, status, start_date, end_date, project_manager_id, metadata, created_at, updated_at
  )
  SELECT
    p.name,
    p.slug,
    p.description,
    c.id,
    'active',
    (NOW() - (p.days_ago || ' days')::interval)::date,
    (NOW() + INTERVAL '60 days')::date,
    (SELECT id FROM public.users WHERE email='demo.pm@sjinnovation.com'),
    jsonb_build_object('budget', CASE p.slug WHEN 'acme-q1-campaign' THEN 75000 ELSE 120000 END),
    NOW() - (p.days_ago || ' days')::interval,
    NOW() - (p.days_ago || ' days')::interval
  FROM project_seed p
  JOIN upsert_clients c ON c.slug = p.client_slug
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    client_id = EXCLUDED.client_id,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    project_manager_id = EXCLUDED.project_manager_id,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id, slug
)
INSERT INTO public.project_tasks (
  id, project_id, title, description, status, priority, assigned_to, due_date, created_at, updated_at
)
SELECT
  t.id,
  p.id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.assigned_to,
  t.due_date,
  t.created_at,
  t.updated_at
FROM (
  SELECT
    'da500001-0000-0000-0000-000000000001'::uuid AS id,
    'acme-q1-campaign' AS project_slug,
    'Content calendar planning' AS title,
    'Plan 60 pieces of content for Q1' AS description,
    'completed' AS status,
    'high' AS priority,
    (SELECT id FROM public.users WHERE email='demo.brand.manager@sjinnovation.com') AS assigned_to,
    (NOW() + INTERVAL '7 days')::date AS due_date,
    NOW() - INTERVAL '55 days' AS created_at,
    NOW() - INTERVAL '50 days' AS updated_at

  UNION ALL

  SELECT
    'da500002-0000-0000-0000-000000000002'::uuid,
    'acme-q1-campaign',
    'LinkedIn content creation',
    'Write 20 LinkedIn posts with AI assistance',
    'in_progress',
    'high',
    (SELECT id FROM public.users WHERE email='demo.brand.manager@sjinnovation.com'),
    (NOW() + INTERVAL '14 days')::date,
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '10 days'
) t
JOIN upsert_projects p ON p.slug = t.project_slug
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_task_comments (id, task_id, comment, created_by, created_at) VALUES
  ('c0ee0001-0000-0000-0000-000000000001'::uuid, 'da500002-0000-0000-0000-000000000002'::uuid,
   'Great start—please include more customer stories in the LinkedIn set.',
   (SELECT id FROM public.users WHERE email='demo.pm@sjinnovation.com'),
   NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.weekly_client_summary (id, client_id, summary_text, week_start, week_end, generated_by, created_at) VALUES
  (
    'ec500001-0000-0000-0000-000000000001'::uuid,
    (SELECT id FROM public.clients WHERE slug='acme-tech'),
    'Q1 campaign progressing well. Content calendar finalized. LinkedIn drafts in progress.',
    (NOW() - INTERVAL '7 days')::date,
    NOW()::date,
    (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
    NOW() - INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4) CONTROL TOWER + HACKATHON
-- =====================================================

INSERT INTO public.employees (id, employee_id, first_name, last_name, email, job_title, department, is_active, created_at, updated_at) VALUES
  ('e0000001-0000-0000-0000-000000000001'::uuid, 'EMP-001', 'Demo', 'Admin', 'demo.admin@sjinnovation.com', 'Super Admin', 'Leadership', true, NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
  ('e0000002-0000-0000-0000-000000000002'::uuid, 'EMP-002', 'Demo', 'PM', 'demo.pm@sjinnovation.com', 'Project Manager', 'Strategy', true, NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days'),
  ('e0000003-0000-0000-0000-000000000003'::uuid, 'EMP-003', 'Demo', 'Brand Manager', 'demo.brand.manager@sjinnovation.com', 'Brand Manager', 'Content', true, NOW() - INTERVAL '95 days', NOW() - INTERVAL '95 days'),
  ('e0000004-0000-0000-0000-000000000004'::uuid, 'EMP-004', 'Demo', 'Manager', 'demo.manager@sjinnovation.com', 'Manager', 'Operations', true, NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
  ('e0000005-0000-0000-0000-000000000005'::uuid, 'EMP-005', 'Demo', 'User', 'demo.user@sjinnovation.com', 'Coordinator', 'Content', true, NOW() - INTERVAL '85 days', NOW() - INTERVAL '85 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pods (id, pod_name, description, pod_lead_id, is_active, created_at) VALUES
  ('d0d00001-0000-0000-0000-000000000001'::uuid, 'Strategy & Planning', 'Strategic initiatives and annual planning', 'e0000002-0000-0000-0000-000000000002'::uuid, true, NOW() - INTERVAL '90 days'),
  ('d0d00002-0000-0000-0000-000000000002'::uuid, 'Content Creation', 'Content production and creative team', 'e0000003-0000-0000-0000-000000000003'::uuid, true, NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pod_members (id, pod_id, employee_id, role, joined_at) VALUES
  ('b0de0001-0000-0000-0000-000000000001'::uuid, 'd0d00001-0000-0000-0000-000000000001'::uuid, 'e0000002-0000-0000-0000-000000000002'::uuid, 'Lead', NOW() - INTERVAL '90 days'),
  ('b0de0002-0000-0000-0000-000000000002'::uuid, 'd0d00002-0000-0000-0000-000000000002'::uuid, 'e0000003-0000-0000-0000-000000000003'::uuid, 'Lead', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hackathon_events (id, name, description, start_date, end_date, status, max_team_size, min_team_size, created_by, created_at) VALUES
  ('ac100001-0000-0000-0000-000000000001'::uuid, 'SJ Innovation Hackathon 2026', 'Internal hackathon for innovation and learning',
   '2026-03-15T09:00:00Z'::timestamptz, '2026-03-17T18:00:00Z'::timestamptz,
   'active', 5, 2,
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'),
   NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hackathon_teams (id, event_id, team_name, project_description, team_lead_id, status, created_at) VALUES
  ('dea00001-0000-0000-0000-000000000001'::uuid, 'ac100001-0000-0000-0000-000000000001'::uuid, 'AI Content Automation', 'Building AI tools for automated content generation',
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'forming', NOW() - INTERVAL '25 days'),
  ('dea00002-0000-0000-0000-000000000002'::uuid, 'ac100001-0000-0000-0000-000000000001'::uuid, 'Analytics Dashboard', 'Real-time analytics dashboard for campaign metrics',
   (SELECT id FROM public.users WHERE email='demo.pm@sjinnovation.com'), 'forming', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hackathon_participants (id, event_id, team_id, user_id, status, skills, interests, registration_date) VALUES
  ('ba010001-0000-0000-0000-000000000001'::uuid, 'ac100001-0000-0000-0000-000000000001'::uuid, 'dea00001-0000-0000-0000-000000000001'::uuid,
   (SELECT id FROM public.users WHERE email='demo.admin@sjinnovation.com'), 'confirmed', ARRAY['AI','Content'], ARRAY['ML'], NOW() - INTERVAL '25 days'),
  ('ba010002-0000-0000-0000-000000000002'::uuid, 'ac100001-0000-0000-0000-000000000001'::uuid, 'dea00002-0000-0000-0000-000000000002'::uuid,
   (SELECT id FROM public.users WHERE email='demo.pm@sjinnovation.com'), 'confirmed', ARRAY['Strategy'], ARRAY['Product'], NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hackathon_submissions (id, team_id, submission_title, description, github_url, demo_url, status, is_finalized, submitted_at) VALUES
  ('50b00001-0000-0000-0000-000000000001'::uuid, 'dea00001-0000-0000-0000-000000000001'::uuid,
   'AI Content Studio', 'One-click AI content generation with brand compliance checking',
   'https://github.com/sjinnovation/ai-content-studio', 'https://demo.aistudio.sjinn.dev',
   'submitted', true, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;
