-- Migration: Reset Child Progress RPC Function
-- Allows parents to reset all learning progress for a child while keeping the profile

-- =============================================================================
-- RESET_CHILD_PROGRESS RPC FUNCTION
-- Clears all learning data for a child while preserving the profile
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_child_progress(UUID) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION reset_child_progress IS 'Resets all learning progress for a child (word mastery, game history, statistics, calibration) while preserving the child profile. Only the parent who owns the child can execute this.';
