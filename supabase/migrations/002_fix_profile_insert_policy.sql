-- Fix: Add INSERT policy for profiles table
-- This allows the handle_new_user() trigger to create profile rows during signup
--
-- The trigger runs as SECURITY DEFINER but RLS still applies to the table operations.
-- Without an INSERT policy, new user signups fail with "Database error saving new user"

-- Option 1: Allow service role (used by Supabase auth internals)
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Option 2: Allow users to create their own profile (belt and suspenders)
-- This handles cases where the insert happens in user context
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
