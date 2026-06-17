-- Agent Builder System Prompt Versioning
-- Migration: 20260617000000_agent_builder_prompts.sql

-- ============================================================
-- TABLE: agent_builder_prompts
-- Versioned system prompts for the Agent Builder
-- Each save creates a new immutable version; one row is active
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_builder_prompts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name   TEXT NOT NULL UNIQUE,  -- e.g. "20260617_agent_builder_prompt_v1"
  version_number INT NOT NULL DEFAULT 1,
  prompt_text    TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT false,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_number)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agent_builder_prompts_active   ON public.agent_builder_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_builder_prompts_version  ON public.agent_builder_prompts(version_number DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.agent_builder_prompts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read prompts (needed for the builder to use the active one)
CREATE POLICY "agent_builder_prompts_read"
  ON public.agent_builder_prompts FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin and manager can insert new prompt versions
CREATE POLICY "agent_builder_prompts_insert_admin"
  ON public.agent_builder_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- Only super_admin and manager can update (e.g. flipping is_active)
CREATE POLICY "agent_builder_prompts_update_admin"
  ON public.agent_builder_prompts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- Only super_admin can delete
CREATE POLICY "agent_builder_prompts_delete_superadmin"
  ON public.agent_builder_prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================================
-- HELPER: get next sequential version number
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_prompt_version()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max
  FROM public.agent_builder_prompts;
  RETURN v_max + 1;
END;
$$;
