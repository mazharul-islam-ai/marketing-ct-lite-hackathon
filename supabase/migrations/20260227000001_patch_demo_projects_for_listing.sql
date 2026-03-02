-- =====================================================
-- DEMO DATA: PATCH EXISTING PROJECTS + ADD TASKS
-- Projects already exist in DB — just set activecollab_id
-- so they appear in the /projects listing.
-- Tasks inserted via slug subquery to match actual project IDs.
-- =====================================================

-- =====================================================
-- 1. SET activecollab_id ON ALL EXISTING PROJECTS
--    (this makes them visible in the /projects listing)
-- =====================================================

UPDATE public.projects SET activecollab_id = 10001 WHERE slug = 'acme-q1-campaign';
UPDATE public.projects SET activecollab_id = 10002 WHERE slug = 'cloudfirst-content';
UPDATE public.projects SET activecollab_id = 10003 WHERE slug = 'q1-2026-marketing';
UPDATE public.projects SET activecollab_id = 10004 WHERE slug = 'brand-refresh';
UPDATE public.projects SET activecollab_id = 10005 WHERE slug = 'social-media-strategy';
UPDATE public.projects SET activecollab_id = 10006 WHERE slug = 'website-redesign';
UPDATE public.projects SET activecollab_id = 10007 WHERE slug = 'content-marketing-program';

-- =====================================================
-- 2. INSERT TASKS — project_id resolved by slug subquery
--    Confirmed schema: id, project_id, title, description,
--    status, priority, assigned_to, actual_hours, due_date,
--    created_at, updated_at
-- =====================================================

-- ── Q1 Marketing Campaign (acme-q1-campaign) ─────────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000001'::uuid, p.id,
  'Content calendar planning', 'Plan 60 pieces of content for Q1 across all channels',
  'completed', 'high', 16, '2026-01-15', NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days'
FROM public.projects p WHERE p.slug = 'acme-q1-campaign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000002'::uuid, p.id,
  'LinkedIn content creation', 'Write 20 LinkedIn posts using brand voice guidelines',
  'in_progress', 'high', 48, '2026-02-28', NOW() - INTERVAL '50 days', NOW() - INTERVAL '10 days'
FROM public.projects p WHERE p.slug = 'acme-q1-campaign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000003'::uuid, p.id,
  'SEO blog production', 'Create 10 SEO-optimized blog posts targeting top buyer keywords',
  'in_progress', 'high', 22, '2026-03-15', NOW() - INTERVAL '45 days', NOW() - INTERVAL '5 days'
FROM public.projects p WHERE p.slug = 'acme-q1-campaign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000004'::uuid, p.id,
  'Video production', 'Create 3 product demo videos with professional voiceover',
  'todo', 'medium', 0, '2026-03-31', NOW() - INTERVAL '40 days', NOW()
FROM public.projects p WHERE p.slug = 'acme-q1-campaign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000005'::uuid, p.id,
  'Client review and approval', 'Present Q1 plan and first asset batch to client for sign-off',
  'review', 'urgent', 2, '2026-02-28', NOW() - INTERVAL '15 days', NOW() - INTERVAL '3 days'
FROM public.projects p WHERE p.slug = 'acme-q1-campaign'
ON CONFLICT (id) DO NOTHING;

-- ── Content Marketing Program (cloudfirst-content) ────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000006'::uuid, p.id,
  'January blog posts (4)', 'Create 4 SEO blogs covering cloud architecture trends',
  'completed', 'high', 20, '2026-01-31', NOW() - INTERVAL '50 days', NOW() - INTERVAL '30 days'
FROM public.projects p WHERE p.slug = 'cloudfirst-content'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000007'::uuid, p.id,
  'February blog posts (4)', 'Create 4 SEO blogs on DevOps and cloud-native topics',
  'in_progress', 'high', 10, '2026-02-28', NOW() - INTERVAL '25 days', NOW()
FROM public.projects p WHERE p.slug = 'cloudfirst-content'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000008'::uuid, p.id,
  'Whitepaper: Cloud-native transformation', 'Write 3000-word technical whitepaper on cloud architecture',
  'blocked', 'high', 0, '2026-03-31', NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days'
FROM public.projects p WHERE p.slug = 'cloudfirst-content'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000009'::uuid, p.id,
  'March content calendar', 'Plan and schedule all March content across channels',
  'todo', 'medium', 0, '2026-03-05', NOW() - INTERVAL '5 days', NOW()
FROM public.projects p WHERE p.slug = 'cloudfirst-content'
ON CONFLICT (id) DO NOTHING;

-- ── Q1 2026 Marketing Campaign (q1-2026-marketing) ────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000010'::uuid, p.id,
  'Campaign strategy doc', 'Define goals, KPIs, target audiences and channel mix',
  'completed', 'high', 12, '2026-01-10', NOW() - INTERVAL '48 days', NOW() - INTERVAL '40 days'
FROM public.projects p WHERE p.slug = 'q1-2026-marketing'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000011'::uuid, p.id,
  'Paid media setup', 'Configure Google Ads and LinkedIn campaign structures',
  'in_progress', 'high', 6, '2026-02-20', NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'
FROM public.projects p WHERE p.slug = 'q1-2026-marketing'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000012'::uuid, p.id,
  'Email nurture sequences', 'Build 3 automated email sequences for lead nurturing',
  'todo', 'medium', 0, '2026-03-10', NOW() - INTERVAL '20 days', NOW()
FROM public.projects p WHERE p.slug = 'q1-2026-marketing'
ON CONFLICT (id) DO NOTHING;

-- ── Brand Refresh (brand-refresh) ─────────────────────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000013'::uuid, p.id,
  'Logo design concepts', 'Create 3 logo design variations for client review',
  'completed', 'high', 24, '2026-02-15', NOW() - INTERVAL '35 days', NOW() - INTERVAL '25 days'
FROM public.projects p WHERE p.slug = 'brand-refresh'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000014'::uuid, p.id,
  'Brand guidelines document', 'Finalize guidelines covering logo, color, typography, and tone',
  'in_progress', 'high', 18, '2026-03-15', NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days'
FROM public.projects p WHERE p.slug = 'brand-refresh'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000015'::uuid, p.id,
  'Messaging framework', 'Develop core value propositions and competitive positioning',
  'in_progress', 'high', 8, '2026-03-31', NOW() - INTERVAL '28 days', NOW()
FROM public.projects p WHERE p.slug = 'brand-refresh'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000016'::uuid, p.id,
  'Client brand presentation', 'Facilitate client workshop for brand sign-off',
  'todo', 'medium', 0, '2026-04-10', NOW() - INTERVAL '10 days', NOW()
FROM public.projects p WHERE p.slug = 'brand-refresh'
ON CONFLICT (id) DO NOTHING;

-- ── Social Media Strategy (social-media-strategy) ─────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000017'::uuid, p.id,
  'Platform audit', 'Audit current social media presence across all channels',
  'completed', 'high', 8, '2026-02-05', NOW() - INTERVAL '40 days', NOW() - INTERVAL '30 days'
FROM public.projects p WHERE p.slug = 'social-media-strategy'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000018'::uuid, p.id,
  'Content pillar development', 'Define 5 content pillars and posting cadence per platform',
  'in_progress', 'high', 5, '2026-03-01', NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days'
FROM public.projects p WHERE p.slug = 'social-media-strategy'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000019'::uuid, p.id,
  'Influencer outreach list', 'Identify and qualify 20 micro-influencers for partnership',
  'todo', 'low', 0, '2026-03-20', NOW() - INTERVAL '10 days', NOW()
FROM public.projects p WHERE p.slug = 'social-media-strategy'
ON CONFLICT (id) DO NOTHING;

-- ── Website Redesign (website-redesign) ───────────────────
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000020'::uuid, p.id,
  'UX research and wireframes', 'Conduct user interviews and produce low-fi wireframes',
  'completed', 'high', 30, '2026-01-31', NOW() - INTERVAL '45 days', NOW() - INTERVAL '35 days'
FROM public.projects p WHERE p.slug = 'website-redesign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000021'::uuid, p.id,
  'Homepage copy and design', 'Write conversion-focused copy and produce final homepage design',
  'in_progress', 'high', 14, '2026-03-10', NOW() - INTERVAL '25 days', NOW() - INTERVAL '2 days'
FROM public.projects p WHERE p.slug = 'website-redesign'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000022'::uuid, p.id,
  'CMS migration', 'Migrate all existing content to new CMS structure',
  'todo', 'medium', 0, '2026-04-15', NOW() - INTERVAL '12 days', NOW()
FROM public.projects p WHERE p.slug = 'website-redesign'
ON CONFLICT (id) DO NOTHING;

-- ── Content Marketing Program (content-marketing-program) ──
INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000023'::uuid, p.id,
  'Keyword research', 'Build master keyword list for all content verticals',
  'completed', 'medium', 10, '2026-02-10', NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days'
FROM public.projects p WHERE p.slug = 'content-marketing-program'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_tasks
  (id, project_id, title, description, status, priority, actual_hours, due_date, created_at, updated_at)
SELECT '00000000-0000-0000-0002-000000000024'::uuid, p.id,
  'Editorial calendar Q2', 'Plan and assign all Q2 content across writers and designers',
  'in_progress', 'high', 4, '2026-03-07', NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day'
FROM public.projects p WHERE p.slug = 'content-marketing-program'
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Summary
-- =====================================================
-- ✅ 7 existing projects updated with activecollab_id (10001-10007)
-- ✅ 24 tasks inserted across all 7 projects
--    Statuses: completed, in_progress, review, todo, blocked
-- =====================================================
