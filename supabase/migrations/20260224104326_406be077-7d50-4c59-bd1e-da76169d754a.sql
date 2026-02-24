
-- ============================================
-- PHASE 1B: Content Generation & Project/Client Tables
-- ============================================

-- Thought Leaders
CREATE TABLE public.thought_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  linkedin_url TEXT,
  writing_tone TEXT,
  target_audience TEXT,
  key_topics TEXT[],
  is_active BOOLEAN DEFAULT true,
  agent_id UUID REFERENCES public.ai_agents(id),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.thought_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view leaders" ON public.thought_leaders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage leaders" ON public.thought_leaders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Leader Uploads
CREATE TABLE public.leader_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.thought_leaders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_type TEXT, file_size INTEGER,
  uploaded_by UUID REFERENCES public.users(id),
  is_indexed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.leader_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view uploads" ON public.leader_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert uploads" ON public.leader_uploads FOR INSERT TO authenticated WITH CHECK (true);

-- Weekly Trends
CREATE TABLE public.weekly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL, description TEXT,
  week_start_date DATE NOT NULL, week_end_date DATE NOT NULL,
  source_urls TEXT[], is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.weekly_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view trends" ON public.weekly_trends FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage trends" ON public.weekly_trends FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Generated Posts
CREATE TABLE public.generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID REFERENCES public.thought_leaders(id),
  post_title TEXT, post_body TEXT NOT NULL,
  carousel_outline TEXT[], caption_ideas TEXT[],
  source_type TEXT, source_id UUID,
  agent_id UUID REFERENCES public.ai_agents(id),
  generated_by UUID REFERENCES public.users(id),
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view posts" ON public.generated_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert posts" ON public.generated_posts FOR INSERT TO authenticated WITH CHECK (true);

-- Brand Generated Posts
CREATE TABLE public.brand_generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  post_title TEXT, post_body TEXT NOT NULL,
  platform TEXT DEFAULT 'linkedin',
  status TEXT DEFAULT 'draft',
  scheduled_date TIMESTAMPTZ,
  generated_by UUID REFERENCES public.users(id),
  agent_id UUID REFERENCES public.ai_agents(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brand_generated_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view brand posts" ON public.brand_generated_posts FOR SELECT TO authenticated
  USING (public.user_has_brand_access(auth.uid(), brand_id));
CREATE POLICY "Auth insert brand posts" ON public.brand_generated_posts FOR INSERT TO authenticated WITH CHECK (true);

-- Influencer Style Library
CREATE TABLE public.influencer_style_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_name TEXT NOT NULL, style_description TEXT,
  sample_posts TEXT[], tone_keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.influencer_style_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view styles" ON public.influencer_style_library FOR SELECT TO authenticated USING (true);

-- LinkedIn Agent Templates
CREATE TABLE public.linkedin_agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL, prompt_template TEXT NOT NULL,
  variables JSONB, category TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.linkedin_agent_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view templates" ON public.linkedin_agent_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.linkedin_agent_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Post Agent References
CREATE TABLE public.post_agent_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID, agent_id UUID REFERENCES public.ai_agents(id),
  reference_type TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.post_agent_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view refs" ON public.post_agent_references FOR SELECT TO authenticated USING (true);

-- LinkedIn Analytics Upload
CREATE TABLE public.linkedin_analytics_upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id),
  metric_name TEXT, metric_value NUMERIC, metric_date DATE,
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.linkedin_analytics_upload ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view li analytics" ON public.linkedin_analytics_upload FOR SELECT TO authenticated USING (true);

-- LinkedIn Content Metadata
CREATE TABLE public.linkedin_content_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID, brand_id UUID,
  impressions INTEGER DEFAULT 0, likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0, shares INTEGER DEFAULT 0,
  engagement_rate NUMERIC, metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.linkedin_content_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view lcm" ON public.linkedin_content_metadata FOR SELECT TO authenticated USING (true);

-- SEO Blog Content
CREATE TABLE public.seo_blog_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, content JSONB, keywords TEXT[],
  meta_description TEXT, author_id UUID REFERENCES public.users(id),
  brand_id UUID REFERENCES public.brands(id),
  brand_name TEXT, primary_keyword TEXT,
  published_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seo_blog_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view seo" ON public.seo_blog_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert seo" ON public.seo_blog_content FOR INSERT TO authenticated WITH CHECK (true);

-- SEO Reference Summaries
CREATE TABLE public.seo_reference_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL, summary TEXT NOT NULL,
  key_points TEXT[], generated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seo_reference_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view seo refs" ON public.seo_reference_summaries FOR SELECT TO authenticated USING (true);

-- Keyword Research
CREATE TABLE public.keyword_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL, search_volume INTEGER,
  difficulty NUMERIC, cpc NUMERIC, trends JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.keyword_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view keywords" ON public.keyword_research FOR SELECT TO authenticated USING (true);

-- Keyword Suggestions
CREATE TABLE public.keyword_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL, source TEXT, relevance_score NUMERIC,
  brand_id UUID, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.keyword_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view kw suggest" ON public.keyword_suggestions FOR SELECT TO authenticated USING (true);

-- Keyword Ranking History
CREATE TABLE public.keyword_ranking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES public.keyword_research(id),
  position INTEGER, url TEXT, recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.keyword_ranking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view kw ranking" ON public.keyword_ranking_history FOR SELECT TO authenticated USING (true);

-- Content Performance Metrics
CREATE TABLE public.content_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID, content_type TEXT,
  views INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0, engagement_rate NUMERIC,
  brand_id UUID, recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.content_performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view cpm" ON public.content_performance_metrics FOR SELECT TO authenticated USING (true);

-- Newsletter Sources
CREATE TABLE public.newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL, rss_url TEXT NOT NULL,
  category TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletter_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view nl sources" ON public.newsletter_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage nl sources" ON public.newsletter_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Newsletter Categories
CREATE TABLE public.newsletter_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletter_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view nl cats" ON public.newsletter_categories FOR SELECT TO authenticated USING (true);

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  email TEXT, phone TEXT, company TEXT, industry TEXT,
  status TEXT DEFAULT 'active', activecollab_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'manager', 'pm'));
$$;

CREATE POLICY "Users view clients" ON public.clients FOR SELECT TO authenticated
  USING (public.user_has_client_access(auth.uid(), id));
CREATE POLICY "Admins manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Contacts
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, phone TEXT, company TEXT, role TEXT,
  client_id UUID REFERENCES public.clients(id),
  hubspot_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contacts" ON public.contacts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  description TEXT, client_id UUID REFERENCES public.clients(id),
  status TEXT DEFAULT 'active',
  start_date DATE, end_date DATE,
  project_manager_id UUID REFERENCES public.users(id),
  activecollab_id INTEGER, metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view projects" ON public.projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'pm') OR project_manager_id = auth.uid());
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Project Tasks
CREATE TABLE public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES public.users(id),
  due_date DATE, activecollab_task_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view tasks" ON public.project_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update own tasks" ON public.project_tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'pm'));

-- Project Task Comments
CREATE TABLE public.project_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view comments" ON public.project_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert comments" ON public.project_task_comments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Project Knowledge Files
CREATE TABLE public.project_knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, file_path TEXT, file_type TEXT, file_size INTEGER,
  uploaded_by UUID REFERENCES public.users(id),
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_knowledge_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view pkf" ON public.project_knowledge_files FOR SELECT TO authenticated USING (true);

-- Deals
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, client_id UUID REFERENCES public.clients(id),
  value NUMERIC, stage TEXT DEFAULT 'prospect',
  probability INTEGER, expected_close_date DATE,
  assigned_to UUID REFERENCES public.users(id),
  hubspot_id TEXT, metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage deals" ON public.deals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT,
  team_lead_id UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view teams" ON public.teams FOR SELECT TO authenticated USING (true);

-- Team Members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view tm" ON public.team_members FOR SELECT TO authenticated USING (true);

-- Team EOD Submissions
CREATE TABLE public.team_eod_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  submission_date DATE NOT NULL,
  wins TEXT, challenges TEXT, tomorrow_plan TEXT,
  hours_worked NUMERIC, mood_rating INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB,
  UNIQUE(user_id, submission_date)
);
ALTER TABLE public.team_eod_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own eod" ON public.team_eod_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Users insert own eod" ON public.team_eod_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Team Daily Summaries
CREATE TABLE public.team_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  summary_text TEXT, total_submissions INTEGER,
  generated_by_ai BOOLEAN DEFAULT true,
  generated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.team_daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view summaries" ON public.team_daily_summaries FOR SELECT TO authenticated USING (true);

-- Brand Analytics Data
CREATE TABLE public.brand_analytics_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id),
  metric_name TEXT NOT NULL, metric_value NUMERIC,
  metric_date DATE NOT NULL, source TEXT, metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brand_analytics_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view brand analytics" ON public.brand_analytics_data FOR SELECT TO authenticated
  USING (public.user_has_brand_access(auth.uid(), brand_id));

-- Brand Analytics Integrations
CREATE TABLE public.brand_analytics_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id),
  integration_type TEXT, property_id TEXT,
  credentials JSONB, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brand_analytics_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view integrations" ON public.brand_analytics_integrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins manage integrations" ON public.brand_analytics_integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Feedback Reports
CREATE TABLE public.feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL, description TEXT, category TEXT,
  status TEXT DEFAULT 'open', priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own feedback" ON public.feedback_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users insert feedback" ON public.feedback_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Feedback Comments
CREATE TABLE public.feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedback_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view fb comments" ON public.feedback_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert fb comments" ON public.feedback_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Testimonials
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL, author_title TEXT,
  company TEXT, content TEXT NOT NULL,
  rating INTEGER, is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view approved" ON public.testimonials FOR SELECT USING (is_approved = true);
CREATE POLICY "Auth view all" ON public.testimonials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert" ON public.testimonials FOR INSERT WITH CHECK (true);
