-- i420 platform AI usage (Design chat compile + future Settings AI)
-- Excludes agent_runs / automation execution costs

CREATE TABLE IF NOT EXISTS public.i420_platform_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id            UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  source              TEXT NOT NULL CHECK (source IN ('compile', 'settings')),
  action              TEXT,
  provider            TEXT,
  model               TEXT,
  prompt_tokens       INT NOT NULL DEFAULT 0,
  completion_tokens   INT NOT NULL DEFAULT 0,
  total_tokens        INT NOT NULL DEFAULT 0,
  cost_usd            NUMERIC(12, 6) NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_i420_platform_usage_created_at
  ON public.i420_platform_usage (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_i420_platform_usage_user_created
  ON public.i420_platform_usage (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_i420_platform_usage_source_created
  ON public.i420_platform_usage (source, created_at DESC);

-- Daily rollup for charts (last 90 days via query filter in app)
CREATE OR REPLACE VIEW public.i420_platform_cost_summary AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS usage_date,
  source,
  provider,
  model,
  COUNT(*)::bigint AS call_count,
  COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
  COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
  COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
  COALESCE(SUM(cost_usd), 0)::numeric(12, 6) AS total_cost_usd
FROM public.i420_platform_usage
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3, 4
ORDER BY usage_date DESC;

ALTER TABLE public.i420_platform_usage ENABLE ROW LEVEL SECURITY;

-- Users read own usage; super_admin reads all
CREATE POLICY "i420_platform_usage_select_own"
  ON public.i420_platform_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "i420_platform_usage_select_super_admin"
  ON public.i420_platform_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Inserts via service role only (edge functions)
CREATE POLICY "i420_platform_usage_insert_service"
  ON public.i420_platform_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

GRANT SELECT ON public.i420_platform_usage TO authenticated;
GRANT SELECT ON public.i420_platform_cost_summary TO authenticated;
