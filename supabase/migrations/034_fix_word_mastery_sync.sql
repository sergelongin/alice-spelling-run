-- Migration: Fix Word Mastery Sync
--
-- PROBLEM:
-- Migration 033 accidentally reverted word_progress to use stored `child_word_progress`
-- table instead of `computed_word_mastery` view. This means mastery_level, correct_streak,
-- times_used, times_correct are not syncing properly between devices.
--
-- SOLUTION:
-- 1. Restore computed_word_mastery view in pull_changes_for_parent (from migration 029)
-- 2. Remove timestamp filter for word_progress (always return fresh computed values)
-- 3. Add trigger on child_word_attempts INSERT to update stored mastery columns
--    This provides true redundancy: view AND stored values stay in sync

-- =============================================================================
-- FIX 1: TRIGGER TO UPDATE STORED MASTERY WHEN NEW ATTEMPTS ARE INSERTED
-- This ensures child_word_progress table has up-to-date mastery values
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
    updated_at = NOW()
  WHERE child_id = NEW.child_id
    AND LOWER(word_text) = LOWER(NEW.word_text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS word_attempts_update_mastery_trigger ON child_word_attempts;

-- Create the trigger
CREATE TRIGGER word_attempts_update_mastery_trigger
AFTER INSERT ON child_word_attempts
FOR EACH ROW
EXECUTE FUNCTION update_word_progress_mastery();

COMMENT ON FUNCTION update_word_progress_mastery IS
'Trigger function that recomputes and stores word mastery when a new attempt is inserted.';

-- =============================================================================
-- FIX 2: RESTORE COMPUTED WORD MASTERY IN PULL_CHANGES_FOR_PARENT
-- This was broken by migration 033 which reverted to using stored table
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
    -- No timestamp filter! Always return fresh computed mastery values
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
      -- No timestamp filter - always return fresh computed values
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
    -- Use COMPUTED learning_progress (derived from word_attempts)
    -- Always return fresh computed values (no timestamp filter)
    'learning_progress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', clp.id,
        'child_id', clp.child_id,
        'total_lifetime_points', clp.total_lifetime_points,
        'current_milestone_index', clp.current_milestone_index,
        'milestone_progress', clp.milestone_progress,
        'point_history', clp.point_history,
        'client_updated_at', clp.client_updated_at,
        'updated_at', clp.updated_at
      )), '[]'::json)
      FROM computed_child_learning_progress clp
      WHERE clp.child_id = ANY(v_child_ids)
      -- No timestamp filter! Always return fresh computed values
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

COMMENT ON FUNCTION pull_changes_for_parent IS
'Parent-level sync: pulls ALL children data. Statistics, word mastery, and learning_progress are computed from events (not stored). Word mastery uses computed_word_mastery view.';
