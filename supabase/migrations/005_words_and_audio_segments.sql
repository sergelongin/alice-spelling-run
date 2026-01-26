-- Alice Spelling Run - Words and Audio Segments Migration
-- Adds words table and segment_type to audio_pronunciations

-- =============================================================================
-- WORDS TABLE
-- Master word bank stored in Supabase (migrated from local files)
-- =============================================================================

CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  word_normalized TEXT NOT NULL UNIQUE,  -- Prevents duplicates
  definition TEXT NOT NULL,
  example TEXT,  -- Example sentence
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 3 AND 6),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_words_grade ON words(grade_level);
CREATE INDEX IF NOT EXISTS idx_words_normalized ON words(word_normalized);
CREATE INDEX IF NOT EXISTS idx_words_active_grade ON words(is_active, grade_level) WHERE is_active = true;

-- Enable RLS
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- Anyone can read active words (for gameplay)
CREATE POLICY "Anyone can read active words" ON words
  FOR SELECT USING (is_active = true);

-- Super admins have full access
CREATE POLICY "Super admin can insert words" ON words
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update words" ON words
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete words" ON words
  FOR DELETE USING (public.is_super_admin());

-- =============================================================================
-- AUDIO PRONUNCIATIONS - ADD SEGMENT SUPPORT
-- Each word can have 3 segments: word, definition, sentence
-- =============================================================================

-- Add segment_type column (default 'word' for existing records)
ALTER TABLE audio_pronunciations
ADD COLUMN IF NOT EXISTS segment_type TEXT NOT NULL DEFAULT 'word'
CHECK (segment_type IN ('word', 'definition', 'sentence'));

-- Add text_content column to store what was spoken
ALTER TABLE audio_pronunciations
ADD COLUMN IF NOT EXISTS text_content TEXT;

-- Update unique constraint to include segment_type
-- First, drop existing constraint
ALTER TABLE audio_pronunciations
DROP CONSTRAINT IF EXISTS audio_pronunciations_word_normalized_voice_id_emotion_speed_key;

-- Create new unique constraint including segment_type
ALTER TABLE audio_pronunciations
ADD CONSTRAINT audio_pronunciations_unique_segment
UNIQUE (word_normalized, voice_id, segment_type, emotion, speed);

-- Update index to include segment_type
DROP INDEX IF EXISTS idx_audio_word_voice;
CREATE INDEX IF NOT EXISTS idx_audio_word_voice_segment
ON audio_pronunciations(word_normalized, voice_id, segment_type);

-- =============================================================================
-- HELPER FUNCTION: Normalize word for consistent lookups
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_word(word TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(word, '[^a-zA-Z]', '', 'g')));
$$;
