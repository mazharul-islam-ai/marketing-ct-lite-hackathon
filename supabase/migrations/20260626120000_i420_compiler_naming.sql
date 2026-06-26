-- i420 multi-stage compiler: artifacts, compile_jobs, compiler mode flag

-- Latest working artifacts per design chat session
ALTER TABLE public.builder_sessions
  ADD COLUMN IF NOT EXISTS compile_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Snapshot artifacts per saved agent version
ALTER TABLE public.agent_versions
  ADD COLUMN IF NOT EXISTS compile_artifacts JSONB;

-- Multi-stage compile job tracking
CREATE TABLE IF NOT EXISTS public.compile_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt            TEXT NOT NULL,
  action            TEXT NOT NULL DEFAULT 'generate',
  mode              TEXT NOT NULL DEFAULT 'multi' CHECK (mode IN ('multi')),
  status            TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'clarification', 'completed', 'failed')),
  current_stage     TEXT,
  compile_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  flow_json         JSONB,
  user_message      TEXT,
  version_id        UUID REFERENCES public.agent_versions(id) ON DELETE SET NULL,
  version_number    INT,
  trigger_dev_run_id TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compile_jobs_agent ON public.compile_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_compile_jobs_user ON public.compile_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_compile_jobs_status ON public.compile_jobs(status);

ALTER TABLE public.compile_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compile_jobs_own"
  ON public.compile_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "compile_jobs_service"
  ON public.compile_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Realtime for compile job status updates (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.compile_jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Default compiler mode: single (monolith)
INSERT INTO public.organization_integrations (integration_type, is_active, config)
SELECT 'agent_builder_compiler', true, '{"mode": "single", "repair_max_attempts": 2}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_integrations
  WHERE integration_type = 'agent_builder_compiler'
);
