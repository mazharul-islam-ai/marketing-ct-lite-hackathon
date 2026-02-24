
-- ============================================
-- PHASE 1C: Integration & Advanced Feature Tables
-- ============================================

-- ActiveCollab Credentials
CREATE TABLE public.activecollab_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, api_url TEXT NOT NULL,
  username TEXT NOT NULL, password TEXT, token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activecollab_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ac creds" ON public.activecollab_credentials FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins manage ac creds" ON public.activecollab_credentials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- ActiveCollab Sync Logs
CREATE TABLE public.activecollab_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT, status TEXT, records_synced INTEGER,
  error_message TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);
ALTER TABLE public.activecollab_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ac logs" ON public.activecollab_sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "System insert ac logs" ON public.activecollab_sync_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ActiveCollab Task Data
CREATE TABLE public.activecollab_task_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id INTEGER NOT NULL, project_id INTEGER,
  task_name TEXT, status TEXT, assigned_to TEXT,
  due_date DATE, created_at TIMESTAMPTZ DEFAULT now(), synced_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.activecollab_task_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view ac tasks" ON public.activecollab_task_data FOR SELECT TO authenticated USING (true);

-- User ActiveCollab Settings
CREATE TABLE public.user_activecollab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activecollab_user_id INTEGER, settings JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id)
);
ALTER TABLE public.user_activecollab_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ac" ON public.user_activecollab_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own ac" ON public.user_activecollab_settings FOR ALL TO authenticated USING (user_id = auth.uid());

-- Employees (Control Tower)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, job_title TEXT, department TEXT,
  is_active BOOLEAN DEFAULT true, hire_date DATE,
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Pods (Control Tower)
CREATE TABLE public.pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_name TEXT NOT NULL, description TEXT,
  pod_lead_id UUID REFERENCES public.employees(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view pods" ON public.pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pods" ON public.pods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Pod Members
CREATE TABLE public.pod_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id),
  role TEXT, joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pod_id, employee_id)
);
ALTER TABLE public.pod_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view pm" ON public.pod_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pm" ON public.pod_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Employee User Mapping
CREATE TABLE public.employee_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id),
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, user_id)
);
ALTER TABLE public.employee_user_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view eum" ON public.employee_user_mapping FOR SELECT TO authenticated USING (true);

-- Control Tower API Keys
CREATE TABLE public.control_tower_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL, api_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.control_tower_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ct keys" ON public.control_tower_api_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Control Tower Sync Logs
CREATE TABLE public.control_tower_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT, status TEXT, records_synced INTEGER,
  error_message TEXT, synced_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.control_tower_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ct logs" ON public.control_tower_sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Hackathon Events
CREATE TABLE public.hackathon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  start_date TIMESTAMPTZ NOT NULL, end_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ, max_team_size INTEGER DEFAULT 5,
  min_team_size INTEGER DEFAULT 1, rules TEXT,
  prizes JSONB, is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hackathon_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view events" ON public.hackathon_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage events" ON public.hackathon_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Hackathon Participants
CREATE TABLE public.hackathon_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  registration_date TIMESTAMPTZ DEFAULT now(),
  skills TEXT[], interests TEXT[], status TEXT DEFAULT 'registered',
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.hackathon_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view participants" ON public.hackathon_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users register" ON public.hackathon_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Hackathon Teams
CREATE TABLE public.hackathon_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL, team_lead_id UUID REFERENCES public.users(id),
  project_name TEXT, project_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hackathon_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view ht" ON public.hackathon_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert ht" ON public.hackathon_teams FOR INSERT TO authenticated WITH CHECK (true);

-- Hackathon Team Members
CREATE TABLE public.hackathon_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.hackathon_participants(id),
  role TEXT DEFAULT 'member', joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, participant_id)
);
ALTER TABLE public.hackathon_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view htm" ON public.hackathon_team_members FOR SELECT TO authenticated USING (true);

-- Hackathon Submissions
CREATE TABLE public.hackathon_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.hackathon_teams(id),
  submission_title TEXT NOT NULL, description TEXT NOT NULL,
  demo_url TEXT, github_url TEXT, video_url TEXT, presentation_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(), is_finalized BOOLEAN DEFAULT false
);
ALTER TABLE public.hackathon_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view hs" ON public.hackathon_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert hs" ON public.hackathon_submissions FOR INSERT TO authenticated WITH CHECK (true);

-- Hackathon Judges
CREATE TABLE public.hackathon_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.hackathon_events(id),
  user_id UUID REFERENCES public.users(id),
  expertise TEXT[], assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.hackathon_judges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view hj" ON public.hackathon_judges FOR SELECT TO authenticated USING (true);

-- Hackathon Scores
CREATE TABLE public.hackathon_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.hackathon_submissions(id),
  judge_id UUID REFERENCES public.hackathon_judges(id),
  innovation_score INTEGER, execution_score INTEGER,
  presentation_score INTEGER, total_score INTEGER,
  feedback TEXT, scored_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hackathon_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view scores" ON public.hackathon_scores FOR SELECT TO authenticated USING (true);

-- Google Drive Settings
CREATE TABLE public.google_drive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id),
  folder_id TEXT, credentials JSONB, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.google_drive_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view gds" ON public.google_drive_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Admin Google Drive Folders
CREATE TABLE public.admin_google_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_name TEXT NOT NULL, folder_id TEXT NOT NULL,
  purpose TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_google_drive_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view folders" ON public.admin_google_drive_folders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- GoHighLevel Contacts
CREATE TABLE public.gohighlevel_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_id TEXT UNIQUE, first_name TEXT, last_name TEXT,
  email TEXT, phone TEXT, tags TEXT[], metadata JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gohighlevel_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ghl" ON public.gohighlevel_contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- GoHighLevel Integrations
CREATE TABLE public.gohighlevel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_encrypted TEXT, location_id TEXT,
  is_active BOOLEAN DEFAULT true, config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gohighlevel_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ghl int" ON public.gohighlevel_integrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Organization Integrations
CREATE TABLE public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  integration_type TEXT NOT NULL, config JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view org int" ON public.organization_integrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Code Repositories
CREATE TABLE public.code_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, url TEXT, platform TEXT DEFAULT 'github',
  description TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.code_repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view repos" ON public.code_repositories FOR SELECT TO authenticated USING (true);

-- Code Analysis Results
CREATE TABLE public.code_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES public.code_repositories(id),
  analysis_type TEXT, results JSONB,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.code_analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view analysis" ON public.code_analysis_results FOR SELECT TO authenticated USING (true);

-- Code Generation Templates
CREATE TABLE public.code_generation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, template TEXT NOT NULL,
  language TEXT, framework TEXT, category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.code_generation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view cgt" ON public.code_generation_templates FOR SELECT TO authenticated USING (true);

-- Documentation Templates
CREATE TABLE public.documentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, template TEXT NOT NULL,
  category TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documentation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view dt" ON public.documentation_templates FOR SELECT TO authenticated USING (true);

-- Documentation Rules
CREATE TABLE public.documentation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, rule TEXT NOT NULL,
  category TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documentation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view dr" ON public.documentation_rules FOR SELECT TO authenticated USING (true);

-- Documentation Output Config
CREATE TABLE public.documentation_output_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT NOT NULL, output_format TEXT,
  settings JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documentation_output_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view doc" ON public.documentation_output_config FOR SELECT TO authenticated USING (true);

-- Documentation Repository Links
CREATE TABLE public.documentation_repository_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES public.code_repositories(id),
  documentation_url TEXT, link_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documentation_repository_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view drl" ON public.documentation_repository_links FOR SELECT TO authenticated USING (true);

-- Weekly Client Summary
CREATE TABLE public.weekly_client_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  summary_text TEXT, week_start DATE, week_end DATE,
  generated_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.weekly_client_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view wcs" ON public.weekly_client_summary FOR SELECT TO authenticated USING (true);

-- N8n Workflow Executions
CREATE TABLE public.n8n_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.n8n_workflow_configs(id),
  status TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  input_data JSONB, output_data JSONB, error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.n8n_workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view executions" ON public.n8n_workflow_executions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Quotes
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  title TEXT NOT NULL, description TEXT,
  total_amount NUMERIC, status TEXT DEFAULT 'draft',
  valid_until DATE, created_by UUID REFERENCES public.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);

-- Quote Items
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL, quantity INTEGER DEFAULT 1,
  unit_price NUMERIC, total_price NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view qi" ON public.quote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert qi" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);

-- Vision Examples
CREATE TABLE public.vision_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  image_url TEXT, category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vision_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view ve" ON public.vision_examples FOR SELECT TO authenticated USING (true);

-- Project Meetings
CREATE TABLE public.project_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id),
  title TEXT NOT NULL, meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER, notes TEXT,
  attendees UUID[], meeting_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view meetings" ON public.project_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert meetings" ON public.project_meetings FOR INSERT TO authenticated WITH CHECK (true);

-- Marketing Team Members
CREATE TABLE public.marketing_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  brand_id UUID REFERENCES public.brands(id),
  role TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, brand_id)
);
ALTER TABLE public.marketing_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view mtm" ON public.marketing_team_members FOR SELECT TO authenticated USING (true);
