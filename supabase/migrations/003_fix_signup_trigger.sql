-- Fix: Update signup trigger to properly bypass RLS
--
-- The handle_new_user() function needs SECURITY DEFINER + SET search_path = public
-- for reliable RLS bypass in Supabase. Without SET search_path, the trigger can
-- fail with "Database error saving new user" (500 error) during signup.
--
-- Root cause: SECURITY DEFINER alone doesn't guarantee RLS bypass in Supabase.
-- The function owner must be postgres and search_path must be explicitly set.

-- Recreate the trigger function with proper security settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    'parent'
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (re-signup attempt or race condition), ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'handle_new_user trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the function owner is postgres for proper RLS bypass
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Note: The trigger itself doesn't need to be recreated since it already exists
-- and points to the same function. The CREATE OR REPLACE above updates it in place.
