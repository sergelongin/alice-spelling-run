-- Migration: Computed Statistics from Game Sessions
-- Creates views/functions that derive statistics from game_sessions events.
-- This enables event-sourced statistics where the server computes aggregates
-- from INSERT-only events, eliminating bidirectional sync complexity.
--
-- Benefits:
-- - Statistics are always consistent (computed from source events)
-- - No conflict resolution needed (events are INSERT-only)
-- - Multi-device consistency (same computation on all devices)

-- =============================================================================
-- COMPUTED STATISTICS VIEW
-- Derives statistics from child_game_sessions for each child and mode
-- =============================================================================

CREATE OR REPLACE VIEW computed_child_statistics AS
WITH
-- Base aggregates per child/mode
base_stats AS (
  SELECT
    child_id,
    -- Normalize savannah-quick to savannah for stats
    CASE WHEN mode = 'savannah-quick' THEN 'savannah' ELSE mode END AS mode,
    COUNT(*) AS total_games_played,
    COUNT(*) FILTER (WHERE won = true) AS total_wins,
    COALESCE(SUM(words_attempted), 0) AS total_words_attempted,
    COALESCE(SUM(words_correct), 0) AS total_words_correct,
    -- Trophy counts as JSONB
    jsonb_build_object(
      'platinum', COUNT(*) FILTER (WHERE trophy = 'platinum'),
      'gold', COUNT(*) FILTER (WHERE trophy = 'gold'),
      'silver', COUNT(*) FILTER (WHERE trophy = 'silver'),
      'bronze', COUNT(*) FILTER (WHERE trophy = 'bronze'),
      'participant', COUNT(*) FILTER (WHERE trophy = 'participant')
    ) AS trophy_counts
  FROM child_game_sessions
  GROUP BY child_id, CASE WHEN mode = 'savannah-quick' THEN 'savannah' ELSE mode END
),

-- Calculate streaks using window functions
-- A streak breaks when there's a loss
sessions_with_streaks AS (
  SELECT
    child_id,
    CASE WHEN mode = 'savannah-quick' THEN 'savannah' ELSE mode END AS mode,
    played_at,
    won,
    -- Create streak groups: each loss starts a new group
    SUM(CASE WHEN won = false THEN 1 ELSE 0 END) OVER (
      PARTITION BY child_id, CASE WHEN mode = 'savannah-quick' THEN 'savannah' ELSE mode END
      ORDER BY played_at
    ) AS loss_group
  FROM child_game_sessions
),

streak_lengths AS (
  SELECT
    child_id,
    mode,
    loss_group,
    -- Count consecutive wins in each group (before a loss)
    COUNT(*) FILTER (WHERE won = true) AS streak_length,
    MAX(played_at) AS group_end_time
  FROM sessions_with_streaks
  GROUP BY child_id, mode, loss_group
),

streak_stats AS (
  SELECT
    child_id,
    mode,
    -- Best streak is the max streak length ever
    MAX(streak_length) AS streak_best,
    -- Current streak is the streak from the most recent group (if it ends with wins)
    -- We need to check if the last session was a win
    FIRST_VALUE(streak_length) OVER (
      PARTITION BY child_id, mode
      ORDER BY group_end_time DESC
    ) AS last_group_streak
  FROM streak_lengths
  GROUP BY child_id, mode, streak_length, group_end_time
),

-- Check if the most recent session was a win (to determine current streak)
last_session_per_mode AS (
  SELECT DISTINCT ON (child_id, mode)
    child_id,
    CASE WHEN mode = 'savannah-quick' THEN 'savannah' ELSE mode END AS mode,
    won AS last_session_won
  FROM child_game_sessions
  ORDER BY child_id, mode, played_at DESC
),

final_streaks AS (
  SELECT
    ss.child_id,
    ss.mode,
    MAX(ss.streak_best) AS streak_best,
    -- Current streak is 0 if last session was a loss
    CASE
      WHEN ls.last_session_won = true THEN MAX(ss.last_group_streak)
      ELSE 0
    END AS streak_current
  FROM streak_stats ss
  LEFT JOIN last_session_per_mode ls ON ss.child_id = ls.child_id AND ss.mode = ls.mode
  GROUP BY ss.child_id, ss.mode, ls.last_session_won
)

-- Final computed statistics
SELECT
  -- Generate a deterministic ID from child_id and mode for consistency
  md5(bs.child_id::text || '-' || bs.mode)::uuid AS id,
  bs.child_id,
  bs.mode,
  bs.total_games_played,
  bs.total_wins,
  bs.total_words_attempted::integer,
  bs.total_words_correct::integer,
  COALESCE(fs.streak_current, 0)::integer AS streak_current,
  COALESCE(fs.streak_best, 0)::integer AS streak_best,
  bs.trophy_counts,
  NOW() AS updated_at
FROM base_stats bs
LEFT JOIN final_streaks fs ON bs.child_id = fs.child_id AND bs.mode = fs.mode;

-- Grant access to authenticated users
GRANT SELECT ON computed_child_statistics TO authenticated;

-- =============================================================================
-- FUNCTION: Get computed statistics for a child
-- Returns computed stats in the same format as the child_statistics table
-- =============================================================================

CREATE OR REPLACE FUNCTION get_computed_statistics(p_child_id UUID)
RETURNS SETOF computed_child_statistics
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM computed_child_statistics WHERE child_id = p_child_id;
$$;

GRANT EXECUTE ON FUNCTION get_computed_statistics(UUID) TO authenticated;

-- =============================================================================
-- FUNCTION: Get computed statistics for all children of a parent
-- Used by parent-level sync to pull all children's stats at once
-- =============================================================================

CREATE OR REPLACE FUNCTION get_computed_statistics_for_parent(p_parent_id UUID)
RETURNS SETOF computed_child_statistics
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.*
  FROM computed_child_statistics cs
  JOIN children c ON cs.child_id = c.id
  WHERE c.parent_id = p_parent_id;
$$;

GRANT EXECUTE ON FUNCTION get_computed_statistics_for_parent(UUID) TO authenticated;

-- =============================================================================
-- UPDATE pull_changes_for_parent TO USE COMPUTED STATISTICS
-- Modify the existing function to return computed stats instead of stored stats
-- =============================================================================

CREATE OR REPLACE FUNCTION pull_changes_for_parent(
  p_parent_id UUID,
  p_last_pulled_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_now TIMESTAMPTZ := NOW();
  v_child_ids UUID[];
BEGIN
  -- Verify the parent is the authenticated user
  IF p_parent_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only pull changes for your own children';
  END IF;

  -- Get all child IDs for this parent
  SELECT ARRAY_AGG(id) INTO v_child_ids
  FROM children
  WHERE parent_id = p_parent_id;

  -- If no children, return empty arrays
  IF v_child_ids IS NULL OR array_length(v_child_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'word_progress', '[]'::json,
      'game_sessions', '[]'::json,
      'statistics', '[]'::json,
      'calibration', '[]'::json,
      'word_attempts', '[]'::json,
      'learning_progress', '[]'::json,
      'grade_progress', '[]'::json,
      'timestamp', v_now,
      'last_reset_at', NULL
    );
  END IF;

  SELECT json_build_object(
    'word_progress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', wp.id,
        'child_id', wp.child_id,
        'word_text', wp.word_text,
        'mastery_level', wp.mastery_level,
        'correct_streak', wp.correct_streak,
        'times_used', wp.times_used,
        'times_correct', wp.times_correct,
        'last_attempt_at', wp.last_attempt_at,
        'next_review_at', wp.next_review_at,
        'introduced_at', wp.introduced_at,
        'is_active', wp.is_active,
        'archived_at', wp.archived_at,
        'updated_at', wp.updated_at
      )), '[]'::json)
      FROM child_word_progress wp
      WHERE wp.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR wp.updated_at > p_last_pulled_at)
    ),
    'game_sessions', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', gs.id,
        'child_id', gs.child_id,
        'client_session_id', gs.client_session_id,
        'mode', gs.mode,
        'played_at', gs.played_at,
        'duration_seconds', gs.duration_seconds,
        'words_attempted', gs.words_attempted,
        'words_correct', gs.words_correct,
        'won', gs.won,
        'trophy', gs.trophy,
        'completed_words', gs.completed_words,
        'wrong_attempts', gs.wrong_attempts,
        'created_at', gs.created_at
      )), '[]'::json)
      FROM child_game_sessions gs
      WHERE gs.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR gs.created_at > p_last_pulled_at)
    ),
    -- Use COMPUTED statistics instead of stored statistics
    -- Always return all computed stats (they're derived fresh each time)
    'statistics', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', cs.id,
        'child_id', cs.child_id,
        'mode', cs.mode,
        'total_games_played', cs.total_games_played,
        'total_wins', cs.total_wins,
        'total_words_attempted', cs.total_words_attempted,
        'total_words_correct', cs.total_words_correct,
        'streak_current', cs.streak_current,
        'streak_best', cs.streak_best,
        'trophy_counts', cs.trophy_counts,
        'updated_at', cs.updated_at
      )), '[]'::json)
      FROM computed_child_statistics cs
      WHERE cs.child_id = ANY(v_child_ids)
    ),
    'calibration', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', c.id,
        'child_id', c.child_id,
        'client_calibration_id', c.client_calibration_id,
        'completed_at', c.completed_at,
        'status', c.status,
        'recommended_grade', c.recommended_grade,
        'confidence', c.confidence,
        'total_time_ms', c.total_time_ms,
        'attempts_json', c.attempts_json,
        'grade_scores_json', c.grade_scores_json,
        'created_at', c.created_at
      )), '[]'::json)
      FROM child_calibration c
      WHERE c.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR c.created_at > p_last_pulled_at)
    ),
    'word_attempts', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', wa.id,
        'child_id', wa.child_id,
        'word_text', wa.word_text,
        'client_attempt_id', wa.client_attempt_id,
        'attempt_number', wa.attempt_number,
        'typed_text', wa.typed_text,
        'was_correct', wa.was_correct,
        'mode', wa.mode,
        'time_ms', wa.time_ms,
        'attempted_at', wa.attempted_at,
        'session_id', wa.session_id,
        'created_at', wa.created_at
      )), '[]'::json)
      FROM child_word_attempts wa
      WHERE wa.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR wa.created_at > p_last_pulled_at)
    ),
    'learning_progress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', lp.id,
        'child_id', lp.child_id,
        'total_lifetime_points', lp.total_lifetime_points,
        'current_milestone_index', lp.current_milestone_index,
        'milestone_progress', lp.milestone_progress,
        'point_history', lp.point_history,
        'client_updated_at', lp.client_updated_at,
        'updated_at', lp.updated_at
      )), '[]'::json)
      FROM child_learning_progress lp
      WHERE lp.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR lp.updated_at > p_last_pulled_at)
    ),
    'grade_progress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', gp.id,
        'child_id', gp.child_id,
        'grade_level', gp.grade_level,
        'total_points', gp.total_points,
        'current_milestone_index', gp.current_milestone_index,
        'words_mastered', gp.words_mastered,
        'first_point_at', gp.first_point_at,
        'last_activity_at', gp.last_activity_at,
        'client_updated_at', gp.client_updated_at,
        'updated_at', gp.updated_at
      )), '[]'::json)
      FROM child_grade_progress gp
      WHERE gp.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR gp.updated_at > p_last_pulled_at)
    ),
    'timestamp', v_now,
    -- Get the most recent reset timestamp across all children
    'last_reset_at', (
      SELECT MAX(last_reset_at)
      FROM children
      WHERE id = ANY(v_child_ids)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON VIEW computed_child_statistics IS
'Derived statistics computed from game_sessions events. Used for event-sourced sync.';

COMMENT ON FUNCTION pull_changes_for_parent IS
'Parent-level sync: pulls ALL children data in one query. Statistics are computed from game_sessions (not stored).';
