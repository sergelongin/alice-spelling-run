-- Migration: Fix Word Mastery Computation
--
-- BUG: DISTINCT ON (session_id) treats all NULL session_ids as equal,
-- collapsing ALL attempts into ONE row. Since session_id is never set
-- (always NULL), mastery is always computed as 1 regardless of attempts.
--
-- FIX: Remove DISTINCT ON clause. Each recorded attempt is already a
-- unique event with a unique client_attempt_id. The attempt_number filter
-- (attempt_number = 1 OR attempt_number IS NULL) handles retry filtering.

CREATE OR REPLACE FUNCTION compute_word_mastery(
  p_child_id UUID,
  p_word_text TEXT
)
RETURNS TABLE (
  mastery_level INTEGER,
  correct_streak INTEGER,
  times_used INTEGER,
  times_correct INTEGER,
  last_attempt_at TIMESTAMPTZ
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
  attempt_record RECORD;
BEGIN
  -- Iterate through first attempts in chronological order
  -- REMOVED: DISTINCT ON (session_id) - it collapsed all NULL session_ids
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

  RETURN QUERY SELECT v_mastery, v_streak, v_times_used, v_times_correct, v_last_attempt;
END;
$$;

COMMENT ON FUNCTION compute_word_mastery IS
'Computes word mastery from attempt history. Leitner algorithm: +1 for correct, -2 for wrong (min 0, max 5).';
