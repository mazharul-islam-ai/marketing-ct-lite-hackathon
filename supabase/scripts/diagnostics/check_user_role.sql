-- Diagnostic query to check user roles for pritesh@sjinnovation.com
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if user exists in auth.users
SELECT
  'User in auth.users' as check_name,
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'pritesh@sjinnovation.com';

-- 2. Check if user exists in public.users
SELECT
  'User in public.users' as check_name,
  id,
  email,
  first_name,
  last_name,
  status
FROM public.users
WHERE email = 'pritesh@sjinnovation.com';

-- 3. Check user roles in user_roles table
SELECT
  'User roles' as check_name,
  ur.id as role_id,
  ur.user_id,
  u.email,
  ur.role,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'pritesh@sjinnovation.com';

-- 4. Check all roles available in the system
SELECT
  'Available app_role values' as check_name,
  enumlabel as role_name
FROM pg_enum
WHERE enumtypid = 'public.app_role'::regtype
ORDER BY enumsortorder;

-- 5. If the user doesn't have super_admin role, this will add it
-- Uncomment the lines below to fix the issue:

/*
-- Get the user ID first
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'pritesh@sjinnovation.com';

  IF v_user_id IS NOT NULL THEN
    -- Delete any existing roles for this user
    DELETE FROM public.user_roles WHERE user_id = v_user_id;

    -- Insert super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'super_admin'::app_role);

    RAISE NOTICE 'Successfully set super_admin role for pritesh@sjinnovation.com';
  ELSE
    RAISE NOTICE 'User not found: pritesh@sjinnovation.com';
  END IF;
END $$;
*/
