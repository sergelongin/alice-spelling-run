-- Migration: Parent-level sync
-- Creates pull_changes_for_parent() that pulls ALL children's data in one query.
-- This replaces the per-child pull_changes() approach, eliminating the need for
-- per-child timestamp tracking in localStorage.
--
-- Benefits:
-- - Uses WatermelonDB's native lastPulledAt (one timestamp for all)
-- - Simpler sync logic (one pull/push instead of N)
-- - Reduces API calls from N to 1 per sync cycle

-- =============================================================================
-- PULL_CHANGES_FOR_PARENT FUNCTION
-- Returns all data for ALL children of a parent since last_pulled_at
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
    'statistics', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', s.id,
        'child_id', s.child_id,
        'mode', s.mode,
        'total_games_played', s.total_games_played,
        'total_wins', s.total_wins,
        'total_words_attempted', s.total_words_attempted,
        'total_words_correct', s.total_words_correct,
        'streak_current', s.streak_current,
        'streak_best', s.streak_best,
        'trophy_counts', s.trophy_counts,
        'word_accuracy', s.word_accuracy,
        'first_correct_dates', s.first_correct_dates,
        'personal_bests', s.personal_bests,
        'error_patterns', s.error_patterns,
        'updated_at', s.updated_at
      )), '[]'::json)
      FROM child_statistics s
      WHERE s.child_id = ANY(v_child_ids)
        AND (p_last_pulled_at IS NULL OR s.updated_at > p_last_pulled_at)
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION pull_changes_for_parent(UUID, TIMESTAMPTZ) TO authenticated;

-- =============================================================================
-- UPDATE PUSH_CHANGES TO ACCEPT PARENT_ID
-- The existing push_changes already uses record's child_id for each item,
-- but we'll add an alias function for consistency.
-- Actually, push_changes already works at parent level because:
-- - Each record contains its own child_id
-- - The RPC validates parent owns each child_id
-- So we just keep the existing push_changes as-is.
-- =============================================================================

COMMENT ON FUNCTION pull_changes_for_parent IS
'Parent-level sync: pulls ALL children data in one query. Used with WatermelonDB native lastPulledAt.';
