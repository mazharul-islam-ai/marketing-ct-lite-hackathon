-- Enable Supabase Realtime for the Agent Builder tables.
-- Without this, postgres_changes subscriptions in RuntimeTab and BuilderAgentRunnerDialog
-- never fire, so the run status stays stuck on "queued" until manual page reload.
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.run_steps;
