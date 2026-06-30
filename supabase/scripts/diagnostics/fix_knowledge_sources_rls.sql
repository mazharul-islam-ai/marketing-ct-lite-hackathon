-- Quick fix for knowledge_sources RLS policies
-- Run this directly in your Supabase SQL editor if migrations are taking too long

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can manage sources" ON public.knowledge_sources;

-- Create new granular policies for knowledge_sources

-- SELECT policy: Allow users to see sources they have access to
DROP POLICY IF EXISTS "Users can view accessible sources" ON public.knowledge_sources;
CREATE POLICY "Users can view accessible sources"
  ON public.knowledge_sources
  FOR SELECT
  USING (
    -- Company-wide sources: Only admins
    (brand_id IS NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
    OR
    -- Brand sources: Users with brand access OR admins
    (brand_id IS NOT NULL AND (
      user_has_brand_access(auth.uid(), brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  );

-- INSERT policy: Allow users to create sources for brands they have access to
DROP POLICY IF EXISTS "Users can create sources within their access" ON public.knowledge_sources;
CREATE POLICY "Users can create sources within their access"
  ON public.knowledge_sources
  FOR INSERT
  WITH CHECK (
    -- Company-wide sources: Only admins can create
    (brand_id IS NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
    OR
    -- Brand sources: Users with brand access can create
    (brand_id IS NOT NULL AND (
      user_has_brand_access(auth.uid(), brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  );

-- UPDATE policy: Allow users to update sources they have access to
DROP POLICY IF EXISTS "Users can update accessible sources" ON public.knowledge_sources;
CREATE POLICY "Users can update accessible sources"
  ON public.knowledge_sources
  FOR UPDATE
  USING (
    -- Company-wide sources: Only admins
    (brand_id IS NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
    OR
    -- Brand sources: Users with brand access OR admins
    (brand_id IS NOT NULL AND (
      user_has_brand_access(auth.uid(), brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  )
  WITH CHECK (
    -- Same check for the new values
    (brand_id IS NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
    OR
    (brand_id IS NOT NULL AND (
      user_has_brand_access(auth.uid(), brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  );

-- DELETE policy: Allow users to delete sources they have access to
DROP POLICY IF EXISTS "Users can delete accessible sources" ON public.knowledge_sources;
CREATE POLICY "Users can delete accessible sources"
  ON public.knowledge_sources
  FOR DELETE
  USING (
    -- Company-wide sources: Only admins
    (brand_id IS NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
    OR
    -- Brand sources: Users with brand access OR admins
    (brand_id IS NOT NULL AND (
      user_has_brand_access(auth.uid(), brand_id)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    ))
  );
