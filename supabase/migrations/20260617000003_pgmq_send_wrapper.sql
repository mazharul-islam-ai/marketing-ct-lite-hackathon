-- Expose pgmq.send to PostgREST/supabase.rpc()
-- Required by trigger-flow-run and trigger-public-agent-run edge functions
-- which call supabase.rpc('pgmq_send', { queue_name, msg }) to enqueue agent runs.
CREATE OR REPLACE FUNCTION public.pgmq_send(
  queue_name TEXT,
  msg        JSONB
)
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT pgmq.send(queue_name, msg);
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.pgmq_send(TEXT, JSONB) TO authenticated, service_role;
