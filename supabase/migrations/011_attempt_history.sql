-- Add attempt_history_json column to child_word_progress
-- Stores the detailed history of spelling attempts for each word

ALTER TABLE child_word_progress
  ADD COLUMN IF NOT EXISTS attempt_history_json JSONB DEFAULT '[]';

COMMENT ON COLUMN child_word_progress.attempt_history_json IS
  'Array of spelling attempts: [{ id, timestamp, wasCorrect, typedText, mode, timeMs?, attemptNumber? }]. Limited to 100 most recent per word.';

-- Create index for efficient querying of attempt history (if needed for analytics)
CREATE INDEX IF NOT EXISTS idx_word_progress_attempt_history
  ON child_word_progress USING GIN (attempt_history_json);
