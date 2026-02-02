-- Migration: Fix sync timestamp updates for word_progress and learning/grade_progress
-- Ensures computed values are included in incremental sync pulls
--
-- Problem:
-- When Device A plays a game and syncs, then Device B plays and syncs,
-- Device A's subsequent sync does NOT receive updated word_progress (mastery)
-- or learning_progress (points). This is because:
--
-- 1. word_progress: The computed_word_mastery view uses child_word_progress.updated_at
--    for the timestamp filter, but this timestamp is NOT updated when word_attempts
--    are inserted. The computed mastery changes, but the timestamp doesn't.
--
-- 2. learning_progress/grade_progress: While these tables have BEFORE UPDATE triggers,
--    we need to ensure they're properly configured.
--
-- Solution:
-- Add a trigger on child_word_attempts that updates child_word_progress.updated_at
-- when a new attempt is inserted for that word.

-- =============================================================================
-- TRIGGER: Update word_progress.updated_at when word_attempts inserted
-- This ensures the computed_word_mastery view returns records in incremental pulls
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_word_attempts_update_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the word_progress timestamp so it appears in incremental sync pulls
  -- This is critical because computed_word_mastery uses word_progress.updated_at
  -- for the timestamp filter, but mastery is computed from word_attempts
  UPDATE child_word_progress
  SET updated_at = NOW()
  WHERE child_id = NEW.child_id
    AND LOWER(word_text) = LOWER(NEW.word_text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS word_attempts_update_progress_trigger ON child_word_attempts;
CREATE TRIGGER word_attempts_update_progress_trigger
AFTER INSERT ON child_word_attempts
FOR EACH ROW
EXECUTE FUNCTION trigger_word_attempts_update_progress();

COMMENT ON FUNCTION trigger_word_attempts_update_progress IS
'Updates word_progress.updated_at when a word attempt is inserted. This ensures the computed mastery appears in incremental sync pulls.';

-- =============================================================================
-- VERIFY EXISTING TRIGGERS FOR learning_progress AND grade_progress
-- These triggers were created in migration 023, but let's ensure they exist
-- and use the correct function signature
-- =============================================================================

-- The trigger function for auto-updating timestamps
-- (This is the same function created in 023, but CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION update_learning_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists on child_learning_progress
DROP TRIGGER IF EXISTS learning_progress_updated_at ON child_learning_progress;
CREATE TRIGGER learning_progress_updated_at
  BEFORE UPDATE ON child_learning_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_updated_at();

-- Ensure the trigger exists on child_grade_progress
DROP TRIGGER IF EXISTS grade_progress_updated_at ON child_grade_progress;
CREATE TRIGGER grade_progress_updated_at
  BEFORE UPDATE ON child_grade_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_progress_updated_at();

-- =============================================================================
-- INDEX: Improve word_attempts lookup for the trigger
-- The trigger needs to find word_progress by (child_id, word_text) quickly
-- =============================================================================

-- This index should already exist, but ensure it does
CREATE INDEX IF NOT EXISTS idx_word_progress_child_word_lookup
  ON child_word_progress(child_id, LOWER(word_text));
