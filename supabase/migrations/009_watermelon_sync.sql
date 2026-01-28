-- Migration: WatermelonDB Sync RPC Functions
-- Provides pull_changes and push_changes functions for WatermelonDB sync adapter
-- Uses MAX strategy for counters to prevent data loss, LWW for mastery state

-- =============================================================================
-- PULL_CHANGES FUNCTION
-- Returns all data that has been updated since last_pulled_at for a child
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
    'timestamp', v_now
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION pull_changes(UUID, TIMESTAMPTZ) TO authenticated;


-- =============================================================================
-- PUSH_CHANGES FUNCTION
-- Processes changes from client, returns conflicts if any
-- Uses MAX strategy for counters, LWW for mastery state
-- =============================================================================

CREATE OR REPLACE FUNCTION push_changes(
  p_child_id UUID,
  p_changes JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wp_item JSON;
  gs_item JSON;
  stat_item JSON;
  cal_item JSON;
  v_now TIMESTAMPTZ := NOW();
  conflict_list JSON[] := '{}';
BEGIN
  -- Verify the child belongs to the authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: child does not belong to authenticated user';
  END IF;

  -- ==========================================================================
  -- PROCESS WORD PROGRESS
  -- Uses MAX strategy for counters (times_used, times_correct)
  -- Uses LWW for mastery state based on client_updated_at
  -- ==========================================================================

  -- Process created word_progress records
  FOR wp_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'word_progress'->'created', '[]'::json)
  )
  LOOP
    INSERT INTO child_word_progress (
      child_id, word_text, mastery_level, correct_streak,
      times_used, times_correct, last_attempt_at, next_review_at,
      introduced_at, is_active, archived_at, client_updated_at
    ) VALUES (
      p_child_id,
      wp_item->>'word_text',
      (wp_item->>'mastery_level')::smallint,
      (wp_item->>'correct_streak')::integer,
      (wp_item->>'times_used')::integer,
      (wp_item->>'times_correct')::integer,
      CASE WHEN wp_item->>'last_attempt_at' IS NOT NULL
           THEN (wp_item->>'last_attempt_at')::timestamptz END,
      COALESCE((wp_item->>'next_review_at')::timestamptz, v_now),
      CASE WHEN wp_item->>'introduced_at' IS NOT NULL
           THEN (wp_item->>'introduced_at')::timestamptz END,
      COALESCE((wp_item->>'is_active')::boolean, true),
      CASE WHEN wp_item->>'archived_at' IS NOT NULL
           THEN (wp_item->>'archived_at')::timestamptz END,
      COALESCE((wp_item->>'client_updated_at')::timestamptz, v_now)
    )
    ON CONFLICT (child_id, word_text) DO UPDATE SET
      -- LWW for mastery state - only update if client is newer
      mastery_level = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN (wp_item->>'mastery_level')::smallint
        ELSE child_word_progress.mastery_level
      END,
      correct_streak = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN (wp_item->>'correct_streak')::integer
        ELSE child_word_progress.correct_streak
      END,
      -- MAX strategy for counters - never lose progress
      times_used = GREATEST(
        (wp_item->>'times_used')::integer,
        child_word_progress.times_used
      ),
      times_correct = GREATEST(
        (wp_item->>'times_correct')::integer,
        child_word_progress.times_correct
      ),
      -- LWW for timestamps
      last_attempt_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN CASE WHEN wp_item->>'last_attempt_at' IS NOT NULL
                  THEN (wp_item->>'last_attempt_at')::timestamptz END
        ELSE child_word_progress.last_attempt_at
      END,
      next_review_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN COALESCE((wp_item->>'next_review_at')::timestamptz, child_word_progress.next_review_at)
        ELSE child_word_progress.next_review_at
      END,
      introduced_at = CASE
        WHEN child_word_progress.introduced_at IS NULL AND wp_item->>'introduced_at' IS NOT NULL
        THEN (wp_item->>'introduced_at')::timestamptz
        ELSE child_word_progress.introduced_at
      END,
      is_active = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN COALESCE((wp_item->>'is_active')::boolean, true)
        ELSE child_word_progress.is_active
      END,
      archived_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
        THEN CASE WHEN wp_item->>'archived_at' IS NOT NULL
                  THEN (wp_item->>'archived_at')::timestamptz END
        ELSE child_word_progress.archived_at
      END,
      client_updated_at = GREATEST(
        COALESCE((wp_item->>'client_updated_at')::timestamptz, v_now),
        child_word_progress.client_updated_at
      );
  END LOOP;

  -- Process updated word_progress records (same logic as created)
  FOR wp_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'word_progress'->'updated', '[]'::json)
  )
  LOOP
    UPDATE child_word_progress SET
      -- LWW for mastery state
      mastery_level = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN (wp_item->>'mastery_level')::smallint
        ELSE mastery_level
      END,
      correct_streak = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN (wp_item->>'correct_streak')::integer
        ELSE correct_streak
      END,
      -- MAX strategy for counters
      times_used = GREATEST((wp_item->>'times_used')::integer, times_used),
      times_correct = GREATEST((wp_item->>'times_correct')::integer, times_correct),
      -- LWW for other fields
      last_attempt_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN CASE WHEN wp_item->>'last_attempt_at' IS NOT NULL
                  THEN (wp_item->>'last_attempt_at')::timestamptz END
        ELSE last_attempt_at
      END,
      next_review_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN COALESCE((wp_item->>'next_review_at')::timestamptz, next_review_at)
        ELSE next_review_at
      END,
      is_active = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN COALESCE((wp_item->>'is_active')::boolean, is_active)
        ELSE is_active
      END,
      archived_at = CASE
        WHEN (wp_item->>'client_updated_at')::timestamptz > client_updated_at
        THEN CASE WHEN wp_item->>'archived_at' IS NOT NULL
                  THEN (wp_item->>'archived_at')::timestamptz END
        ELSE archived_at
      END,
      client_updated_at = GREATEST(
        COALESCE((wp_item->>'client_updated_at')::timestamptz, v_now),
        client_updated_at
      )
    WHERE child_id = p_child_id AND word_text = wp_item->>'word_text';
  END LOOP;

  -- ==========================================================================
  -- PROCESS GAME SESSIONS
  -- Insert-only, deduplicate by client_session_id
  -- ==========================================================================

  FOR gs_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'game_sessions'->'created', '[]'::json)
  )
  LOOP
    INSERT INTO child_game_sessions (
      child_id, client_session_id, mode, played_at, duration_seconds,
      words_attempted, words_correct, won, trophy, completed_words, wrong_attempts
    ) VALUES (
      p_child_id,
      gs_item->>'client_session_id',
      gs_item->>'mode',
      (gs_item->>'played_at')::timestamptz,
      (gs_item->>'duration_seconds')::integer,
      (gs_item->>'words_attempted')::integer,
      (gs_item->>'words_correct')::integer,
      (gs_item->>'won')::boolean,
      gs_item->>'trophy',
      (gs_item->'completed_words')::jsonb,
      (gs_item->'wrong_attempts')::jsonb
    )
    ON CONFLICT (child_id, client_session_id) DO NOTHING;
  END LOOP;

  -- ==========================================================================
  -- PROCESS STATISTICS
  -- Uses MAX strategy for all numeric fields
  -- ==========================================================================

  FOR stat_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'statistics'->'created', '[]'::json) ||
    COALESCE(p_changes->'statistics'->'updated', '[]'::json)
  )
  LOOP
    INSERT INTO child_statistics (
      child_id, mode, total_games_played, total_wins,
      total_words_attempted, total_words_correct,
      streak_current, streak_best, trophy_counts,
      word_accuracy, first_correct_dates, personal_bests, error_patterns,
      client_updated_at
    ) VALUES (
      p_child_id,
      stat_item->>'mode',
      (stat_item->>'total_games_played')::integer,
      (stat_item->>'total_wins')::integer,
      (stat_item->>'total_words_attempted')::integer,
      (stat_item->>'total_words_correct')::integer,
      (stat_item->>'streak_current')::integer,
      (stat_item->>'streak_best')::integer,
      COALESCE((stat_item->'trophy_counts')::jsonb, '{"platinum":0,"gold":0,"silver":0,"bronze":0,"participant":0}'::jsonb),
      (stat_item->'word_accuracy')::jsonb,
      (stat_item->'first_correct_dates')::jsonb,
      (stat_item->'personal_bests')::jsonb,
      (stat_item->'error_patterns')::jsonb,
      COALESCE((stat_item->>'client_updated_at')::timestamptz, v_now)
    )
    ON CONFLICT (child_id, mode) DO UPDATE SET
      -- MAX strategy for cumulative counts
      total_games_played = GREATEST(
        (stat_item->>'total_games_played')::integer,
        child_statistics.total_games_played
      ),
      total_wins = GREATEST(
        (stat_item->>'total_wins')::integer,
        child_statistics.total_wins
      ),
      total_words_attempted = GREATEST(
        (stat_item->>'total_words_attempted')::integer,
        child_statistics.total_words_attempted
      ),
      total_words_correct = GREATEST(
        (stat_item->>'total_words_correct')::integer,
        child_statistics.total_words_correct
      ),
      -- LWW for current streak (it resets on loss)
      streak_current = CASE
        WHEN (stat_item->>'client_updated_at')::timestamptz > child_statistics.client_updated_at
        THEN (stat_item->>'streak_current')::integer
        ELSE child_statistics.streak_current
      END,
      -- MAX for best streak
      streak_best = GREATEST(
        (stat_item->>'streak_best')::integer,
        child_statistics.streak_best
      ),
      -- Merge trophy counts with MAX per tier
      trophy_counts = jsonb_build_object(
        'platinum', GREATEST(
          COALESCE((stat_item->'trophy_counts'->>'platinum')::integer, 0),
          COALESCE((child_statistics.trophy_counts->>'platinum')::integer, 0)
        ),
        'gold', GREATEST(
          COALESCE((stat_item->'trophy_counts'->>'gold')::integer, 0),
          COALESCE((child_statistics.trophy_counts->>'gold')::integer, 0)
        ),
        'silver', GREATEST(
          COALESCE((stat_item->'trophy_counts'->>'silver')::integer, 0),
          COALESCE((child_statistics.trophy_counts->>'silver')::integer, 0)
        ),
        'bronze', GREATEST(
          COALESCE((stat_item->'trophy_counts'->>'bronze')::integer, 0),
          COALESCE((child_statistics.trophy_counts->>'bronze')::integer, 0)
        ),
        'participant', GREATEST(
          COALESCE((stat_item->'trophy_counts'->>'participant')::integer, 0),
          COALESCE((child_statistics.trophy_counts->>'participant')::integer, 0)
        )
      ),
      -- LWW for detailed stats (they're derived, so latest should be most complete)
      word_accuracy = CASE
        WHEN (stat_item->>'client_updated_at')::timestamptz > child_statistics.client_updated_at
        THEN COALESCE((stat_item->'word_accuracy')::jsonb, child_statistics.word_accuracy)
        ELSE child_statistics.word_accuracy
      END,
      first_correct_dates = CASE
        WHEN (stat_item->>'client_updated_at')::timestamptz > child_statistics.client_updated_at
        THEN COALESCE((stat_item->'first_correct_dates')::jsonb, child_statistics.first_correct_dates)
        ELSE child_statistics.first_correct_dates
      END,
      personal_bests = CASE
        WHEN (stat_item->>'client_updated_at')::timestamptz > child_statistics.client_updated_at
        THEN COALESCE((stat_item->'personal_bests')::jsonb, child_statistics.personal_bests)
        ELSE child_statistics.personal_bests
      END,
      error_patterns = CASE
        WHEN (stat_item->>'client_updated_at')::timestamptz > child_statistics.client_updated_at
        THEN COALESCE((stat_item->'error_patterns')::jsonb, child_statistics.error_patterns)
        ELSE child_statistics.error_patterns
      END,
      client_updated_at = GREATEST(
        COALESCE((stat_item->>'client_updated_at')::timestamptz, v_now),
        child_statistics.client_updated_at
      );
  END LOOP;

  -- ==========================================================================
  -- PROCESS CALIBRATION
  -- Insert-only, deduplicate by client_calibration_id
  -- ==========================================================================

  FOR cal_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'calibration'->'created', '[]'::json)
  )
  LOOP
    INSERT INTO child_calibration (
      child_id, client_calibration_id, completed_at, status,
      recommended_grade, confidence, total_time_ms, attempts_json, grade_scores_json
    ) VALUES (
      p_child_id,
      cal_item->>'client_calibration_id',
      (cal_item->>'completed_at')::timestamptz,
      cal_item->>'status',
      (cal_item->>'recommended_grade')::smallint,
      cal_item->>'confidence',
      (cal_item->>'total_time_ms')::integer,
      (cal_item->'attempts')::jsonb,
      (cal_item->'grade_scores')::jsonb
    )
    ON CONFLICT (child_id, client_calibration_id) DO NOTHING;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'synced_at', v_now,
    'conflicts', conflict_list
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION push_changes(UUID, JSON) TO authenticated;
