-- Allow service_role to UPDATE agent_runs unconditionally
CREATE POLICY "agent_runs_update_service_role"
  ON public.agent_runs FOR UPDATE
  TO service_role
  USING (true);

-- Allow authenticated users to INSERT into run_steps (previously no write policy existed)
CREATE POLICY "run_steps_insert"
  ON public.run_steps FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service_role full write access to run_steps
CREATE POLICY "run_steps_write_service_role"
  ON public.run_steps FOR ALL
  TO service_role
  USING (true);

-- Allow service_role to INSERT into agent_runs (for poll-queue re-triggers)
CREATE POLICY "agent_runs_insert_service_role"
  ON public.agent_runs FOR INSERT
  TO service_role
  WITH CHECK (true);
