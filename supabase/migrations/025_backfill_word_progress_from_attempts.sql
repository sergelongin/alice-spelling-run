-- Migration: Backfill word_progress statistics from word_attempts
--
-- Problem: The backfill script 021 created word_attempts records from game sessions,
-- but did NOT update the corresponding word_progress records. This causes:
-- - Words showing "Waiting" status despite having attempts
-- - Words showing 0/5 mastery despite 100% accuracy
-- - last_attempt_at being NULL despite practice history
--
-- Solution: Aggregate word_attempts and update word_progress accordingly

-- Update word_progress from aggregated word_attempts data
-- Only updates records where times_used = 0 or NULL (preserves already-good data)
UPDATE child_word_progress wp
SET
  times_used = GREATEST(wp.times_used, agg.total_attempts),
  times_correct = GREATEST(wp.times_correct, agg.correct_attempts),
  -- Calculate mastery_level: simple ratio approach capped at 5
  -- If mostly correct, increase mastery; if mostly wrong, keep low
  mastery_level = CASE
    WHEN agg.total_attempts = 0 THEN wp.mastery_level
    WHEN agg.accuracy >= 0.8 THEN LEAST(5, GREATEST(wp.mastery_level, 3 + FLOOR(agg.accuracy * 2)))
    WHEN agg.accuracy >= 0.6 THEN LEAST(5, GREATEST(wp.mastery_level, 2))
    WHEN agg.accuracy >= 0.4 THEN LEAST(5, GREATEST(wp.mastery_level, 1))
    ELSE GREATEST(wp.mastery_level, 0)
  END,
  -- Set introduced_at if not already set (word was practiced, so it's introduced)
  introduced_at = COALESCE(wp.introduced_at, agg.first_attempt_at),
  -- Update last_attempt_at to the most recent attempt
  last_attempt_at = GREATEST(wp.last_attempt_at, agg.last_attempt_at),
  updated_at = NOW()
FROM (
  SELECT
    child_id,
    LOWER(word_text) as word_text_lower,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE was_correct) as correct_attempts,
    COUNT(*) FILTER (WHERE NOT was_correct) as wrong_attempts,
    CASE
      WHEN COUNT(*) > 0
      THEN COUNT(*) FILTER (WHERE was_correct)::float / COUNT(*)
      ELSE 0
    END as accuracy,
    MIN(attempted_at) as first_attempt_at,
    MAX(attempted_at) as last_attempt_at
  FROM child_word_attempts
  GROUP BY child_id, LOWER(word_text)
) agg
WHERE wp.child_id = agg.child_id
  AND LOWER(wp.word_text) = agg.word_text_lower
  AND (wp.times_used = 0 OR wp.times_used IS NULL);

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfill complete: % word_progress records updated from word_attempts', updated_count;
END $$;
