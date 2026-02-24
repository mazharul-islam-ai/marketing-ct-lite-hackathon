-- =====================================================
-- DEMO CREDENTIALS SETUP
-- =====================================================
-- Creates demo user accounts and roles for testing/demo purposes
-- Demo Admin: demo.admin@sjinnovation.com (super_admin)
-- Demo User: demo.user@sjinnovation.com (user)
--
-- IMPORTANT: After running this migration, you MUST:
-- 1. Create auth users in Supabase Dashboard → Authentication → Users:
--    - Email: demo.admin@sjinnovation.com, Password: demo-password-123
--    - Email: demo.user@sjinnovation.com, Password: demo-password-123
-- 2. Copy the UUIDs of the created auth users
-- 3. Update the INSERT statements below with the correct UUIDs
--    (Replace ADMIN_UUID_HERE and USER_UUID_HERE)
--
-- This is necessary because Supabase Auth assigns UUIDs when users are created,
-- and those UUIDs must match the IDs in the application users table for the
-- auth system to work correctly.

-- 1. Create user profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role)
);

-- 3. Insert demo user profiles
INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  status
) VALUES
  ('500b4a7f-4c4a-429e-a307-0601568c8525', 'demo.admin@sjinnovation.com', 'Demo', 'Admin', 'active'),
  ('b31fefe1-d78f-4160-85d3-298bccf9e02e', 'demo.user@sjinnovation.com', 'Demo', 'User', 'active')
ON CONFLICT (email) DO NOTHING;

-- 4. Insert user roles
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('500b4a7f-4c4a-429e-a307-0601568c8525', 'super_admin'),
  ('b31fefe1-d78f-4160-85d3-298bccf9e02e', 'user')
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
