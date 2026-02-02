-- Migration: Simplified push_changes for Event-Sourced Architecture
-- This migration updates push_changes to reflect the new event-sourced architecture:
-- - Statistics are NOT pushed (computed from game_sessions)
-- - Word progress mastery fields are NOT pushed (computed from word_attempts)
-- - Only metadata and events are pushed
--
-- Event Tables (INSERT-only, no conflict resolution):
-- - game_sessions: Game events
-- - word_attempts: Spelling attempt events
-- - calibration: Calibration events
--
-- Metadata Tables (simplified conflict resolution):
-- - word_progress: Only word metadata (introduced_at, is_active, archived_at)
-- - learning_progress: Milestone state
-- - grade_progress: Per-grade progress

CREATE OR REPLACE FUNCTION push_changes(
  p_child_id UUID,  -- Kept for backward compatibility
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
  cal_item JSON;
  wa_item JSON;
  lp_item JSON;
  gp_item JSON;
  record_child_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- ==========================================================================
  -- PROCESS WORD PROGRESS (Metadata Only)
  -- Mastery fields (mastery_level, correct_streak, times_used, times_correct,
  -- last_attempt_at) are computed from word_attempts - not accepted here.
  -- ==========================================================================

  FOR wp_item IN SELECT * FROM json_array_elements(
    COALESCE(p_changes->'word_progress'->'created', '[]'::json)
  )
  LOOP
    record_child_id := (wp_item->>'child_id')::uuid;

    IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: cannot push word_progress for child %', record_child_id;
    END IF;

    INSERT INTO child_word_progress (
      child_id, word_text,
      -- Mastery fields initialized to 0 (will be computed from word_attempts)
      mastery_level, correct_streak, times_used, times_correct,
      -- Metadata fields from client
      next_review_at, introduced_at, is_active, archived_at, client_updated_at
    ) VALUES (
      record_child_id,
      wp_item->>'word_text',
      -- Initialize mastery to 0 (computed_word_mastery view will provide actual values)
      0, 0, 0, 0,
      COALESCE((wp_item->>'next_review_at')::timestamptz, v_now),
      CASE WHEN wp_item->>'introduced_at' IS NOT NULL
           THEN (wp_item->>'introduced_at')::timestamptz END,
      COALESCE((wp_item->>'is_active')::boolean, true),
      CASE WHEN wp_item->>'archived_at' IS NOT NULL
           THEN (wp_item->>'archived_at')::timestamptz END,
      COALESCE((wp_item->>'client_updated_at')::timestamptz, v_now)
    )
    ON CONFLICT (child_id, word_text) DO UPDATE SET
      -- Only update metadata fields, not mastery (mastery computed from word_attempts)
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
        THEN COALESCE((wp_item->>'is_active')::boolean, child_word_progress.is_active)
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
      -- Only update metadata fields
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
  -- PROCESS GAME SESSIONS (INSERT-only events)
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
  -- STATISTICS ARE NOT PUSHED
  -- Statistics are computed server-side from game_sessions via computed_child_statistics view
  -- Any statistics in p_changes are ignored (legacy clients may still send them)
  -- ==========================================================================

  -- ==========================================================================
  -- PROCESS CALIBRATION (INSERT-only events)
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
  -- PROCESS WORD ATTEMPTS (INSERT-only events)
  -- This is the source of truth for word mastery (computed in computed_word_mastery view)
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
  -- Uses MAX for points, LWW for milestone state
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
      total_lifetime_points = GREATEST(
        COALESCE((lp_item->>'total_lifetime_points')::integer, 0),
        child_learning_progress.total_lifetime_points
      ),
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
  -- Uses MAX for points/mastered, LWW for milestone state
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
      total_points = GREATEST(
        COALESCE((gp_item->>'total_points')::integer, 0),
        child_grade_progress.total_points
      ),
      words_mastered = GREATEST(
        COALESCE((gp_item->>'words_mastered')::integer, 0),
        child_grade_progress.words_mastered
      ),
      current_milestone_index = CASE
        WHEN (gp_item->>'client_updated_at')::timestamptz > child_grade_progress.client_updated_at
        THEN COALESCE((gp_item->>'current_milestone_index')::smallint, child_grade_progress.current_milestone_index)
        ELSE child_grade_progress.current_milestone_index
      END,
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
    'architecture', 'event-sourced',
    'note', 'Statistics and word mastery are computed server-side from events'
  );
END;
$$;

COMMENT ON FUNCTION push_changes IS
'Event-sourced push: accepts events (game_sessions, word_attempts, calibration) and metadata (word_progress, learning_progress, grade_progress). Statistics and word mastery are computed server-side.';
