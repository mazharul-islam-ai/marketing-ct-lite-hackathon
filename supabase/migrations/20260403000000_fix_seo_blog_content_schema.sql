-- Fix seo_blog_content table schema
-- The table existed with an older schema; add all columns the edge function requires

ALTER TABLE public.seo_blog_content
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS paragraphs JSONB,
  ADD COLUMN IF NOT EXISTS primary_reference_summary TEXT,
  ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_result JSONB,
  ADD COLUMN IF NOT EXISTS validation_errors TEXT[],
  ADD COLUMN IF NOT EXISTS validation_warnings TEXT[],
  ADD COLUMN IF NOT EXISTS generation_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint on status if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seo_blog_content_status_check'
      AND conrelid = 'public.seo_blog_content'::regclass
  ) THEN
    ALTER TABLE public.seo_blog_content
      ADD CONSTRAINT seo_blog_content_status_check
      CHECK (status IN ('draft', 'generating', 'validated', 'failed', 'published'));
  END IF;
END $$;

-- Backfill user_id from author_id if author_id exists and user_id is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'seo_blog_content'
      AND column_name = 'author_id'
  ) THEN
    UPDATE public.seo_blog_content
    SET user_id = author_id
    WHERE user_id IS NULL AND author_id IS NOT NULL;
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.seo_blog_content ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own blogs" ON public.seo_blog_content;
DROP POLICY IF EXISTS "Users can create blogs" ON public.seo_blog_content;
DROP POLICY IF EXISTS "Users can update own blogs" ON public.seo_blog_content;
DROP POLICY IF EXISTS "Users can delete own blogs" ON public.seo_blog_content;

CREATE POLICY "Users can view own blogs"
  ON public.seo_blog_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create blogs"
  ON public.seo_blog_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blogs"
  ON public.seo_blog_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blogs"
  ON public.seo_blog_content FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_seo_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_seo_blog_content_updated_at ON public.seo_blog_content;
CREATE TRIGGER update_seo_blog_content_updated_at
  BEFORE UPDATE ON public.seo_blog_content
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_blog_updated_at();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
