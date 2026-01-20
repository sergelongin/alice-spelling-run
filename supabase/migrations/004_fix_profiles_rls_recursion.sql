-- Fix: Remove infinite recursion in profiles RLS policy
--
-- The "Super admins can read all profiles" policy causes infinite recursion:
-- 1. User queries profiles table
-- 2. Policy checks: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
-- 3. That SELECT on profiles triggers the same policy check
-- 4. Infinite recursion → Error 42P17
--
-- Solution: Use auth.jwt() to check role from the JWT token instead of querying profiles.
-- This requires the role to be in the JWT claims, which we set via a custom access token hook.
--
-- For now, we'll use a simpler approach: create a security definer function that
-- bypasses RLS to check if the current user is a super admin.

-- Step 1: Create a helper function that bypasses RLS to check super admin status
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Make sure the function is owned by postgres for proper RLS bypass
ALTER FUNCTION public.is_super_admin() OWNER TO postgres;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Step 2: Drop the problematic policy
DROP POLICY IF EXISTS "Super admins can read all profiles" ON profiles;

-- Step 3: Recreate the policy using our helper function (no recursion!)
CREATE POLICY "Super admins can read all profiles" ON profiles
  FOR SELECT USING (
    public.is_super_admin()
  );
