-- Alice Spelling Run - Word Catalog Sync
-- RPC function for pulling word catalog to local WatermelonDB cache
-- This is separate from per-child sync - it's a global catalog

-- =============================================================================
-- ADD is_custom COLUMN TO WORDS TABLE (if not exists)
-- =============================================================================

-- Add is_custom column to distinguish system words from parent-created words
ALTER TABLE words
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;

-- Add updated_at column for incremental sync
ALTER TABLE words
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for sync queries
CREATE INDEX IF NOT EXISTS idx_words_updated_at ON words(updated_at);
CREATE INDEX IF NOT EXISTS idx_words_is_custom ON words(is_custom);
CREATE INDEX IF NOT EXISTS idx_words_created_by ON words(created_by) WHERE created_by IS NOT NULL;

-- =============================================================================
-- TRIGGER: Auto-update updated_at on row changes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_words_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS words_updated_at_trigger ON words;
CREATE TRIGGER words_updated_at_trigger
  BEFORE UPDATE ON words
  FOR EACH ROW
  EXECUTE FUNCTION update_words_updated_at();

-- =============================================================================
-- RPC FUNCTION: Pull Word Catalog
-- Returns system words + optionally parent's custom words
-- Supports incremental sync via p_last_synced_at parameter
-- =============================================================================

CREATE OR REPLACE FUNCTION pull_word_catalog(
  p_parent_id UUID DEFAULT NULL,
  p_last_synced_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'words', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', w.id,
          'word', w.word,
          'word_normalized', w.word_normalized,
          'definition', w.definition,
          'example', w.example,
          'grade_level', w.grade_level,
          'is_custom', w.is_custom,
          'created_by', w.created_by,
          'updated_at', w.updated_at
        )
      )
      FROM words w
      WHERE w.is_active = true
        -- Include system words OR this parent's custom words
        AND (
          w.is_custom = false
          OR (p_parent_id IS NOT NULL AND w.created_by = p_parent_id)
        )
        -- Incremental sync: only return words updated since last sync
        AND (p_last_synced_at IS NULL OR w.updated_at > p_last_synced_at)
    ), '[]'::json),
    'deleted_ids', COALESCE((
      -- For soft-deleted words (is_active = false), return their IDs
      -- so the client can remove them from local cache
      SELECT json_agg(w.id)
      FROM words w
      WHERE w.is_active = false
        AND (
          w.is_custom = false
          OR (p_parent_id IS NOT NULL AND w.created_by = p_parent_id)
        )
        AND (p_last_synced_at IS NULL OR w.updated_at > p_last_synced_at)
    ), '[]'::json),
    'timestamp', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION pull_word_catalog(UUID, TIMESTAMPTZ) TO authenticated;

-- =============================================================================
-- RLS POLICY: Allow parents to insert their own custom words
-- =============================================================================

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Parents can insert custom words" ON words;
CREATE POLICY "Parents can insert custom words" ON words
  FOR INSERT
  WITH CHECK (
    is_custom = true
    AND created_by = auth.uid()
  );

-- Parents can update/delete their own custom words
DROP POLICY IF EXISTS "Parents can update own custom words" ON words;
CREATE POLICY "Parents can update own custom words" ON words
  FOR UPDATE
  USING (is_custom = true AND created_by = auth.uid())
  WITH CHECK (is_custom = true AND created_by = auth.uid());

DROP POLICY IF EXISTS "Parents can delete own custom words" ON words;
CREATE POLICY "Parents can delete own custom words" ON words
  FOR DELETE
  USING (is_custom = true AND created_by = auth.uid());
