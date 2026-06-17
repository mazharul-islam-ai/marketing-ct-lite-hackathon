-- Expose pgmq.read to PostgREST/supabase.rpc()
CREATE OR REPLACE FUNCTION public.pgmq_read(
  queue_name TEXT,
  vt         INTEGER,
  qty        INTEGER
)
RETURNS SETOF pgmq.message_record
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT * FROM pgmq.read(queue_name, vt, qty);
$$;

-- Expose pgmq.delete to PostgREST/supabase.rpc()
CREATE OR REPLACE FUNCTION public.pgmq_delete(
  queue_name TEXT,
  msg_id     BIGINT
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT pgmq.delete(queue_name, msg_id);
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.pgmq_read(TEXT, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pgmq_delete(TEXT, BIGINT) TO authenticated, service_role;
