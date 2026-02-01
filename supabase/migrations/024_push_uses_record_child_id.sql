-- Migration: Push changes using record's child_id
-- This migration modifies push_changes to use each record's child_id instead of the p_child_id parameter.
-- This allows syncing ALL children's data in one push operation and fixes the bug where
-- filterChangesByChildId() incorrectly filtered out valid records.
--
-- Security: Each child_id is validated to belong to the authenticated parent.

CREATE OR REPLACE FUNCTION push_changes(
  p_child_id UUID,  -- Kept for backward compatibility, but RPC now uses record's child_id
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
  wa_item JSON;
  lp_item JSON;
  gp_item JSON;
  record_child_id UUID;
  v_now TIMESTAMPTZ := NOW();
  conflict_list JSON[] := '{}';
BEGIN
  -- Note: We no longer verify p_child_id upfront since records can be for any of the parent's children.
  -- Instead, we validate each record's child_id as we process it.

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
    -- Extract and validate child_id from the record
    record_child_id := (wp_item->>'child_id')::uuid;

    -- Verify parent owns this child
    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push word_progress for child %', record_child_id;
    END IF;

    INSERT INTO child_word_progress (
      child_id, word_text, mastery_level, correct_streak,
      times_used, times_correct, last_attempt_at, next_review_at,
      introduced_at, is_active, archived_at, client_updated_at
    ) VALUES (
      record_child_id,  -- Use record's child_id, not parameter
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
    record_child_id := (wp_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot update word_progress for child %', record_child_id;
    END IF;

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
    WHERE child_id = record_child_id AND word_text = wp_item->>'word_text';
  END LOOP;

  -- ==========================================================================
  -- PROCESS GAME SESSIONS
  -- Insert-only, deduplicate by client_session_id
  -- ==========================================================================

  FOR gs_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'game_sessions'->'created', '[]'::json)
  )
  LOOP
    record_child_id := (gs_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push game_session for child %', record_child_id;
    END IF;

    INSERT INTO child_game_sessions (
      child_id, client_session_id, mode, played_at, duration_seconds,
      words_attempted, words_correct, won, trophy, completed_words, wrong_attempts
    ) VALUES (
      record_child_id,
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
  -- FIX: Cast to jsonb before using || operator
  -- ==========================================================================

  FOR stat_item IN SELECT * FROM jsonb_array_elements(
    COALESCE((p_changes->'statistics'->'created')::jsonb, '[]'::jsonb) ||
    COALESCE((p_changes->'statistics'->'updated')::jsonb, '[]'::jsonb)
  )
  LOOP
    record_child_id := (stat_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push statistics for child %', record_child_id;
    END IF;

    INSERT INTO child_statistics (
      child_id, mode, total_games_played, total_wins,
      total_words_attempted, total_words_correct,
      streak_current, streak_best, trophy_counts,
      word_accuracy, first_correct_dates, personal_bests, error_patterns,
      client_updated_at
    ) VALUES (
      record_child_id,
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
    record_child_id := (cal_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push calibration for child %', record_child_id;
    END IF;

    INSERT INTO child_calibration (
      child_id, client_calibration_id, completed_at, status,
      recommended_grade, confidence, total_time_ms, attempts_json, grade_scores_json
    ) VALUES (
      record_child_id,
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

  -- ==========================================================================
  -- PROCESS WORD ATTEMPTS
  -- Insert-only, deduplicate by client_attempt_id (same pattern as game_sessions)
  -- ==========================================================================

  FOR wa_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'word_attempts'->'created', '[]'::json)
  )
  LOOP
    record_child_id := (wa_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push word_attempt for child %', record_child_id;
    END IF;

    INSERT INTO child_word_attempts (
      child_id, word_text, client_attempt_id, attempt_number,
      typed_text, was_correct, mode, time_ms, attempted_at, session_id
    ) VALUES (
      record_child_id,
      wa_item->>'word_text',
      wa_item->>'client_attempt_id',
      (wa_item->>'attempt_number')::integer,
      wa_item->>'typed_text',
      (wa_item->>'was_correct')::boolean,
      wa_item->>'mode',
      (wa_item->>'time_ms')::integer,
      COALESCE((wa_item->>'attempted_at')::timestamptz, v_now),
      wa_item->>'session_id'
    )
    ON CONFLICT (child_id, client_attempt_id) DO NOTHING;
  END LOOP;

  -- ==========================================================================
  -- PROCESS LEARNING PROGRESS
  -- Uses MAX strategy for total_lifetime_points (never lose points)
  -- Uses LWW for milestone state based on client_updated_at
  -- ==========================================================================

  FOR lp_item IN SELECT * FROM jsonb_array_elements(
    COALESCE((p_changes->'learning_progress'->'created')::jsonb, '[]'::jsonb) ||
    COALESCE((p_changes->'learning_progress'->'updated')::jsonb, '[]'::jsonb)
  )
  LOOP
    record_child_id := (lp_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push learning_progress for child %', record_child_id;
    END IF;

    INSERT INTO child_learning_progress (
      child_id, total_lifetime_points, current_milestone_index, milestone_progress,
      point_history, client_updated_at
    ) VALUES (
      record_child_id,
      (lp_item->>'total_lifetime_points')::integer,
      (lp_item->>'current_milestone_index')::smallint,
      COALESCE((lp_item->>'milestone_progress')::integer, 0),
      COALESCE((lp_item->'point_history')::jsonb, '[]'::jsonb),
      COALESCE((lp_item->>'client_updated_at')::timestamptz, v_now)
    )
    ON CONFLICT (child_id) DO UPDATE SET
      -- MAX strategy for total points - never lose progress
      total_lifetime_points = GREATEST(
        COALESCE((lp_item->>'total_lifetime_points')::integer, 0),
        child_learning_progress.total_lifetime_points
      ),
      -- LWW for milestone state
      current_milestone_index = CASE
        WHEN (lp_item->>'client_updated_at')::timestamptz > child_learning_progress.client_updated_at
        THEN (lp_item->>'current_milestone_index')::smallint
        ELSE child_learning_progress.current_milestone_index
      END,
      milestone_progress = CASE
        WHEN (lp_item->>'client_updated_at')::timestamptz > child_learning_progress.client_updated_at
        THEN COALESCE((lp_item->>'milestone_progress')::integer, child_learning_progress.milestone_progress)
        ELSE child_learning_progress.milestone_progress
      END,
      -- LWW for point history (most recent events are relevant)
      point_history = CASE
        WHEN (lp_item->>'client_updated_at')::timestamptz > child_learning_progress.client_updated_at
        THEN COALESCE((lp_item->'point_history')::jsonb, child_learning_progress.point_history)
        ELSE child_learning_progress.point_history
      END,
      client_updated_at = GREATEST(
        COALESCE((lp_item->>'client_updated_at')::timestamptz, v_now),
        child_learning_progress.client_updated_at
      );
  END LOOP;

  -- ==========================================================================
  -- PROCESS GRADE PROGRESS
  -- Uses MAX strategy for total_points and words_mastered (never lose progress)
  -- Uses LWW for milestone state, MIN/COALESCE for first_point_at, MAX for last_activity_at
  -- ==========================================================================

  FOR gp_item IN SELECT * FROM jsonb_array_elements(
    COALESCE((p_changes->'grade_progress'->'created')::jsonb, '[]'::jsonb) ||
    COALESCE((p_changes->'grade_progress'->'updated')::jsonb, '[]'::jsonb)
  )
  LOOP
    record_child_id := (gp_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push grade_progress for child %', record_child_id;
    END IF;

    INSERT INTO child_grade_progress (
      child_id, grade_level, total_points, current_milestone_index, words_mastered,
      first_point_at, last_activity_at, client_updated_at
    ) VALUES (
      record_child_id,
      (gp_item->>'grade_level')::smallint,
      COALESCE((gp_item->>'total_points')::integer, 0),
      COALESCE((gp_item->>'current_milestone_index')::smallint, 0),
      COALESCE((gp_item->>'words_mastered')::integer, 0),
      CASE WHEN gp_item->>'first_point_at' IS NOT NULL
           THEN (gp_item->>'first_point_at')::timestamptz END,
      CASE WHEN gp_item->>'last_activity_at' IS NOT NULL
           THEN (gp_item->>'last_activity_at')::timestamptz END,
      COALESCE((gp_item->>'client_updated_at')::timestamptz, v_now)
    )
    ON CONFLICT (child_id, grade_level) DO UPDATE SET
      -- MAX strategy for counters - never lose progress
      total_points = GREATEST(
        COALESCE((gp_item->>'total_points')::integer, 0),
        child_grade_progress.total_points
      ),
      words_mastered = GREATEST(
        COALESCE((gp_item->>'words_mastered')::integer, 0),
        child_grade_progress.words_mastered
      ),
      -- LWW for milestone state
      current_milestone_index = CASE
        WHEN (gp_item->>'client_updated_at')::timestamptz > child_grade_progress.client_updated_at
        THEN COALESCE((gp_item->>'current_milestone_index')::smallint, child_grade_progress.current_milestone_index)
        ELSE child_grade_progress.current_milestone_index
      END,
      -- MIN/COALESCE for first_point_at - keep earliest timestamp
      first_point_at = CASE
        WHEN child_grade_progress.first_point_at IS NULL
        THEN CASE WHEN gp_item->>'first_point_at' IS NOT NULL
                  THEN (gp_item->>'first_point_at')::timestamptz END
        WHEN gp_item->>'first_point_at' IS NOT NULL
        THEN LEAST(
          (gp_item->>'first_point_at')::timestamptz,
          child_grade_progress.first_point_at
        )
        ELSE child_grade_progress.first_point_at
      END,
      -- MAX for last_activity_at - most recent activity wins
      last_activity_at = GREATEST(
        CASE WHEN gp_item->>'last_activity_at' IS NOT NULL
             THEN (gp_item->>'last_activity_at')::timestamptz END,
        child_grade_progress.last_activity_at
      ),
      client_updated_at = GREATEST(
        COALESCE((gp_item->>'client_updated_at')::timestamptz, v_now),
        child_grade_progress.client_updated_at
      );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'synced_at', v_now,
    'conflicts', conflict_list
  );
END;
$$;

-- Grant execute to authenticated users (idempotent)
GRANT EXECUTE ON FUNCTION push_changes(UUID, JSON) TO authenticated;
