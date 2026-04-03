-- Allow title to be null during blog generation
-- Edge function inserts the row first, then updates with the generated title
ALTER TABLE public.seo_blog_content
  ALTER COLUMN title DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
