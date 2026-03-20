-- Add missing additional_notes column to seo_blog_content
ALTER TABLE public.seo_blog_content
  ADD COLUMN IF NOT EXISTS additional_notes TEXT;
