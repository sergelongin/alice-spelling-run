-- Migration: Computed Learning Progress from Word Attempts
-- Derives total_lifetime_points from events, eliminating bidirectional sync issues.
--
-- ARCHITECTURE CHANGE:
-- Before (problematic):
-- - Points stored in child_learning_progress table
-- - Bidirectional sync with timestamp filtering
-- - Deadlock when local diverges from server
--
-- After (event-sourced):
-- - Points computed from child_word_attempts
-- - Pull-only (like statistics) - no push needed
-- - Always consistent across devices
--
-- POINT CALCULATION:
-- - First try correct (attempt_number = 1 or NULL): 10 points each
-- - Retry correct (attempt_number > 1): 5 points each
--
-- VALIDATION (against actual production data):
-- - Uses MAX of computed vs stored to never lose data
-- - If stored is higher (has bonus points), keep stored
-- - If computed is higher (stored was incomplete), recover points

-- =============================================================================
-- COMPUTED LEARNING PROGRESS VIEW
-- Derives total_lifetime_points from child_word_attempts events
-- =============================================================================

CREATE OR REPLACE VIEW computed_child_learning_progress AS
WITH
-- Points from correct word attempts
-- - First try (attempt_number = 1 or NULL): 10 points each
-- - Retry (attempt_number > 1): 5 points each
attempt_points AS (
  SELECT
    child_id,
    COUNT(*) FILTER (WHERE was_correct = true AND (attempt_number = 1 OR attempt_number IS NULL)) * 10 AS first_try_points,
    COUNT(*) FILTER (WHERE was_correct = true AND attempt_number > 1) * 5 AS retry_points
  FROM child_word_attempts
  GROUP BY child_id
),

-- Use MAX of computed vs stored to never lose data
-- - If stored is higher (has bonus points), keep stored
-- - If computed is higher (stored was incomplete), recover points
final AS (
  SELECT
    c.id AS child_id,
    GREATEST(
      COALESCE(ap.first_try_points, 0) + COALESCE(ap.retry_points, 0),
      COALESCE(lp.total_lifetime_points, 0)
    ) AS total_lifetime_points,
    COALESCE(lp.current_milestone_index, 0) AS current_milestone_index,
    COALESCE(lp.milestone_progress, 0) AS milestone_progress,
    COALESCE(lp.point_history, '[]'::jsonb) AS point_history,
    COALESCE(lp.client_updated_at, NOW()) AS client_updated_at,
    NOW() AS updated_at
  FROM children c
  LEFT JOIN attempt_points ap ON ap.child_id = c.id
  LEFT JOIN child_learning_progress lp ON lp.child_id = c.id
)

SELECT
  -- Generate deterministic ID from child_id for WatermelonDB reconciliation
  md5(child_id::text || '-learning')::uuid AS id,
  child_id,
  total_lifetime_points,
  current_milestone_index,
  milestone_progress,
  point_history,
  client_updated_at,
  updated_at
FROM final;

-- Grant access to authenticated users
GRANT SELECT ON computed_child_learning_progress TO authenticated;

COMMENT ON VIEW computed_child_learning_progress IS
'Derived learning progress computed from word_attempts events. Uses MAX of computed vs stored points to never lose data.';

-- =============================================================================
-- UPDATE PULL_CHANGES_FOR_PARENT TO USE COMPUTED LEARNING_PROGRESS
-- Modify the existing function to return computed learning progress instead of stored
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
    -- Use COMPUTED learning_progress instead of stored
    -- Always return fresh computed values (no timestamp filter - computed on-demand)
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
'Parent-level sync: pulls ALL children data in one query. Statistics and learning_progress are computed from events (not stored).';

-- =============================================================================
-- UPDATE PUSH_CHANGES TO REMOVE LEARNING_PROGRESS PROCESSING
-- learning_progress is now pull-only (computed server-side from word_attempts)
-- =============================================================================

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
  -- and learning_progress points (computed in computed_child_learning_progress view)
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
  -- LEARNING_PROGRESS IS NOT PUSHED
  -- learning_progress.total_lifetime_points is computed server-side from
  -- word_attempts via computed_child_learning_progress view
  -- Any learning_progress in p_changes are ignored (legacy clients may still send them)
  -- ==========================================================================

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
    'note', 'Statistics, word mastery, and learning_progress points are computed server-side from events'
  );
END;
$$;

COMMENT ON FUNCTION push_changes IS
'Event-sourced push: accepts events (game_sessions, word_attempts, calibration) and metadata (word_progress, grade_progress). Statistics, word mastery, and learning_progress points are computed server-side.';
