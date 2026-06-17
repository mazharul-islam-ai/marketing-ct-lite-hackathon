-- Agent Visibility & Public Token
-- Migration: 20260617000000_agent_visibility.sql

-- ============================================================
-- Add visibility + public_token columns to agents table
-- ============================================================

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'workspace'
    CHECK (visibility IN ('admin_only', 'workspace', 'public'));

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique index so each agent has a distinct shareable token
CREATE UNIQUE INDEX IF NOT EXISTS agents_public_token_idx
  ON public.agents (public_token);

-- ============================================================
-- Update RLS policies for agents SELECT
-- ============================================================

-- Drop the old blanket read policy (all authenticated could read everything)
DROP POLICY IF EXISTS "agents_read_authenticated" ON public.agents;

-- admin_only: only super_admin and manager can read
CREATE POLICY "agents_read_admin_only"
  ON public.agents FOR SELECT
  TO authenticated
  USING (
    visibility = 'admin_only'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'manager')
    )
  );

-- workspace: any authenticated user can read
CREATE POLICY "agents_read_workspace"
  ON public.agents FOR SELECT
  TO authenticated
  USING (visibility = 'workspace');

-- public (authenticated): authenticated users can read public agents too
CREATE POLICY "agents_read_public_authenticated"
  ON public.agents FOR SELECT
  TO authenticated
  USING (visibility = 'public');

-- public (anon): unauthenticated users can only read public agents
-- They query by public_token to avoid id enumeration
CREATE POLICY "agents_read_public_anon"
  ON public.agents FOR SELECT
  TO anon
  USING (visibility = 'public');

-- ============================================================
-- Allow anon to read agent_runs for public agent results
-- ============================================================
CREATE POLICY "agent_runs_read_anon"
  ON public.agent_runs FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.agents
      WHERE agents.id = agent_runs.agent_id
      AND agents.visibility = 'public'
    )
  );

-- Allow anon to insert agent_runs for public agents
-- triggered_by will be NULL for anonymous runs
CREATE POLICY "agent_runs_insert_anon"
  ON public.agent_runs FOR INSERT
  TO anon
  WITH CHECK (
    triggered_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.agents
      WHERE agents.id = agent_id
      AND agents.visibility = 'public'
    )
  );
