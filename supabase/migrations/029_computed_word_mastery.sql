-- Migration: Computed Word Mastery from Word Attempts
-- Creates a function that computes word mastery from word_attempts events.
-- This enables event-sourced word progress where mastery is computed from attempts.
--
-- Mastery Algorithm (Leitner-based):
-- - First try correct: mastery level +1 (max 5)
-- - First try wrong: mastery level -2 (min 0)
-- - Streak: consecutive correct first attempts
--
-- Benefits:
-- - Word mastery is always consistent across devices
-- - No conflict resolution needed (attempts are INSERT-only)
-- - Multi-device consistency (same computation everywhere)

-- =============================================================================
-- FUNCTION: Compute mastery for a single word
-- Uses PL/pgSQL to iterate through attempts and calculate Leitner progression
-- =============================================================================

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
  FOR attempt_record IN
    SELECT DISTINCT ON (session_id)
      was_correct,
      attempted_at
    FROM child_word_attempts
    WHERE child_id = p_child_id
      AND LOWER(word_text) = LOWER(p_word_text)
      AND (attempt_number = 1 OR attempt_number IS NULL)
    ORDER BY session_id, attempted_at ASC
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

-- =============================================================================
-- VIEW: Computed Word Mastery
-- Joins word_progress metadata with computed mastery from word_attempts
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
  -- Keep non-computed fields from word_progress
  wp.next_review_at,
  wp.introduced_at,
  wp.is_active,
  wp.archived_at,
  wp.updated_at
FROM child_word_progress wp
LEFT JOIN LATERAL compute_word_mastery(wp.child_id, wp.word_text) cm ON true;

-- Grant access
GRANT SELECT ON computed_word_mastery TO authenticated;
GRANT EXECUTE ON FUNCTION compute_word_mastery(UUID, TEXT) TO authenticated;

-- =============================================================================
-- FUNCTION: Get computed word mastery for a child
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

GRANT EXECUTE ON FUNCTION get_computed_word_mastery(UUID) TO authenticated;

-- =============================================================================
-- UPDATE pull_changes_for_parent TO USE COMPUTED WORD MASTERY
-- Returns computed mastery values merged with stored word_progress metadata
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
    -- Use COMPUTED word mastery (derived from word_attempts)
    'word_progress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', cwm.id,
        'child_id', cwm.child_id,
        'word_text', cwm.word_text,
        'mastery_level', cwm.mastery_level,
        'correct_streak', cwm.correct_streak,
        'times_used', cwm.times_used,
        'times_correct', cwm.times_correct,
        'last_attempt_at', cwm.last_attempt_at,
        'next_review_at', cwm.next_review_at,
        'introduced_at', cwm.introduced_at,
        'is_active', cwm.is_active,
        'archived_at', cwm.archived_at,
        'updated_at', cwm.updated_at
      )), '[]'::json)
      FROM computed_word_mastery cwm
      WHERE cwm.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR cwm.updated_at > p_last_pulled_at)
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
    -- Use COMPUTED statistics (derived from game_sessions)
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
    'last_reset_at', (
      SELECT MAX(last_reset_at)
      FROM children
      WHERE id = ANY(v_child_ids)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON VIEW computed_word_mastery IS
'Derived word mastery computed from word_attempts events. Mastery level follows Leitner algorithm.';

COMMENT ON FUNCTION compute_word_mastery IS
'Computes mastery for a single word by iterating through first attempts chronologically.';

COMMENT ON FUNCTION pull_changes_for_parent IS
'Parent-level sync: pulls ALL children data. Statistics and word mastery are computed from events.';
