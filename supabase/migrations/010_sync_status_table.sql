-- Sync status table: tracks when a child's data last changed
-- Used by clients to detect if server has newer data than their last sync

CREATE TABLE IF NOT EXISTS child_sync_status (
  child_id UUID PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  last_data_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE child_sync_status ENABLE ROW LEVEL SECURITY;

-- Policy: parents can read their children's sync status
CREATE POLICY "Parents can read their children sync status"
  ON child_sync_status FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM children WHERE parent_id = auth.uid()
    )
  );

-- Function to update sync status timestamp
-- Called by triggers when child data changes
CREATE OR REPLACE FUNCTION update_child_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO child_sync_status (child_id, last_data_changed_at)
  VALUES (NEW.child_id, now())
  ON CONFLICT (child_id) DO UPDATE
  SET last_data_changed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on word_progress changes
DROP TRIGGER IF EXISTS trg_word_progress_sync_status ON child_word_progress;
CREATE TRIGGER trg_word_progress_sync_status
  AFTER INSERT OR UPDATE ON child_word_progress
  FOR EACH ROW EXECUTE FUNCTION update_child_sync_status();

-- Trigger on game_sessions changes
DROP TRIGGER IF EXISTS trg_game_sessions_sync_status ON child_game_sessions;
CREATE TRIGGER trg_game_sessions_sync_status
  AFTER INSERT ON child_game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_child_sync_status();

-- Trigger on statistics changes
DROP TRIGGER IF EXISTS trg_statistics_sync_status ON child_statistics;
CREATE TRIGGER trg_statistics_sync_status
  AFTER INSERT OR UPDATE ON child_statistics
  FOR EACH ROW EXECUTE FUNCTION update_child_sync_status();

-- Comment for documentation
COMMENT ON TABLE child_sync_status IS 'Tracks when a child''s data was last modified. Used for efficient sync polling - clients compare their lastSyncAt with last_data_changed_at to detect if sync is needed.';
COMMENT ON COLUMN child_sync_status.last_data_changed_at IS 'Updated by triggers whenever child_word_progress, child_game_sessions, or child_statistics changes';
