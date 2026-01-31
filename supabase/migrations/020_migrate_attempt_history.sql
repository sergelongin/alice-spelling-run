-- Migration: 020_migrate_attempt_history
-- Purpose:
-- 1. Migrate existing attempt_history_json data to child_word_attempts
-- 2. Update get_record_keys() to include word_attempts

-- =============================================================================
-- MIGRATE EXISTING ATTEMPT HISTORY DATA
-- =============================================================================

-- Migrate attempts from JSONB column to normalized table
-- Uses gen_random_uuid() for client_attempt_id since old data didn't have one
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
)
SELECT
  wp.child_id,
  wp.word_text,
  COALESCE(
    attempt->>'id',
    'migrated-' || wp.child_id || '-' || wp.word_text || '-' || (row_number() OVER (PARTITION BY wp.child_id, wp.word_text ORDER BY (attempt->>'timestamp')::timestamptz))::text
  ) as client_attempt_id,
  (attempt->>'attemptNumber')::integer as attempt_number,
  COALESCE(attempt->>'typedText', '') as typed_text,
  COALESCE((attempt->>'wasCorrect')::boolean, false) as was_correct,
  COALESCE(attempt->>'mode', 'meadow') as mode,
  (attempt->>'timeMs')::integer as time_ms,
  COALESCE((attempt->>'timestamp')::timestamptz, NOW()) as attempted_at,
  attempt->>'sessionId' as session_id,
  NOW() as created_at
FROM child_word_progress wp,
     jsonb_array_elements(wp.attempt_history_json) AS attempt
WHERE wp.attempt_history_json IS NOT NULL
  AND jsonb_array_length(wp.attempt_history_json) > 0
ON CONFLICT (child_id, client_attempt_id) DO NOTHING;

-- Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM child_word_attempts WHERE client_attempt_id LIKE 'migrated-%';
  RAISE NOTICE 'Migrated % attempt records from attempt_history_json', migrated_count;
END $$;

-- =============================================================================
-- UPDATE get_record_keys() TO INCLUDE word_attempts
-- =============================================================================

CREATE OR REPLACE FUNCTION get_record_keys(p_child_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify child belongs to authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM children
    WHERE id = p_child_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN json_build_object(
    'word_progress', (
      SELECT COALESCE(json_agg(word_text), '[]'::json)
      FROM child_word_progress WHERE child_id = p_child_id
    ),
    'game_sessions', (
      SELECT COALESCE(json_agg(client_session_id), '[]'::json)
      FROM child_game_sessions WHERE child_id = p_child_id
    ),
    'statistics', (
      SELECT COALESCE(json_agg(mode), '[]'::json)
      FROM child_statistics WHERE child_id = p_child_id
    ),
    'calibration', (
      SELECT COALESCE(json_agg(client_calibration_id), '[]'::json)
      FROM child_calibration WHERE child_id = p_child_id
    ),
    'word_attempts', (
      SELECT COALESCE(json_agg(client_attempt_id), '[]'::json)
      FROM child_word_attempts WHERE child_id = p_child_id
    )
  );
END;
$$;

-- Grant execute (idempotent)
GRANT EXECUTE ON FUNCTION get_record_keys(UUID) TO authenticated;
