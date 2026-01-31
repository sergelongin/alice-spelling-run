-- Migration: 018_get_record_keys
-- Purpose: RPC function to fetch business keys for orphan detection
-- Used by deep repair to compare local vs server records by business key

-- get_record_keys: Returns all business keys for a child's records
-- This enables efficient orphan detection without fetching full records
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
    )
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_record_keys(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_record_keys(UUID) IS
  'Returns business keys for all records belonging to a child. Used for orphan detection during deep repair sync.';
