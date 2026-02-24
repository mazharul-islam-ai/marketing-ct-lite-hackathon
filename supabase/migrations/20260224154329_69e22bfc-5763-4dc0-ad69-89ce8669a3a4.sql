
-- 1. ai_agents: add missing columns
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS schedule_config JSONB DEFAULT NULL;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS output_actions JSONB DEFAULT NULL;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS config JSONB DEFAULT NULL;

-- 2. documentation_templates: add missing columns
ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS sections_template JSONB DEFAULT NULL;
ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT NULL;
ALTER TABLE public.documentation_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. ai_shared_resources: add missing columns
ALTER TABLE public.ai_shared_resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.ai_shared_resources ADD COLUMN IF NOT EXISTS resource_name TEXT DEFAULT NULL;
ALTER TABLE public.ai_shared_resources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. knowledge_base_categories: add missing columns
ALTER TABLE public.knowledge_base_categories ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.knowledge_base_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. knowledge_files: add is_indexed
ALTER TABLE public.knowledge_files ADD COLUMN IF NOT EXISTS is_indexed BOOLEAN DEFAULT false;

-- 6. knowledge_sources: add category_id
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.knowledge_base_categories(id) ON DELETE SET NULL;

-- 7. linkedin_agent_templates: add missing columns
ALTER TABLE public.linkedin_agent_templates ADD COLUMN IF NOT EXISTS role_category TEXT DEFAULT NULL;
ALTER TABLE public.linkedin_agent_templates ADD COLUMN IF NOT EXISTS persona_tone TEXT DEFAULT NULL;
ALTER TABLE public.linkedin_agent_templates ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT NULL;
ALTER TABLE public.linkedin_agent_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 8. Create ai_agent_knowledge_selection table
CREATE TABLE IF NOT EXISTS public.ai_agent_knowledge_selection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.knowledge_base_categories(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, category_id)
);

ALTER TABLE public.ai_agent_knowledge_selection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent knowledge selections"
  ON public.ai_agent_knowledge_selection FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::text)
    OR has_role(auth.uid(), 'manager'::text)
  );

CREATE POLICY "Admins can manage agent knowledge selections"
  ON public.ai_agent_knowledge_selection FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::text)
    OR has_role(auth.uid(), 'manager'::text)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::text)
    OR has_role(auth.uid(), 'manager'::text)
  );
