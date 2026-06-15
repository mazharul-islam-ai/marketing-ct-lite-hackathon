-- Agent Builder & Automation Studio
-- Migration: 20260615000000_agent_builder_studio.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgmq;

-- ============================================================
-- TABLE: agents
-- Top-level agent metadata (immutable identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID,
  name                TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  current_version_id  UUID,
  created_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: agent_versions
-- Full version history with rollback capability
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version         INT NOT NULL DEFAULT 1,
  flow_json       JSONB NOT NULL DEFAULT '{"trigger": null, "steps": [], "edges": []}'::jsonb,
  published_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, version)
);

-- Add FK from agents to agent_versions (after both tables exist)
ALTER TABLE public.agents
  ADD CONSTRAINT fk_agents_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.agent_versions(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: builder_sessions
-- Conversational builder state per user per agent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.builder_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_history    JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, user_id)
);

-- ============================================================
-- TABLE: agent_runs
-- Execution history records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version_id            UUID REFERENCES public.agent_versions(id) ON DELETE SET NULL,
  triggered_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  trigger_type          TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'cron', 'webhook', 'test')),
  trigger_dev_run_id    TEXT,
  pgmq_msg_id           BIGINT,
  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total_cost            NUMERIC(10, 6) DEFAULT 0,
  tokens_used           INT DEFAULT 0,
  step_count            INT DEFAULT 0,
  budget_limit          NUMERIC(10, 4) DEFAULT 5.00,
  error_message         TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: run_steps
-- Per-node execution log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.run_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  node_id         TEXT NOT NULL,
  node_type       TEXT NOT NULL,
  node_label      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input           JSONB,
  output          JSONB,
  storage_ref     TEXT,  -- Supabase Storage URL for outputs > 50KB
  error           TEXT,
  tokens_used     INT DEFAULT 0,
  cost            NUMERIC(10, 6) DEFAULT 0,
  duration_ms     INT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: automations
-- Scheduled and event-based triggers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  trigger_type      TEXT NOT NULL DEFAULT 'cron' CHECK (trigger_type IN ('cron', 'webhook', 'event', 'manual')),
  cron_expression   TEXT,
  webhook_url       TEXT,
  webhook_secret    TEXT,
  event_type        TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: tool_connections
-- Encrypted integration credentials per workspace
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tool_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID,
  tool_name               TEXT NOT NULL,
  display_name            TEXT,
  encrypted_credentials   JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_by              UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PGMQ: Create the agent_runs queue
-- ============================================================
SELECT pgmq.create('agent_runs');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agents_workspace      ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_status         ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_created_by     ON public.agents(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent  ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_builder_sessions_agent ON public.builder_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_builder_sessions_user  ON public.builder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent       ON public.agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status      ON public.agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created     ON public.agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_steps_run          ON public.run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_automations_agent      ON public.automations(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_ws    ON public.tool_connections(workspace_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_agents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_agents_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.agents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builder_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_connections  ENABLE ROW LEVEL SECURITY;

-- agents: authenticated users can read; super_admin can write
CREATE POLICY "agents_read_authenticated"
  ON public.agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "agents_insert_admin"
  ON public.agents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "agents_update_admin"
  ON public.agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "agents_delete_admin"
  ON public.agents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- agent_versions: same access pattern as agents
CREATE POLICY "agent_versions_read"
  ON public.agent_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "agent_versions_write_admin"
  ON public.agent_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- builder_sessions: users own their sessions
CREATE POLICY "builder_sessions_own"
  ON public.builder_sessions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- agent_runs: authenticated can read; write via service role
CREATE POLICY "agent_runs_read"
  ON public.agent_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "agent_runs_insert_authenticated"
  ON public.agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (triggered_by = auth.uid());

CREATE POLICY "agent_runs_update_admin"
  ON public.agent_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
    OR triggered_by = auth.uid()
  );

-- run_steps: readable by all authenticated
CREATE POLICY "run_steps_read"
  ON public.run_steps FOR SELECT
  TO authenticated
  USING (true);

-- automations: admin manage, all read
CREATE POLICY "automations_read"
  ON public.automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "automations_write_admin"
  ON public.automations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- tool_connections: admin only
CREATE POLICY "tool_connections_admin"
  ON public.tool_connections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================
-- HELPER: increment agent version
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_agent_version(p_agent_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(version), 0) INTO v_max
  FROM public.agent_versions
  WHERE agent_id = p_agent_id;
  RETURN v_max + 1;
END;
$$;

-- ============================================================
-- HELPER: get agent run stats for monitoring dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agent_run_stats(p_agent_id UUID)
RETURNS TABLE (
  total_runs       BIGINT,
  success_runs     BIGINT,
  failed_runs      BIGINT,
  total_cost       NUMERIC,
  avg_duration_ms  NUMERIC,
  last_run_at      TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*)                                                         AS total_runs,
    COUNT(*) FILTER (WHERE status = 'completed')                    AS success_runs,
    COUNT(*) FILTER (WHERE status = 'failed')                       AS failed_runs,
    COALESCE(SUM(total_cost), 0)                                    AS total_cost,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)    AS avg_duration_ms,
    MAX(created_at)                                                  AS last_run_at
  FROM public.agent_runs
  WHERE agent_id = p_agent_id;
$$;
