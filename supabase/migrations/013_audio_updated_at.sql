-- Add updated_at column for cache invalidation
-- When audio is regenerated, clients can detect the change and re-download

-- Add updated_at column with default value
ALTER TABLE audio_pronunciations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update timestamp on row changes
CREATE OR REPLACE FUNCTION update_audio_pronunciations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audio_pronunciations_updated_at ON audio_pronunciations;
CREATE TRIGGER audio_pronunciations_updated_at
  BEFORE UPDATE ON audio_pronunciations
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_pronunciations_updated_at();

-- Index for efficient queries by word + updated_at
CREATE INDEX IF NOT EXISTS idx_audio_pronunciations_updated_at
ON audio_pronunciations(word_normalized, updated_at);
