CREATE TABLE IF NOT EXISTS public.activecollab_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  api_url text NOT NULL,
  username text NOT NULL,
  password text,
  token text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.activecollab_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sync_type text,
  status text,
  records_synced integer,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.activecollab_task_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id integer NOT NULL,
  project_id integer,
  task_name text,
  status text,
  assigned_to text,
  due_date date,
  created_at timestamp with time zone DEFAULT now(),
  synced_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_google_drive_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  folder_name text NOT NULL,
  folder_id text NOT NULL,
  purpose text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_user_id text,
  agent_id uuid,
  memory_text text NOT NULL,
  tags text[],
  context jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_selection (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  category_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid,
  executed_by uuid,
  execution_context jsonb,
  ai_summary text,
  generated_tasks jsonb,
  status text DEFAULT 'completed'::text,
  category text,
  output jsonb,
  approval_status text DEFAULT 'pending'::text,
  approved_at timestamp with time zone,
  brand_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  title text,
  total_tokens integer,
  cost_usd numeric
);
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  system_prompt text NOT NULL DEFAULT ''::text,
  model_provider text DEFAULT 'openai'::text,
  model_version text DEFAULT 'gpt-4o'::text,
  is_active boolean DEFAULT true,
  created_by uuid,
  knowledge_sources jsonb,
  external_data_sources jsonb,
  fallback_provider text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  slug text,
  is_enabled boolean DEFAULT true,
  scope text DEFAULT 'global'::text,
  data_sources jsonb DEFAULT '[]'::jsonb,
  schedule_config jsonb,
  output_actions jsonb,
  config jsonb
);
CREATE TABLE IF NOT EXISTS public.ai_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_context jsonb,
  model_settings jsonb,
  prompts jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_generated_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  image_url text,
  model text DEFAULT 'dall-e-3'::text,
  brand_id uuid,
  generated_by uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_shared_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  resource_type text,
  content jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  resource_name text,
  is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.brand_analytics_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid,
  metric_name text NOT NULL,
  metric_value numeric,
  metric_date date NOT NULL,
  source text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brand_analytics_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid,
  integration_type text,
  property_id text,
  credentials jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brand_file_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_id uuid,
  user_id uuid,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brand_generated_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  post_title text,
  post_body text NOT NULL,
  platform text DEFAULT 'linkedin'::text,
  status text DEFAULT 'draft'::text,
  scheduled_date timestamp with time zone,
  generated_by uuid,
  agent_id uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brand_knowledge_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  is_indexed boolean DEFAULT false,
  embedding_count integer DEFAULT 0,
  processing_status text DEFAULT 'pending'::text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brand_kpis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  kpi_name text NOT NULL,
  description text,
  target_value numeric,
  current_value numeric,
  unit text,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  logo_url text,
  website text,
  industry text,
  organization_id uuid,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'active'::text,
  website_url text,
  type text DEFAULT 'internal'::text,
  owner_id uuid,
  co_owner_id uuid,
  team_members uuid[] DEFAULT '{}'::uuid[],
  active_integrations text[] DEFAULT '{}'::text[],
  monthly_budget numeric
);
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  email text,
  phone text,
  company text,
  industry text,
  status text DEFAULT 'active'::text,
  activecollab_id integer,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.code_analysis_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  repository_id uuid,
  analysis_type text,
  results jsonb,
  analyzed_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.code_generation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template text NOT NULL,
  language text,
  framework text,
  category text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.code_repositories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  platform text DEFAULT 'github'::text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.collabai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  company text,
  role text,
  client_id uuid,
  hubspot_id text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.content_performance_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_id uuid,
  content_type text,
  views integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  engagement_rate numeric,
  brand_id uuid,
  recorded_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.control_tower_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key_name text NOT NULL,
  api_key_encrypted text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.control_tower_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sync_type text,
  status text,
  records_synced integer,
  error_message text,
  synced_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid,
  value numeric,
  stage text DEFAULT 'prospect'::text,
  probability integer,
  expected_close_date date,
  assigned_to uuid,
  hubspot_id text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.documentation_output_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config_name text NOT NULL,
  output_format text,
  settings jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.documentation_repository_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  repository_id uuid,
  documentation_url text,
  link_type text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.documentation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.documentation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template text NOT NULL,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  template_name text,
  doc_category text,
  output_format text,
  sections_template jsonb,
  system_prompt text,
  is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.employee_user_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  job_title text,
  department text,
  is_active boolean DEFAULT true,
  hire_date date,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feedback_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feedback_id uuid,
  user_id uuid,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  description text,
  category text,
  status text DEFAULT 'open'::text,
  priority text DEFAULT 'medium'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type text DEFAULT 'feedback'::text,
  submitted_by uuid
);
CREATE TABLE IF NOT EXISTS public.gemini_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  video_url text,
  status text DEFAULT 'pending'::text,
  brand_id uuid,
  generated_by uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.generated_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leader_id uuid,
  post_title text,
  post_body text NOT NULL,
  carousel_outline text[],
  caption_ideas text[],
  source_type text,
  source_id uuid,
  agent_id uuid,
  generated_by uuid,
  model_used text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gohighlevel_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ghl_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  tags text[],
  metadata jsonb,
  synced_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gohighlevel_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key_encrypted text,
  location_id text,
  is_active boolean DEFAULT true,
  config jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.google_drive_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid,
  folder_id text,
  credentials jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hackathon_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  registration_deadline timestamp with time zone,
  max_team_size integer DEFAULT 5,
  min_team_size integer DEFAULT 1,
  rules text,
  prizes jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'upcoming'::text,
  theme text,
  location text
);
CREATE TABLE IF NOT EXISTS public.hackathon_judges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  expertise text[],
  assigned_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hackathon_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  registration_date timestamp with time zone DEFAULT now(),
  skills text[],
  interests text[],
  status text DEFAULT 'registered'::text,
  team_id uuid
);
CREATE TABLE IF NOT EXISTS public.hackathon_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid,
  judge_id uuid,
  innovation_score integer,
  execution_score integer,
  presentation_score integer,
  total_score integer,
  feedback text,
  scored_at timestamp with time zone DEFAULT now(),
  impact_score integer,
  technical_score integer,
  comments text
);
CREATE TABLE IF NOT EXISTS public.hackathon_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  submission_title text NOT NULL,
  description text NOT NULL,
  demo_url text,
  github_url text,
  video_url text,
  presentation_url text,
  submitted_at timestamp with time zone DEFAULT now(),
  is_finalized boolean DEFAULT false,
  tech_stack text[],
  status text DEFAULT 'submitted'::text
);
CREATE TABLE IF NOT EXISTS public.hackathon_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  participant_id uuid,
  role text DEFAULT 'member'::text,
  joined_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hackathon_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  team_name text NOT NULL,
  team_lead_id uuid,
  project_name text,
  project_description text,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active'::text
);
CREATE TABLE IF NOT EXISTS public.influencer_style_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  influencer_name text NOT NULL,
  style_description text,
  sample_posts text[],
  tone_keywords text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_type text,
  action text,
  status text,
  request_data jsonb,
  response_data jsonb,
  error_message text,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  request_payload jsonb,
  performed_by uuid
);
CREATE TABLE IF NOT EXISTS public.keyword_blog_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  keyword_id uuid,
  blog_id uuid,
  keyword_type text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.keyword_ranking_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  keyword_id uuid,
  "position" integer,
  url text,
  recorded_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.keyword_research (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  search_volume integer,
  difficulty numeric,
  cpc numeric,
  trends jsonb,
  created_at timestamp with time zone DEFAULT now(),
  brand_id uuid,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  keyword_normalized text,
  competition text,
  difficulty_score numeric,
  current_rank integer,
  target_rank integer,
  priority text DEFAULT 'medium'::text,
  status text DEFAULT 'tracking'::text,
  tags text[],
  notes text,
  used_in_blog_count integer DEFAULT 0,
  last_used_in_blog timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  last_checked_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.keyword_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  source text,
  relevance_score numeric,
  brand_id uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  seed_keyword text,
  suggestions jsonb,
  model_used text,
  prompt_used text
);
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category_id uuid,
  source_url text,
  tags text[],
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  knowledge_type text,
  keywords text[]
);
CREATE TABLE IF NOT EXISTS public.knowledge_base_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  parent_id uuid,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  last_synced timestamp with time zone,
  is_active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.knowledge_base_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  category_id uuid,
  uploaded_by uuid,
  is_indexed boolean DEFAULT false,
  embedding_count integer DEFAULT 0,
  processing_status text DEFAULT 'pending'::text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.knowledge_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_id uuid,
  file_name text NOT NULL,
  file_path text,
  file_type text,
  file_size integer,
  processing_status text DEFAULT 'pending'::text,
  error_message text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_indexed boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text,
  brand_id uuid,
  is_company_wide boolean DEFAULT false,
  config jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_id uuid
);
CREATE TABLE IF NOT EXISTS public.leader_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leader_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  is_indexed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.linkedin_agent_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  prompt_template text NOT NULL,
  variables jsonb,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  role_category text,
  persona_tone text,
  system_prompt text,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.linkedin_analytics_upload (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_id uuid,
  metric_name text,
  metric_value numeric,
  metric_date date,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.linkedin_content_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  brand_id uuid,
  impressions integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  engagement_rate numeric,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.marketing_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  brand_id uuid,
  role text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.n8n_workflow_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL,
  workflow_url text,
  webhook_url text,
  is_enabled boolean DEFAULT true,
  config jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  workflow_slug text,
  base_url text
);
CREATE TABLE IF NOT EXISTS public.n8n_workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid,
  status text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  input_data jsonb,
  output_data jsonb,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.newsletter_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.newsletter_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  rss_url text NOT NULL,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.organization_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  integration_type text NOT NULL,
  config jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  website text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.perplexity_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key_encrypted text,
  model text DEFAULT 'llama-3.1-sonar-small-128k-online'::text,
  is_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pod_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pod_id uuid,
  employee_id uuid,
  role text,
  joined_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pod_name text NOT NULL,
  description text,
  pod_lead_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.post_agent_references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  agent_id uuid,
  reference_type text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.project_knowledge_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  file_name text NOT NULL,
  file_path text,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  processing_status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.project_meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  title text NOT NULL,
  meeting_date timestamp with time zone,
  duration_minutes integer,
  notes text,
  attendees uuid[],
  meeting_url text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.project_task_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid,
  comment text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo'::text,
  priority text DEFAULT 'medium'::text,
  assigned_to uuid,
  due_date date,
  activecollab_task_id integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  actual_hours numeric DEFAULT 0,
  completed_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  client_id uuid,
  status text DEFAULT 'active'::text,
  start_date date,
  end_date date,
  project_manager_id uuid,
  activecollab_id integer,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quote_id uuid,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric,
  total_price numeric,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  title text NOT NULL,
  description text,
  total_amount numeric,
  status text DEFAULT 'draft'::text,
  valid_until date,
  created_by uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  resource_type text
);
CREATE TABLE IF NOT EXISTS public.seo_blog_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  content jsonb,
  keywords text[],
  meta_description text,
  author_id uuid,
  brand_id uuid,
  brand_name text,
  primary_keyword text,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  primary_reference text,
  tone text,
  audience text,
  additional_notes text,
  user_id uuid,
  paragraphs jsonb,
  primary_reference_summary text,
  is_valid boolean DEFAULT false,
  validation_result jsonb,
  validation_errors text[],
  validation_warnings text[],
  generation_attempts integer DEFAULT 0,
  total_tokens_used integer,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(10,4),
  generation_time_ms integer,
  status text DEFAULT 'draft'::text,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.seo_reference_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  summary text NOT NULL,
  key_points text[],
  generated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sora_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  video_url text,
  status text DEFAULT 'pending'::text,
  brand_id uuid,
  generated_by uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.team_daily_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  summary_date date NOT NULL,
  summary_text text,
  total_submissions integer,
  generated_by_ai boolean DEFAULT true,
  generated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.team_eod_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  submission_date date NOT NULL,
  wins text,
  challenges text,
  tomorrow_plan text,
  hours_worked numeric,
  mood_rating integer,
  submitted_at timestamp with time zone DEFAULT now(),
  metadata jsonb
);
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  user_id uuid,
  role text DEFAULT 'member'::text,
  joined_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  team_lead_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_name text NOT NULL,
  author_title text,
  company text,
  content text NOT NULL,
  rating integer,
  is_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.thought_leaders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  title text,
  linkedin_url text,
  writing_tone text,
  target_audience text,
  key_topics text[],
  is_active boolean DEFAULT true,
  agent_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_accountability_chart (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  serial_number integer,
  type_of_work text,
  responsibilities text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_activecollab_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activecollab_user_id integer,
  settings jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_google_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text,
  refresh_token text,
  token_expiry timestamp with time zone,
  scopes text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  resource_type text,
  resource_id uuid,
  granted_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  avatar_url text
);
CREATE TABLE IF NOT EXISTS public.vision_examples (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.weekly_client_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  summary_text text,
  week_start date,
  week_end date,
  generated_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.weekly_content_ideas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  leader_id uuid,
  headline text NOT NULL,
  description text,
  source_urls text[],
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE TABLE IF NOT EXISTS public.weekly_trends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  description text,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  source_urls text[],
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
