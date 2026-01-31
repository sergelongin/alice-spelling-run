-- Alice Spelling Run - Custom Words Support Migration
-- Allows parents to add custom words to the global catalog

-- =============================================================================
-- ADD is_custom COLUMN
-- Distinguishes custom words from system words
-- =============================================================================

ALTER TABLE words ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

-- =============================================================================
-- INDEX FOR PARENT CUSTOM WORDS
-- Fast lookup for a parent's custom words
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_words_created_by ON words(created_by) WHERE created_by IS NOT NULL;

-- =============================================================================
-- UPDATE RLS POLICIES FOR PARENT ACCESS
-- Parents can see system words + their own custom words
-- Parents can insert/update/delete their own custom words
-- =============================================================================

-- Drop existing select policy to replace it
DROP POLICY IF EXISTS "Anyone can read active words" ON words;

-- New select policy: see all system words (created_by IS NULL) plus own custom words
CREATE POLICY "View system and own custom words" ON words
  FOR SELECT USING (
    is_active = true AND (
      created_by IS NULL  -- System words
      OR created_by = auth.uid()  -- Own custom words
    )
  );

-- Parents can insert their own custom words
CREATE POLICY "Parents can insert custom words" ON words
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND is_custom = true
  );

-- Parents can update their own custom words
CREATE POLICY "Parents can update own custom words" ON words
  FOR UPDATE USING (
    created_by = auth.uid() AND is_custom = true
  ) WITH CHECK (
    created_by = auth.uid() AND is_custom = true
  );

-- Parents can delete their own custom words
CREATE POLICY "Parents can delete own custom words" ON words
  FOR DELETE USING (
    created_by = auth.uid() AND is_custom = true
  );
