-- Migration: Compute introduced_at Server-Side from Word Attempts
--
-- BUG: introduced_at doesn't sync properly between devices.
-- Browser A introduces words during gameplay, but Browser B sees them as "Coming Soon"
-- because introduced_at is a client-sourced field with bidirectional sync issues.
--
-- SOLUTION: Compute introduced_at from word_attempts events.
-- If a word has been attempted, it MUST have been introduced.
-- The earliest attempt timestamp IS the introduction time.
--
-- This follows the event-sourced architecture already in use for mastery data.

-- =============================================================================
-- STEP 0: Drop dependent objects first (PostgreSQL requires this to change return type)
-- =============================================================================

-- Drop the view that depends on the function
DROP VIEW IF EXISTS computed_word_mastery;

-- Drop the function (we need to drop it to change return type)
DROP FUNCTION IF EXISTS compute_word_mastery(UUID, TEXT);

-- =============================================================================
-- STEP 1: Recreate compute_word_mastery with introduced_at in return type
-- introduced_at = timestamp of the earliest attempt for this word
-- =============================================================================

CREATE FUNCTION compute_word_mastery(
  p_child_id UUID,
  p_word_text TEXT
)
RETURNS TABLE (
  mastery_level INTEGER,
  correct_streak INTEGER,
  times_used INTEGER,
  times_correct INTEGER,
  last_attempt_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  introduced_at TIMESTAMPTZ  -- NEW: computed from earliest attempt
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_mastery INTEGER := 0;
  v_streak INTEGER := 0;
  v_times_used INTEGER := 0;
  v_times_correct INTEGER := 0;
  v_last_attempt TIMESTAMPTZ := NULL;
  v_next_review TIMESTAMPTZ := NULL;
  v_introduced_at TIMESTAMPTZ := NULL;
  attempt_record RECORD;
BEGIN
  -- Get earliest attempt timestamp (this IS the introduction time)
  SELECT MIN(attempted_at) INTO v_introduced_at
  FROM child_word_attempts
  WHERE child_id = p_child_id AND LOWER(word_text) = LOWER(p_word_text);

  -- Iterate through first attempts in chronological order
  FOR attempt_record IN
    SELECT
      was_correct,
      attempted_at
    FROM child_word_attempts
    WHERE child_id = p_child_id
      AND LOWER(word_text) = LOWER(p_word_text)
      AND (attempt_number = 1 OR attempt_number IS NULL)
    ORDER BY attempted_at ASC
  LOOP
    v_times_used := v_times_used + 1;
    v_last_attempt := attempt_record.attempted_at;

    IF attempt_record.was_correct THEN
      v_times_correct := v_times_correct + 1;
      v_mastery := LEAST(v_mastery + 1, 5);
      v_streak := v_streak + 1;
    ELSE
      v_mastery := GREATEST(v_mastery - 2, 0);
      v_streak := 0;
    END IF;
  END LOOP;

  -- Compute next_review_at based on mastery level and last attempt
  -- Uses Leitner spaced repetition intervals
  IF v_last_attempt IS NOT NULL THEN
    v_next_review := v_last_attempt +
      CASE v_mastery
        WHEN 0 THEN INTERVAL '0 days'
        WHEN 1 THEN INTERVAL '1 day'
        WHEN 2 THEN INTERVAL '3 days'
        WHEN 3 THEN INTERVAL '7 days'
        WHEN 4 THEN INTERVAL '14 days'
        WHEN 5 THEN INTERVAL '7 days'  -- Spot-check interval for mastered words
        ELSE INTERVAL '0 days'
      END;
  END IF;

  RETURN QUERY SELECT v_mastery, v_streak, v_times_used, v_times_correct, v_last_attempt, v_next_review, v_introduced_at;
END;
$$;

COMMENT ON FUNCTION compute_word_mastery IS
'Computes word mastery from attempt history. Leitner algorithm: +1 for correct, -2 for wrong (min 0, max 5). Also computes next_review_at and introduced_at from earliest attempt.';

-- =============================================================================
-- STEP 2: Recreate computed_word_mastery view with computed introduced_at
-- Uses COALESCE: computed introduced_at takes precedence, falls back to stored
-- This handles:
-- - Path 1: Child playing -> introduced_at = earliest attempt
-- - Path 2: Parent UI introduction -> introduced_at = stored value (no attempts yet)
-- =============================================================================

CREATE OR REPLACE VIEW computed_word_mastery AS
SELECT
  wp.id,
  wp.child_id,
  wp.word_text,
  -- Use computed values if available, otherwise use stored values as fallback
  COALESCE(cm.mastery_level, wp.mastery_level) AS mastery_level,
  COALESCE(cm.correct_streak, wp.correct_streak) AS correct_streak,
  COALESCE(cm.times_used, wp.times_used) AS times_used,
  COALESCE(cm.times_correct, wp.times_correct) AS times_correct,
  COALESCE(cm.last_attempt_at, wp.last_attempt_at) AS last_attempt_at,
  -- Use computed next_review_at if available, otherwise fallback to stored
  COALESCE(cm.next_review_at, wp.next_review_at) AS next_review_at,
  -- CRITICAL: Use computed introduced_at if available (word has been practiced)
  -- Otherwise fall back to stored introduced_at (explicitly introduced via parent UI but not yet practiced)
  COALESCE(cm.introduced_at, wp.introduced_at) AS introduced_at,
  -- Keep non-computed fields from word_progress
  wp.is_active,
  wp.archived_at,
  wp.updated_at
FROM child_word_progress wp
LEFT JOIN LATERAL compute_word_mastery(wp.child_id, wp.word_text) cm ON true;

COMMENT ON VIEW computed_word_mastery IS
'Derived word mastery computed from word_attempts events. Mastery level follows Leitner algorithm. introduced_at is computed from earliest attempt, with fallback to stored value for parent-introduced words.';

-- Grant access
GRANT SELECT ON computed_word_mastery TO authenticated;
GRANT EXECUTE ON FUNCTION compute_word_mastery(UUID, TEXT) TO authenticated;

-- =============================================================================
-- STEP 3: Update trigger to also sync computed introduced_at to stored table
-- This keeps stored values in sync with computed values for offline access
-- =============================================================================

CREATE OR REPLACE FUNCTION update_word_progress_mastery()
RETURNS TRIGGER AS $$
DECLARE
  v_mastery RECORD;
BEGIN
  -- Recompute mastery for this word using existing function
  SELECT * INTO v_mastery
  FROM compute_word_mastery(NEW.child_id, NEW.word_text);

  -- Update stored columns (if word_progress record exists)
  UPDATE child_word_progress SET
    mastery_level = COALESCE(v_mastery.mastery_level, 0),
    correct_streak = COALESCE(v_mastery.correct_streak, 0),
    times_used = COALESCE(v_mastery.times_used, 0),
    times_correct = COALESCE(v_mastery.times_correct, 0),
    last_attempt_at = v_mastery.last_attempt_at,
    next_review_at = v_mastery.next_review_at,
    -- CRITICAL: Also update introduced_at from computed value
    -- COALESCE preserves existing value if computed is NULL (shouldn't happen after INSERT)
    introduced_at = COALESCE(v_mastery.introduced_at, introduced_at),
    updated_at = NOW()
  WHERE child_id = NEW.child_id
    AND LOWER(word_text) = LOWER(NEW.word_text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_word_progress_mastery IS
'Trigger function that recomputes and stores word mastery (including introduced_at and next_review_at) when a new attempt is inserted.';

-- =============================================================================
-- STEP 4: Update get_computed_word_mastery function to match new return type
-- =============================================================================

CREATE OR REPLACE FUNCTION get_computed_word_mastery(p_child_id UUID)
RETURNS TABLE (
  id UUID,
  child_id UUID,
  word_text TEXT,
  mastery_level INTEGER,
  correct_streak INTEGER,
  times_used INTEGER,
  times_correct INTEGER,
  last_attempt_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  introduced_at TIMESTAMPTZ,
  is_active BOOLEAN,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    child_id,
    word_text,
    mastery_level,
    correct_streak,
    times_used,
    times_correct,
    last_attempt_at,
    next_review_at,
    introduced_at,
    is_active,
    archived_at,
    updated_at
  FROM computed_word_mastery
  WHERE child_id = p_child_id;
$$;

-- =============================================================================
-- STEP 5: Backfill existing word_progress records with computed introduced_at
-- This one-time update ensures existing data gets proper introduced_at values
-- computed from historical word_attempts
-- =============================================================================

UPDATE child_word_progress wp SET
  introduced_at = cm.introduced_at,
  updated_at = NOW()
FROM (
  SELECT cwm.id, cwm.introduced_at
  FROM computed_word_mastery cwm
  WHERE cwm.introduced_at IS NOT NULL
) cm
WHERE wp.id = cm.id
  AND wp.introduced_at IS NULL  -- Only update records missing introduced_at
  AND cm.introduced_at IS NOT NULL;

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled introduced_at for % word_progress records', updated_count;
END $$;
