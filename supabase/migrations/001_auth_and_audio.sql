-- Alice Spelling Run - Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- =============================================================================
-- PROFILES TABLE
-- Extends auth.users with role and display name
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('super_admin', 'parent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Super admins can read all profiles
CREATE POLICY "Super admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Allow profile creation during signup (for trigger and service role)
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- CHILDREN TABLE
-- Child profiles belonging to parent users
-- =============================================================================

CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level >= 3 AND grade_level <= 6),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Parents can read their own children
CREATE POLICY "Parents can read own children" ON children
  FOR SELECT USING (auth.uid() = parent_id);

-- Parents can insert children
CREATE POLICY "Parents can insert children" ON children
  FOR INSERT WITH CHECK (auth.uid() = parent_id);

-- Parents can update their own children
CREATE POLICY "Parents can update own children" ON children
  FOR UPDATE USING (auth.uid() = parent_id);

-- Parents can delete their own children
CREATE POLICY "Parents can delete own children" ON children
  FOR DELETE USING (auth.uid() = parent_id);

-- =============================================================================
-- AUDIO PRONUNCIATIONS TABLE
-- Metadata for pre-generated audio files stored in Supabase Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS audio_pronunciations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  word_normalized TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  emotion TEXT DEFAULT 'enthusiastic',
  speed DECIMAL(3,2) DEFAULT 1.0,
  storage_path TEXT NOT NULL UNIQUE,
  file_size_bytes INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (word_normalized, voice_id, emotion, speed)
);

-- Enable RLS
ALTER TABLE audio_pronunciations ENABLE ROW LEVEL SECURITY;

-- Anyone can read audio pronunciations (public access for playback)
CREATE POLICY "Anyone can read audio pronunciations" ON audio_pronunciations
  FOR SELECT USING (true);

-- Only super admins can insert audio pronunciations
CREATE POLICY "Super admins can insert audio" ON audio_pronunciations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super admins can update audio pronunciations
CREATE POLICY "Super admins can update audio" ON audio_pronunciations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Only super admins can delete audio pronunciations
CREATE POLICY "Super admins can delete audio" ON audio_pronunciations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create index for fast word lookups
CREATE INDEX IF NOT EXISTS idx_audio_word_voice ON audio_pronunciations(word_normalized, voice_id);

-- =============================================================================
-- TRIGGER: Auto-create profile on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    'parent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- STORAGE: Pronunciations bucket
-- Run this in the Storage section of Supabase dashboard, or via SQL:
-- =============================================================================

-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pronunciations', 'pronunciations', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pronunciations bucket

-- Allow public read access to audio files
CREATE POLICY "Public read access for pronunciations"
ON storage.objects FOR SELECT
USING (bucket_id = 'pronunciations');

-- Only super admins can upload audio files
CREATE POLICY "Super admins can upload pronunciations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pronunciations' AND
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Only super admins can update audio files
CREATE POLICY "Super admins can update pronunciations"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pronunciations' AND
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Only super admins can delete audio files
CREATE POLICY "Super admins can delete pronunciations"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pronunciations' AND
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- =============================================================================
-- CREATE FIRST SUPER ADMIN
-- After running the migration and signing up with your admin account,
-- run this to make your account a super admin:
-- =============================================================================

-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your-admin-email@example.com';
