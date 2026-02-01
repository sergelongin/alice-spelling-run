-- Migration: Backfill learning_progress from game_sessions
--
-- Problem: Learning progress (points) may have been lost due to sync reset bug.
-- The bug would delete local learning_progress and return empty changeset,
-- meaning points were never synced to server.
--
-- Solution: Estimate points from game_sessions data.
-- Point values from src/types/levelMap.ts:
--   correct (first try): 10 points
--   retry: 5 points
--   level_up: 15 points
--   mastery: 50 points
--
-- We can't know exact first-try vs retry ratio from game_sessions alone,
-- so we use words_correct * 8 (conservative average).

-- Step 1: Insert missing learning_progress records
-- Creates records for children who have game_sessions but no learning_progress
INSERT INTO child_learning_progress (child_id, total_lifetime_points, current_milestone_index, milestone_progress, client_updated_at)
SELECT DISTINCT
  gs.child_id,
  0,  -- Will be updated in step 2
  0,
  0,
  NOW()
FROM child_game_sessions gs
WHERE NOT EXISTS (
  SELECT 1 FROM child_learning_progress lp WHERE lp.child_id = gs.child_id
)
ON CONFLICT (child_id) DO NOTHING;

-- Step 2: Update learning_progress with estimated points from game_sessions
-- Uses MAX strategy to never lose existing progress
UPDATE child_learning_progress lp
SET
  total_lifetime_points = GREATEST(
    lp.total_lifetime_points,
    agg.estimated_points
  ),
  -- Calculate milestone index based on points (simplified - just for basic progress display)
  -- Milestones from levelMapMilestones.ts: 0, 50, 100, 175, 275, 400, 550, 750, 1000
  current_milestone_index = CASE
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 1000 THEN 8
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 750 THEN 7
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 550 THEN 6
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 400 THEN 5
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 275 THEN 4
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 175 THEN 3
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 100 THEN 2
    WHEN GREATEST(lp.total_lifetime_points, agg.estimated_points) >= 50 THEN 1
    ELSE 0
  END,
  updated_at = NOW()
FROM (
  SELECT
    child_id,
    -- Estimate: 8 points per correct word (conservative average of 5-10)
    SUM(words_correct) * 8 as estimated_points
  FROM child_game_sessions
  GROUP BY child_id
) agg
WHERE lp.child_id = agg.child_id
  AND lp.total_lifetime_points < agg.estimated_points;

-- Step 3: Backfill grade_progress similarly
-- Insert missing grade_progress records for each grade played
INSERT INTO child_grade_progress (
  child_id, grade_level, total_points, current_milestone_index, words_mastered,
  first_point_at, last_activity_at, client_updated_at
)
SELECT DISTINCT ON (wp.child_id, COALESCE(w.grade_level, 4))
  wp.child_id,
  COALESCE(w.grade_level, 4) as grade_level,  -- Default to grade 4 if unknown
  0,
  0,
  0,
  MIN(wp.introduced_at) OVER (PARTITION BY wp.child_id, COALESCE(w.grade_level, 4)),
  MAX(wp.last_attempt_at) OVER (PARTITION BY wp.child_id, COALESCE(w.grade_level, 4)),
  NOW()
FROM child_word_progress wp
LEFT JOIN words w ON LOWER(wp.word_text) = LOWER(w.word)
WHERE NOT EXISTS (
  SELECT 1 FROM child_grade_progress gp
  WHERE gp.child_id = wp.child_id
    AND gp.grade_level = COALESCE(w.grade_level, 4)
)
ON CONFLICT (child_id, grade_level) DO NOTHING;

-- Step 4: Update grade_progress with aggregated word mastery counts
UPDATE child_grade_progress gp
SET
  words_mastered = GREATEST(gp.words_mastered, agg.mastered_count),
  total_points = GREATEST(gp.total_points, agg.estimated_points),
  first_point_at = COALESCE(gp.first_point_at, agg.first_activity),
  last_activity_at = GREATEST(gp.last_activity_at, agg.last_activity),
  updated_at = NOW()
FROM (
  SELECT
    wp.child_id,
    COALESCE(w.grade_level, 4) as grade_level,
    COUNT(*) FILTER (WHERE wp.mastery_level >= 5) as mastered_count,
    SUM(wp.times_correct) * 8 as estimated_points,
    MIN(wp.introduced_at) as first_activity,
    MAX(wp.last_attempt_at) as last_activity
  FROM child_word_progress wp
  LEFT JOIN words w ON LOWER(wp.word_text) = LOWER(w.word)
  GROUP BY wp.child_id, COALESCE(w.grade_level, 4)
) agg
WHERE gp.child_id = agg.child_id
  AND gp.grade_level = agg.grade_level;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Learning progress backfill complete';
END $$;
