-- Migration: Child Progress Sync Tables
-- Enables cloud synchronization for child learning progress while maintaining offline-first approach
-- localStorage remains authoritative during gameplay; sync is opportunistic

-- =============================================================================
-- CHILD_WORD_PROGRESS TABLE
-- Per-child mastery data for each word (primary sync target)
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_word_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  word_text TEXT NOT NULL,
  mastery_level SMALLINT NOT NULL DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 5),
  correct_streak INTEGER NOT NULL DEFAULT 0,
  times_used INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  introduced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (child_id, word_text)
);

-- Enable RLS
ALTER TABLE child_word_progress ENABLE ROW LEVEL SECURITY;

-- Parents can manage their children's word progress
CREATE POLICY "Parents can manage child word progress" ON child_word_progress
  FOR ALL USING (
    child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

-- Index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_child_word_progress_child_updated
  ON child_word_progress(child_id, client_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_child_word_progress_child_word
  ON child_word_progress(child_id, word_text);

-- =============================================================================
-- CHILD_STATISTICS TABLE
-- Aggregated stats per child per mode
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('meadow', 'savannah', 'wildlands')),
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_words_attempted INTEGER NOT NULL DEFAULT 0,
  total_words_correct INTEGER NOT NULL DEFAULT 0,
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_best INTEGER NOT NULL DEFAULT 0,
  trophy_counts JSONB NOT NULL DEFAULT '{"platinum": 0, "gold": 0, "silver": 0, "bronze": 0, "participant": 0}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (child_id, mode)
);

-- Enable RLS
ALTER TABLE child_statistics ENABLE ROW LEVEL SECURITY;

-- Parents can manage their children's statistics
CREATE POLICY "Parents can manage child statistics" ON child_statistics
  FOR ALL USING (
    child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

-- Index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_child_statistics_child_updated
  ON child_statistics(child_id, client_updated_at DESC);

-- =============================================================================
-- CHILD_GAME_SESSIONS TABLE
-- Individual game session history
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  words_attempted INTEGER NOT NULL,
  words_correct INTEGER NOT NULL,
  won BOOLEAN NOT NULL,
  trophy TEXT,
  client_session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, client_session_id)
);

-- Enable RLS
ALTER TABLE child_game_sessions ENABLE ROW LEVEL SECURITY;

-- Parents can manage their children's game sessions
CREATE POLICY "Parents can manage child game sessions" ON child_game_sessions
  FOR ALL USING (
    child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_child_game_sessions_child_played
  ON child_game_sessions(child_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_child_game_sessions_client_id
  ON child_game_sessions(child_id, client_session_id);

-- =============================================================================
-- CHILD_CALIBRATION TABLE
-- Calibration results
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'skipped')),
  recommended_grade SMALLINT NOT NULL CHECK (recommended_grade >= 3 AND recommended_grade <= 6),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  total_time_ms INTEGER,
  attempts_json JSONB, -- Stores CalibrationAttempt[] for detailed history
  grade_scores_json JSONB, -- Stores Record<GradeLevel, GradeScore>
  client_calibration_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_id, client_calibration_id)
);

-- Enable RLS
ALTER TABLE child_calibration ENABLE ROW LEVEL SECURITY;

-- Parents can manage their children's calibration
CREATE POLICY "Parents can manage child calibration" ON child_calibration
  FOR ALL USING (
    child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_child_calibration_child_completed
  ON child_calibration(child_id, completed_at DESC);

-- =============================================================================
-- CHILD_SYNC_METADATA TABLE
-- Tracks sync state per child for incremental sync
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE UNIQUE,
  last_sync_at TIMESTAMPTZ,
  last_word_progress_sync_at TIMESTAMPTZ,
  last_statistics_sync_at TIMESTAMPTZ,
  last_sessions_sync_at TIMESTAMPTZ,
  last_calibration_sync_at TIMESTAMPTZ,
  initial_migration_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE child_sync_metadata ENABLE ROW LEVEL SECURITY;

-- Parents can manage their children's sync metadata
CREATE POLICY "Parents can manage child sync metadata" ON child_sync_metadata
  FOR ALL USING (
    child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

-- =============================================================================
-- HELPER FUNCTION: Update timestamp trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_child_word_progress_updated_at ON child_word_progress;
CREATE TRIGGER update_child_word_progress_updated_at
  BEFORE UPDATE ON child_word_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_child_statistics_updated_at ON child_statistics;
CREATE TRIGGER update_child_statistics_updated_at
  BEFORE UPDATE ON child_statistics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_child_sync_metadata_updated_at ON child_sync_metadata;
CREATE TRIGGER update_child_sync_metadata_updated_at
  BEFORE UPDATE ON child_sync_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
