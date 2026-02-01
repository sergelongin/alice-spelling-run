-- Migration: Backfill child_word_attempts from child_game_sessions JSONB
-- Reconstructs individual word attempt records from historical game session data
--
-- Source data in child_game_sessions:
--   completed_words: [{ "word": string, "attempts": number, "timeMs"?: number }]
--   wrong_attempts:  [{ "word": string, "attempt": string }]
--
-- Reconstruction logic:
--   For each word in completed_words:
--     - If attempts = 1: Create 1 correct attempt
--     - If attempts > 1: Create (attempts-1) wrong attempts + 1 correct attempt
--   Match wrong attempts by word order in wrong_attempts array

-- =============================================================================
-- BACKFILL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION backfill_word_attempts_from_sessions()
RETURNS TABLE(sessions_processed INTEGER, attempts_created INTEGER, errors_encountered INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_completed_word JSONB;
  v_wrong_attempt JSONB;
  v_word_text TEXT;
  v_attempts_count INTEGER;
  v_time_ms INTEGER;
  v_attempt_num INTEGER;
  v_client_attempt_id TEXT;
  v_wrong_attempts_for_word JSONB[];
  v_wrong_idx INTEGER;
  v_typed_text TEXT;
  v_word_occurrence INTEGER;
  v_sessions_processed INTEGER := 0;
  v_attempts_created INTEGER := 0;
  v_errors_encountered INTEGER := 0;
  v_word_counts JSONB;
BEGIN
  -- Process each game session that has completed_words data
  FOR v_session IN
    SELECT
      gs.id,
      gs.child_id,
      gs.client_session_id,
      gs.mode,
      gs.played_at,
      gs.completed_words,
      gs.wrong_attempts
    FROM child_game_sessions gs
    WHERE gs.completed_words IS NOT NULL
      AND jsonb_array_length(gs.completed_words) > 0
    ORDER BY gs.played_at ASC
  LOOP
    BEGIN
      -- Reset word occurrence tracking for this session
      v_word_counts := '{}'::JSONB;

      -- Process each completed word in the session
      FOR v_completed_word IN SELECT * FROM jsonb_array_elements(v_session.completed_words)
      LOOP
        v_word_text := v_completed_word->>'word';
        v_attempts_count := COALESCE((v_completed_word->>'attempts')::INTEGER, 1);
        v_time_ms := (v_completed_word->>'timeMs')::INTEGER;

        -- Track occurrence of this word within the session (for duplicate words)
        v_word_occurrence := COALESCE((v_word_counts->>v_word_text)::INTEGER, 0) + 1;
        v_word_counts := v_word_counts || jsonb_build_object(v_word_text, v_word_occurrence);

        -- Find wrong attempts for this word (in order from wrong_attempts array)
        v_wrong_attempts_for_word := ARRAY[]::JSONB[];
        IF v_session.wrong_attempts IS NOT NULL THEN
          FOR v_wrong_attempt IN SELECT * FROM jsonb_array_elements(v_session.wrong_attempts)
          LOOP
            IF v_wrong_attempt->>'word' = v_word_text THEN
              v_wrong_attempts_for_word := v_wrong_attempts_for_word || v_wrong_attempt;
            END IF;
          END LOOP;
        END IF;

        -- Generate attempt records
        FOR v_attempt_num IN 1..v_attempts_count
        LOOP
          -- Generate unique client_attempt_id for deduplication
          v_client_attempt_id := 'backfill-' || v_session.client_session_id || '-' ||
                                  v_word_text || '-' || v_word_occurrence || '-' || v_attempt_num;

          IF v_attempt_num < v_attempts_count THEN
            -- This is a wrong attempt
            v_wrong_idx := v_attempt_num;  -- 1-indexed

            -- Get typed text from wrong_attempts array if available
            IF v_wrong_idx <= array_length(v_wrong_attempts_for_word, 1) THEN
              v_typed_text := v_wrong_attempts_for_word[v_wrong_idx]->>'attempt';
            ELSE
              -- No matching wrong attempt data, use empty string
              v_typed_text := '';
            END IF;

            -- Insert wrong attempt
            INSERT INTO child_word_attempts (
              child_id,
              word_text,
              client_attempt_id,
              attempt_number,
              typed_text,
              was_correct,
              mode,
              time_ms,
              attempted_at,
              session_id,
              created_at
            ) VALUES (
              v_session.child_id,
              v_word_text,
              v_client_attempt_id,
              v_attempt_num,
              COALESCE(v_typed_text, ''),
              FALSE,
              COALESCE(v_session.mode, 'meadow'),
              NULL,  -- time_ms only known for final attempt
              v_session.played_at,
              v_session.client_session_id,
              NOW()
            )
            ON CONFLICT (child_id, client_attempt_id) DO NOTHING;

            -- Check if insert happened
            IF FOUND THEN
              v_attempts_created := v_attempts_created + 1;
            END IF;

          ELSE
            -- This is the final (correct) attempt
            INSERT INTO child_word_attempts (
              child_id,
              word_text,
              client_attempt_id,
              attempt_number,
              typed_text,
              was_correct,
              mode,
              time_ms,
              attempted_at,
              session_id,
              created_at
            ) VALUES (
              v_session.child_id,
              v_word_text,
              v_client_attempt_id,
              v_attempt_num,
              v_word_text,  -- Correct attempt = typed the word correctly
              TRUE,
              COALESCE(v_session.mode, 'meadow'),
              v_time_ms,
              v_session.played_at,
              v_session.client_session_id,
              NOW()
            )
            ON CONFLICT (child_id, client_attempt_id) DO NOTHING;

            -- Check if insert happened
            IF FOUND THEN
              v_attempts_created := v_attempts_created + 1;
            END IF;
          END IF;
        END LOOP;  -- attempts loop

      END LOOP;  -- completed_words loop

      v_sessions_processed := v_sessions_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other sessions
      v_errors_encountered := v_errors_encountered + 1;
      RAISE WARNING 'Error processing session %: %', v_session.client_session_id, SQLERRM;
    END;
  END LOOP;  -- sessions loop

  RETURN QUERY SELECT v_sessions_processed, v_attempts_created, v_errors_encountered;
END;
$$;

-- =============================================================================
-- RUN THE BACKFILL
-- =============================================================================

DO $$
DECLARE
  result RECORD;
BEGIN
  SELECT * INTO result FROM backfill_word_attempts_from_sessions();
  RAISE NOTICE 'Backfill complete: % sessions processed, % attempts created, % errors',
    result.sessions_processed, result.attempts_created, result.errors_encountered;
END;
$$;

-- =============================================================================
-- CLEANUP
-- Keep the function for potential re-runs but mark as internal
-- =============================================================================

COMMENT ON FUNCTION backfill_word_attempts_from_sessions() IS
  'Internal function to backfill child_word_attempts from historical game session JSONB data. Idempotent - can be re-run safely.';
