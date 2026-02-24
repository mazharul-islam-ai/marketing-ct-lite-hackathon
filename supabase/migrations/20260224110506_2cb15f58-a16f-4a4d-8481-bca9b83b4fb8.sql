
-- Add missing columns referenced by existing components
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
ALTER TABLE public.ai_agent_runs ADD COLUMN IF NOT EXISTS cost_usd NUMERIC;

ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS knowledge_type TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS keywords TEXT[];

ALTER TABLE public.ai_shared_resources ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE public.seo_blog_content ADD COLUMN IF NOT EXISTS primary_reference TEXT;
ALTER TABLE public.seo_blog_content ADD COLUMN IF NOT EXISTS secondary_keyword TEXT;
ALTER TABLE public.seo_blog_content ADD COLUMN IF NOT EXISTS third_keyword TEXT;
ALTER TABLE public.seo_blog_content ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE public.seo_blog_content ADD COLUMN IF NOT EXISTS audience TEXT;

ALTER TABLE public.n8n_workflow_configs ADD COLUMN IF NOT EXISTS workflow_slug TEXT;
ALTER TABLE public.n8n_workflow_configs ADD COLUMN IF NOT EXISTS base_url TEXT;

ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS request_payload JSONB;
ALTER TABLE public.integration_logs ADD COLUMN IF NOT EXISTS performed_by UUID;

ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS doc_category TEXT;
ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS output_format TEXT;

ALTER TABLE public.hackathon_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';
ALTER TABLE public.hackathon_events ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE public.hackathon_events ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE public.hackathon_teams ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.hackathon_submissions ADD COLUMN IF NOT EXISTS tech_stack TEXT[];
ALTER TABLE public.hackathon_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';

ALTER TABLE public.hackathon_scores ADD COLUMN IF NOT EXISTS impact_score INTEGER;
ALTER TABLE public.hackathon_scores ADD COLUMN IF NOT EXISTS technical_score INTEGER;
ALTER TABLE public.hackathon_scores ADD COLUMN IF NOT EXISTS comments TEXT;

ALTER TABLE public.hackathon_participants ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.hackathon_teams(id);

ALTER TABLE public.feedback_reports ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'feedback';
ALTER TABLE public.feedback_reports ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.users(id);

-- Add unique index on ai_agents slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug) WHERE slug IS NOT NULL;
