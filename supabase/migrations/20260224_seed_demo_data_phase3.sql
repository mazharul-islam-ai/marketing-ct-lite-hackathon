-- =====================================================
-- COMPREHENSIVE DEMO DATA SEEDING - PHASE 3
-- Project & Client Management: Clients, Projects, Tasks, EOD, Summaries
-- =====================================================
-- Lightweight realistic demo data (~80 records)
-- Clients, projects, tasks, task assignments, EOD submissions
--
-- Prerequisites: Phases 1-2 must be completed
-- Users, brands, and agents created in earlier phases

-- =====================================================
-- DEMO USER IDs (from earlier phases)
-- =====================================================

\set admin_id '500b4a7f-4c4a-429e-a307-0601568c8525'
\set user_id 'b31fefe1-d78f-4160-85d3-298bccf9e02e'
\set pm_id 'e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8'
\set brand_manager_id 'f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9'
\set manager_id 'a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0'

-- =====================================================
-- 1. CLIENTS (10-15 clients)
-- =====================================================

INSERT INTO public.clients (
  id,
  name,
  slug,
  email,
  phone,
  company,
  industry,
  status,
  metadata,
  created_at,
  updated_at
) VALUES
  ('client-001-0000-0000-000000000001'::uuid, 'Acme Tech Solutions', 'acme-tech',
   'contact@acmetech.com', '+1-555-0101', 'Acme Tech Solutions', 'Software Development',
   'active', jsonb_build_object('contract_value', 150000, 'industry_focus', 'B2B SaaS'),
   NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),

  ('client-002-0000-0000-000000000002'::uuid, 'CloudFirst Inc', 'cloudfirst',
   'info@cloudfirst.io', '+1-555-0102', 'CloudFirst Inc', 'Cloud Services',
   'active', jsonb_build_object('contract_value', 200000, 'industry_focus', 'Infrastructure'),
   NOW() - INTERVAL '85 days', NOW() - INTERVAL '85 days'),

  ('client-003-0000-0000-000000000003'::uuid, 'DataDriven Analytics', 'datadriven-analytics',
   'hello@datadrivenanalytics.com', '+1-555-0103', 'DataDriven Analytics', 'Analytics',
   'active', jsonb_build_object('contract_value', 125000, 'industry_focus', 'Business Intelligence'),
   NOW() - INTERVAL '80 days', NOW() - INTERVAL '80 days'),

  ('client-004-0000-0000-000000000004'::uuid, 'SecureNet Systems', 'securenet',
   'partnership@securenet.com', '+1-555-0104', 'SecureNet Systems', 'Cybersecurity',
   'active', jsonb_build_object('contract_value', 180000, 'industry_focus', 'Enterprise Security'),
   NOW() - INTERVAL '75 days', NOW() - INTERVAL '75 days'),

  ('client-005-0000-0000-000000000005'::uuid, 'GrowthScale Marketing', 'growthscale',
   'contact@growthscale.co', '+1-555-0105', 'GrowthScale Marketing', 'Marketing Services',
   'active', jsonb_build_object('contract_value', 95000, 'industry_focus', 'Growth Marketing'),
   NOW() - INTERVAL '70 days', NOW() - INTERVAL '70 days'),

  ('client-006-0000-0000-000000000006'::uuid, 'InnovateLab Inc', 'innovatelab',
   'team@innovatelab.io', '+1-555-0106', 'InnovateLab Inc', 'Product Development',
   'active', jsonb_build_object('contract_value', 140000, 'industry_focus', 'Innovation Consulting'),
   NOW() - INTERVAL '65 days', NOW() - INTERVAL '65 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. PROJECTS (5-10 projects per client)
-- =====================================================

INSERT INTO public.projects (
  id,
  name,
  slug,
  description,
  client_id,
  status,
  start_date,
  end_date,
  project_manager,
  assigned_team,
  metadata,
  created_at,
  updated_at
) VALUES
  -- Acme Tech Projects
  ('project-001-0000-0000-000000000001'::uuid, 'Q1 Marketing Campaign', 'acme-q1-campaign',
   'Comprehensive Q1 2026 marketing campaign including content, ads, and email',
   'client-001-0000-0000-000000000001'::uuid, 'active',
   '2026-01-01'::date, '2026-03-31'::date, :pm_id::uuid,
   ('[' || :admin_id::text || ', ' || :brand_manager_id::text || ']')::jsonb,
   jsonb_build_object('budget', 75000, 'deliverables', ARRAY['20 LinkedIn posts', '10 SEO blogs', '3 videos']),
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),

  ('project-002-0000-0000-000000000002'::uuid, 'Brand Refresh Initiative', 'acme-brand-refresh',
   'Complete brand identity refresh and messaging update',
   'client-001-0000-0000-000000000001'::uuid, 'active',
   '2026-02-01'::date, '2026-04-30'::date, :pm_id::uuid,
   ('[' || :brand_manager_id::text || ', ' || :manager_id::text || ']')::jsonb,
   jsonb_build_object('budget', 50000, 'deliverables', ARRAY['Brand guidelines', 'New logo', 'Messaging framework']),
   NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),

  -- CloudFirst Projects
  ('project-003-0000-0000-000000000003'::uuid, 'Content Marketing Program', 'cloudfirst-content',
   'Ongoing content marketing and thought leadership program',
   'client-002-0000-0000-000000000002'::uuid, 'active',
   '2026-01-15'::date, '2026-12-31'::date, :pm_id::uuid,
   ('[' || :pm_id::text || ', ' || :brand_manager_id::text || ']')::jsonb,
   jsonb_build_object('budget', 120000, 'monthly_deliverables', ARRAY['4 SEO blogs', '8 LinkedIn posts', '1 whitepaper']),
   NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

  -- DataDriven Projects
  ('project-004-0000-0000-000000000004'::uuid, 'Analytics Dashboard Campaign', 'datadriven-analytics-campaign',
   'Campaign to promote new analytics dashboard features',
   'client-003-0000-0000-000000000003'::uuid, 'active',
   '2026-02-15'::date, '2026-06-30'::date, :pm_id::uuid,
   ('[' || :pm_id::text || ']')::jsonb,
   jsonb_build_object('budget', 60000, 'phase', 'Awareness & Education'),
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),

  -- SecureNet Projects
  ('project-005-0000-0000-000000000005'::uuid, 'Enterprise Security Campaign', 'securenet-enterprise',
   'B2B campaign targeting enterprise security buyers',
   'client-004-0000-0000-000000000004'::uuid, 'active',
   '2026-01-20'::date, '2026-09-30'::date, :pm_id::uuid,
   ('[' || :pm_id::text || ', ' || :brand_manager_id::text || ', ' || :manager_id::text || ']')::jsonb,
   jsonb_build_object('budget', 150000, 'segment', 'Enterprise'),
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 3. PROJECT TASKS (30-40 tasks)
-- =====================================================

INSERT INTO public.project_tasks (
  id,
  project_id,
  title,
  description,
  status,
  priority,
  assigned_to,
  created_by,
  due_date,
  past_assignees,
  created_at,
  updated_at
) VALUES
  -- Tasks for Q1 Marketing Campaign
  ('task-001-0000-0000-000000000001'::uuid, 'project-001-0000-0000-000000000001'::uuid,
   'Content calendar planning', 'Plan 60 pieces of content for Q1', 'completed',
   'high', :brand_manager_id::uuid, :pm_id::uuid, '2026-01-15'::date, NULL,
   NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days'),

  ('task-002-0000-0000-000000000002'::uuid, 'project-001-0000-0000-000000000001'::uuid,
   'LinkedIn content creation', 'Write 20 LinkedIn posts with AI assistance', 'in_progress',
   'high', :brand_manager_id::uuid, :pm_id::uuid, '2026-02-28'::date, NULL,
   NOW() - INTERVAL '50 days', NOW() - INTERVAL '10 days'),

  ('task-003-0000-0000-000000000003'::uuid, 'project-001-0000-0000-000000000001'::uuid,
   'SEO blog production', 'Create 10 SEO-optimized blog posts', 'in_progress',
   'high', :admin_id::uuid, :pm_id::uuid, '2026-03-15'::date, NULL,
   NOW() - INTERVAL '45 days', NOW() - INTERVAL '5 days'),

  ('task-004-0000-0000-000000000004'::uuid, 'project-001-0000-0000-000000000001'::uuid,
   'Video production', 'Create 3 product demo videos', 'todo',
   'medium', :admin_id::uuid, :pm_id::uuid, '2026-03-31'::date, NULL,
   NOW() - INTERVAL '40 days', NOW()),

  ('task-005-0000-0000-000000000005'::uuid, 'project-001-0000-0000-000000000001'::uuid,
   'Email campaign setup', 'Design and schedule 12 email campaigns', 'todo',
   'medium', :user_id::uuid, :pm_id::uuid, '2026-03-20'::date, NULL,
   NOW() - INTERVAL '38 days', NOW()),

  -- Tasks for Brand Refresh
  ('task-006-0000-0000-000000000006'::uuid, 'project-002-0000-0000-000000000002'::uuid,
   'Logo design concepts', 'Create 3 logo design variations', 'completed',
   'high', :manager_id::uuid, :brand_manager_id::uuid, '2026-02-15'::date, NULL,
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '25 days'),

  ('task-007-0000-0000-000000000007'::uuid, 'project-002-0000-0000-000000000002'::uuid,
   'Brand guidelines document', 'Finalize comprehensive brand guidelines', 'in_progress',
   'high', :brand_manager_id::uuid, :brand_manager_id::uuid, '2026-03-15'::date, NULL,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days'),

  ('task-008-0000-0000-000000000008'::uuid, 'project-002-0000-0000-000000000002'::uuid,
   'Messaging framework', 'Develop core messaging and positioning', 'in_progress',
   'high', :admin_id::uuid, :brand_manager_id::uuid, '2026-03-31'::date, NULL,
   NOW() - INTERVAL '28 days', NOW()),

  -- Tasks for Content Marketing Program
  ('task-009-0000-0000-000000000009'::uuid, 'project-003-0000-0000-000000000003'::uuid,
   'January blog posts (4)', 'Create 4 SEO blogs for January', 'completed',
   'high', :brand_manager_id::uuid, :pm_id::uuid, '2026-01-31'::date, NULL,
   NOW() - INTERVAL '50 days', NOW() - INTERVAL '30 days'),

  ('task-010-0000-0000-000000000010'::uuid, 'project-003-0000-0000-000000000003'::uuid,
   'February blog posts (4)', 'Create 4 SEO blogs for February', 'in_progress',
   'high', :brand_manager_id::uuid, :pm_id::uuid, '2026-02-28'::date, NULL,
   NOW() - INTERVAL '25 days', NOW()),

  ('task-011-0000-0000-000000000011'::uuid, 'project-003-0000-0000-000000000003'::uuid,
   'February LinkedIn posts (8)', 'Create 8 LinkedIn posts for February', 'completed',
   'high', :brand_manager_id::uuid, :pm_id::uuid, '2026-02-28'::date, NULL,
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '5 days'),

  -- More tasks...
  ('task-012-0000-0000-000000000012'::uuid, 'project-004-0000-0000-000000000004'::uuid,
   'Market research', 'Research analytics dashboard market and competitors', 'completed',
   'medium', :admin_id::uuid, :pm_id::uuid, '2026-02-20'::date, NULL,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days'),

  ('task-013-0000-0000-000000000013'::uuid, 'project-005-0000-0000-000000000005'::uuid,
   'Buyer persona development', 'Create detailed enterprise buyer personas', 'in_progress',
   'high', :pm_id::uuid, :pm_id::uuid, '2026-02-28'::date, NULL,
   NOW() - INTERVAL '15 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. EOD SUBMISSIONS (End-of-day team status)
-- =====================================================

INSERT INTO public.eod_submissions (
  id,
  submitted_by,
  submission_date,
  summary,
  highlights,
  blockers,
  tomorrow_focus,
  metadata,
  created_at
) VALUES
  ('eod-001-0000-0000-000000000001'::uuid, :brand_manager_id::uuid, NOW()::date - INTERVAL '3 days',
   'Good progress on content calendar and LinkedIn posts',
   ARRAY['Completed content calendar planning for Q1', 'Started writing 20 LinkedIn posts', 'Client feedback positive'],
   ARRAY['Waiting for client approval on messaging'],
   ARRAY['Continue writing LinkedIn posts', 'Start SEO blog research', 'Weekly team sync'],
   jsonb_build_object('tasks_completed', 3, 'tasks_pending', 5),
   NOW() - INTERVAL '3 days'),

  ('eod-002-0000-0000-000000000002'::uuid, :brand_manager_id::uuid, NOW()::date - INTERVAL '2 days',
   'Content creation on track. Brand refresh progressing',
   ARRAY['Completed 5 LinkedIn posts', 'Logo design concepts approved', 'Brand guidelines 80% complete'],
   ARRAY['Designer needs more brand direction'],
   ARRAY['Finalize brand guidelines', 'Continue LinkedIn content', 'Client presentation prep'],
   jsonb_build_object('tasks_completed', 4, 'tasks_pending', 4),
   NOW() - INTERVAL '2 days'),

  ('eod-003-0000-0000-000000000003'::uuid, :brand_manager_id::uuid, NOW()::date - INTERVAL '1 day',
   'High productivity. All projects advancing',
   ARRAY['Delivered 8 blog outlines', 'Recorded 2 product videos', 'Email campaign sequences designed'],
   ARRAY['One client needs revised timeline'],
   ARRAY['Start blog writing', 'Video editing', 'Email testing'],
   jsonb_build_object('tasks_completed', 5, 'tasks_pending', 3),
   NOW() - INTERVAL '1 day'),

  ('eod-004-0000-0000-000000000004'::uuid, :admin_id::uuid, NOW()::date - INTERVAL '3 days',
   'System administration and project support',
   ARRAY['Updated documentation', 'Fixed 2 platform bugs', 'Trained new team member'],
   ARRAY['Need to schedule database optimization'],
   ARRAY['Run database maintenance', 'Review AI agent performance'],
   jsonb_build_object('tasks_completed', 3, 'tasks_pending', 2),
   NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 5. WEEKLY CLIENT SUMMARY (Weekly status reports)
-- =====================================================

INSERT INTO public.weekly_client_summary (
  id,
  client_id,
  week_start_date,
  week_end_date,
  summary,
  key_deliverables,
  metrics,
  next_week_plan,
  created_by,
  created_at
) VALUES
  ('wcs-001-0000-0000-000000000001'::uuid, 'client-001-0000-0000-000000000001'::uuid,
   '2026-02-17'::date, '2026-02-23'::date,
   'Excellent week for Q1 campaign. Content calendar finalized and content creation is underway. All timelines on track.',
   ARRAY['Content calendar: 60 pieces planned', 'LinkedIn strategy: finalized', 'First 5 blog outlines: completed'],
   jsonb_build_object(
     'content_pieces_completed', 8,
     'client_approval_rate', '100%',
     'on_time_delivery', true
   ),
   'Continue content production. Start video production planning. Weekly client sync scheduled.',
   :pm_id::uuid, NOW() - INTERVAL '5 days'),

  ('wcs-002-0000-0000-000000000002'::uuid, 'client-002-0000-0000-000000000002'::uuid,
   '2026-02-17'::date, '2026-02-23'::date,
   'Great momentum on content marketing program. Monthly deliverables on pace for completion.',
   ARRAY['4 Blog posts: completed', '8 LinkedIn posts: completed', 'Whitepaper research: in progress'],
   jsonb_build_object(
     'blog_traffic', '2400 visits',
     'linkedin_engagement_rate', '7.2%',
     'lead_quality_score', 8.5
   ),
   'Finalize whitepaper. Plan March content. Review analytics and optimize top performers.',
   :pm_id::uuid, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. TASK COMMENTS (Task activity)
-- =====================================================

INSERT INTO public.project_task_comments (
  id,
  task_id,
  comment_text,
  created_by,
  created_at
) VALUES
  ('comment-001-0000-0000-000000000001'::uuid, 'task-002-0000-0000-000000000002'::uuid,
   'Great start on the LinkedIn posts! Can you make sure we include more customer stories?',
   :pm_id::uuid, NOW() - INTERVAL '8 days'),

  ('comment-002-0000-0000-000000000002'::uuid, 'task-002-0000-0000-000000000002'::uuid,
   'Absolutely. I''ll incorporate 3 customer success stories into the mix. Will have updated drafts by tomorrow.',
   :brand_manager_id::uuid, NOW() - INTERVAL '7 days'),

  ('comment-003-0000-0000-000000000003'::uuid, 'task-007-0000-0000-000000000003'::uuid,
   'Logo concepts look amazing! Let''s present these to the client this week.',
   :brand_manager_id::uuid, NOW() - INTERVAL '10 days'),

  ('comment-004-0000-0000-000000000004'::uuid, 'task-008-0000-0000-000000000008'::uuid,
   'Draft messaging framework ready for review. Three core positioning statements developed.',
   :admin_id::uuid, NOW() - INTERVAL '4 days'),

  ('comment-005-0000-0000-000000000005'::uuid, 'task-008-0000-0000-000000000008'::uuid,
   'Reviewed. These are strong. Let''s do a client workshop next week to finalize.',
   :brand_manager_id::uuid, NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager ON public.projects(project_manager);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON public.project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_eod_submissions_submitted_by ON public.eod_submissions(submitted_by);
CREATE INDEX IF NOT EXISTS idx_eod_submissions_date ON public.eod_submissions(submission_date);
CREATE INDEX IF NOT EXISTS idx_weekly_client_summary_client_id ON public.weekly_client_summary(client_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON public.project_task_comments(task_id);

-- =====================================================
-- Summary
-- =====================================================
-- Phase 3 complete. The following project/client data has been seeded:
--
-- ✅ Clients: 6 clients with realistic details
-- ✅ Projects: 5 projects across multiple clients
-- ✅ Project Tasks: 13 tasks with various statuses
-- ✅ EOD Submissions: 4 end-of-day status submissions
-- ✅ Weekly Client Summaries: 2 weekly reports
-- ✅ Task Comments: 5 comments showing collaboration
--
-- Total Records: ~35 records across ~7 tables
-- Ready for Phase 4: External Integrations & Advanced Features
-- =====================================================
