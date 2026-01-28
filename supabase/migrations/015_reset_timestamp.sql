-- Migration: Add Reset Timestamp for Sync Detection
-- When a parent resets a child's progress, we need to signal this to other clients.
-- The sync protocol only returns *updated* records; hard-deleted records return nothing.
-- This timestamp allows clients to detect resets and clear their local data.

-- =============================================================================
-- ADD RESET TIMESTAMP TO CHILDREN TABLE
-- =============================================================================

ALTER TABLE children ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ;

-- =============================================================================
-- UPDATE RESET_CHILD_PROGRESS TO SET TIMESTAMP
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_child_progress(p_child_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id UUID;
  v_word_progress_count INTEGER;
  v_statistics_count INTEGER;
  v_game_sessions_count INTEGER;
  v_calibration_count INTEGER;
  v_sync_metadata_count INTEGER;
  v_sync_status_count INTEGER;
BEGIN
  -- Validate that the authenticated user owns this child
  SELECT parent_id INTO v_parent_id
  FROM children
  WHERE id = p_child_id;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Child not found: %', p_child_id;
  END IF;

  IF v_parent_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this child profile';
  END IF;

  -- Delete word progress
  DELETE FROM child_word_progress WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_word_progress_count = ROW_COUNT;

  -- Delete statistics
  DELETE FROM child_statistics WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_statistics_count = ROW_COUNT;

  -- Delete game sessions
  DELETE FROM child_game_sessions WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_game_sessions_count = ROW_COUNT;

  -- Delete calibration records
  DELETE FROM child_calibration WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_calibration_count = ROW_COUNT;

  -- Delete sync metadata
  DELETE FROM child_sync_metadata WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_sync_metadata_count = ROW_COUNT;

  -- Delete sync status
  DELETE FROM child_sync_status WHERE child_id = p_child_id;
  GET DIAGNOSTICS v_sync_status_count = ROW_COUNT;

  -- Set the reset timestamp so other clients detect the reset during sync
  UPDATE children SET last_reset_at = NOW() WHERE id = p_child_id;

  -- Return deletion counts for verification
  RETURN json_build_object(
    'success', true,
    'child_id', p_child_id,
    'deleted', json_build_object(
      'word_progress', v_word_progress_count,
      'statistics', v_statistics_count,
      'game_sessions', v_game_sessions_count,
      'calibration', v_calibration_count,
      'sync_metadata', v_sync_metadata_count,
      'sync_status', v_sync_status_count
    )
  );
END;
$$;

-- =============================================================================
-- UPDATE PULL_CHANGES TO INCLUDE LAST_RESET_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION pull_changes(
  p_child_id UUID,
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
BEGIN
  -- Verify the child belongs to the authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: child does not belong to authenticated user';
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
      WHERE wp.child_id = p_child_id
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
      WHERE gs.child_id = p_child_id
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
      WHERE s.child_id = p_child_id
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
      WHERE c.child_id = p_child_id
        AND (p_last_pulled_at IS NULL OR c.created_at > p_last_pulled_at)
    ),
    'timestamp', v_now,
    'last_reset_at', (SELECT last_reset_at FROM children WHERE id = p_child_id)
  ) INTO result;

  RETURN result;
END;
$$;

-- Comment for documentation
COMMENT ON COLUMN children.last_reset_at IS 'Timestamp of the last progress reset. Used by sync protocol to detect when clients need to clear their local data.';
