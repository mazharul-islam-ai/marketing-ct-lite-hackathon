-- =====================================================
-- Seed mock tasks into activecollab_task_data
-- Covers 4 demo projects across various statuses
-- Table schema: task_id INTEGER, project_id INTEGER,
--   task_name TEXT, status TEXT, assigned_to TEXT,
--   due_date DATE, created_at TIMESTAMPTZ, synced_at TIMESTAMPTZ
-- project_id integers match activecollab_id on the demo projects
--   (20001 = AI Lead Gen, 20002 = Q2 Campaign,
--    20003 = Brand Identity, 20004 = Content & SEO)
-- =====================================================

INSERT INTO public.activecollab_task_data (
  id,
  task_id,
  project_id,
  task_name,
  status,
  assigned_to,
  due_date,
  created_at,
  synced_at
) VALUES

  -- -------------------------------------------------------
  -- Project 20001: AI-Powered Lead Generation
  -- -------------------------------------------------------
  (
    'ac000000-0000-0000-0000-000000000001'::uuid,
    1001, 20001,
    'Define ICP and buyer personas',
    'completed',
    'sarah.jones@agency.com',
    '2026-02-15',
    NOW() - INTERVAL '50 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000002'::uuid,
    1002, 20001,
    'Write landing page copy (hero + value props)',
    'in_progress',
    'mike.chen@agency.com',
    '2026-03-20',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000003'::uuid,
    1003, 20001,
    'Design lead magnet PDF (10-page guide)',
    'in_progress',
    'priya.nair@agency.com',
    '2026-03-28',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000004'::uuid,
    1004, 20001,
    'Build 5-part email nurture sequence',
    'todo',
    'mike.chen@agency.com',
    '2026-04-10',
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'ac000000-0000-0000-0000-000000000005'::uuid,
    1005, 20001,
    'Set up HubSpot workflows for MQL routing',
    'todo',
    'david.okafor@agency.com',
    '2026-04-20',
    NOW() - INTERVAL '7 days',
    NOW()
  ),

  -- -------------------------------------------------------
  -- Project 20002: Q2 Digital Marketing Campaign
  -- -------------------------------------------------------
  (
    'ac000000-0000-0000-0000-000000000006'::uuid,
    2001, 20002,
    'Campaign strategy and KPI document',
    'in_progress',
    'sarah.jones@agency.com',
    '2026-03-15',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000007'::uuid,
    2002, 20002,
    'Creative brief and moodboard for Q2',
    'todo',
    'priya.nair@agency.com',
    '2026-03-25',
    NOW() - INTERVAL '8 days',
    NOW()
  ),
  (
    'ac000000-0000-0000-0000-000000000008'::uuid,
    2003, 20002,
    'Paid social ad creatives (Meta + LinkedIn)',
    'todo',
    'priya.nair@agency.com',
    '2026-04-05',
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    'ac000000-0000-0000-0000-000000000009'::uuid,
    2004, 20002,
    'GA4 + UTM tracking setup',
    'completed',
    'david.okafor@agency.com',
    '2026-03-10',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000010'::uuid,
    2005, 20002,
    'Weekly performance report template',
    'todo',
    'sarah.jones@agency.com',
    '2026-03-30',
    NOW() - INTERVAL '3 days',
    NOW()
  ),

  -- -------------------------------------------------------
  -- Project 20003: Brand Identity Overhaul
  -- -------------------------------------------------------
  (
    'ac000000-0000-0000-0000-000000000011'::uuid,
    3001, 20003,
    'Brand discovery workshop facilitation',
    'completed',
    'priya.nair@agency.com',
    '2026-02-10',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000012'::uuid,
    3002, 20003,
    'Logo concepts — 3 design directions',
    'completed',
    'priya.nair@agency.com',
    '2026-03-01',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000013'::uuid,
    3003, 20003,
    'Logo refinement and final files',
    'in_progress',
    'priya.nair@agency.com',
    '2026-03-22',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000014'::uuid,
    3004, 20003,
    'Colour palette and typography system',
    'in_progress',
    'mike.chen@agency.com',
    '2026-03-30',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000015'::uuid,
    3005, 20003,
    'Brand guidelines document (full PDF)',
    'todo',
    'priya.nair@agency.com',
    '2026-04-15',
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    'ac000000-0000-0000-0000-000000000016'::uuid,
    3006, 20003,
    'Client sign-off presentation deck',
    'todo',
    'sarah.jones@agency.com',
    '2026-05-01',
    NOW() - INTERVAL '2 days',
    NOW()
  ),

  -- -------------------------------------------------------
  -- Project 20004: Content & SEO Program
  -- -------------------------------------------------------
  (
    'ac000000-0000-0000-0000-000000000017'::uuid,
    4001, 20004,
    'Master keyword cluster research',
    'completed',
    'mike.chen@agency.com',
    '2026-01-20',
    NOW() - INTERVAL '58 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000018'::uuid,
    4002, 20004,
    'January blog content (6 posts)',
    'completed',
    'sarah.jones@agency.com',
    '2026-01-31',
    NOW() - INTERVAL '55 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000019'::uuid,
    4003, 20004,
    'February blog content (6 posts)',
    'completed',
    'sarah.jones@agency.com',
    '2026-02-28',
    NOW() - INTERVAL '38 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'ac000000-0000-0000-0000-000000000020'::uuid,
    4004, 20004,
    'March blog content (6 posts)',
    'in_progress',
    'sarah.jones@agency.com',
    '2026-03-31',
    NOW() - INTERVAL '18 days',
    NOW()
  ),
  (
    'ac000000-0000-0000-0000-000000000021'::uuid,
    4005, 20004,
    'Monthly LinkedIn content calendar (12 posts)',
    'in_progress',
    'mike.chen@agency.com',
    '2026-03-25',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ac000000-0000-0000-0000-000000000022'::uuid,
    4006, 20004,
    'Monthly SEO performance report',
    'todo',
    'david.okafor@agency.com',
    '2026-03-31',
    NOW() - INTERVAL '2 days',
    NOW()
  )

ON CONFLICT (id) DO NOTHING;
