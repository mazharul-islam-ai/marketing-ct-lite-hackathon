-- Verification script for knowledge_sources RLS policies
-- Run this in Supabase SQL Editor to check if the policies are deployed correctly

-- 1. Check if RLS is enabled on knowledge_sources
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'knowledge_sources' AND schemaname = 'public';

-- 2. List all current policies on knowledge_sources table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'knowledge_sources' AND schemaname = 'public'
ORDER BY policyname;

-- 3. Count how many policies exist (should be 4 after migration)
SELECT
  COUNT(*) as policy_count,
  array_agg(policyname) as policy_names
FROM pg_policies
WHERE tablename = 'knowledge_sources' AND schemaname = 'public';

-- Expected results:
-- - RLS should be enabled (rls_enabled = true)
-- - Should have 4 policies:
--   1. "Users can view accessible sources" (SELECT)
--   2. "Users can create sources within their access" (INSERT)
--   3. "Users can update accessible sources" (UPDATE)
--   4. "Users can delete accessible sources" (DELETE)
-- - Old policy "Admins can manage sources" should NOT appear
