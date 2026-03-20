-- Add missing columns to keyword_research table
ALTER TABLE public.keyword_research
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS keyword_normalized text,
  ADD COLUMN IF NOT EXISTS competition text,
  ADD COLUMN IF NOT EXISTS difficulty_score numeric,
  ADD COLUMN IF NOT EXISTS current_rank integer,
  ADD COLUMN IF NOT EXISTS target_rank integer,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'tracking',
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS used_in_blog_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_in_blog timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- Add missing columns to keyword_suggestions table for caching
ALTER TABLE public.keyword_suggestions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS seed_keyword text,
  ADD COLUMN IF NOT EXISTS suggestions jsonb,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS prompt_used text;

-- Create keyword_blog_usage table if not exists
CREATE TABLE IF NOT EXISTS public.keyword_blog_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id uuid REFERENCES public.keyword_research(id) ON DELETE CASCADE,
  blog_id uuid,
  keyword_type text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.keyword_blog_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_suggestions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Authenticated users can manage keyword_blog_usage"
  ON public.keyword_blog_usage
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add policy for keyword_research if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'keyword_research' AND policyname = 'Authenticated users can manage keyword_research'
  ) THEN
    CREATE POLICY "Authenticated users can manage keyword_research"
      ON public.keyword_research
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add policy for keyword_suggestions if not exists  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'keyword_suggestions' AND policyname = 'Authenticated users can manage keyword_suggestions'
  ) THEN
    CREATE POLICY "Authenticated users can manage keyword_suggestions"
      ON public.keyword_suggestions
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;