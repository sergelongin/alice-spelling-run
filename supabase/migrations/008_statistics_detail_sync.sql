-- Migration: Statistics Detail Sync
-- Adds detailed statistics data to enable full sync of the Statistics tab
-- Includes: completed words per session, wrong attempts, word accuracy, personal bests, error patterns

-- =============================================================================
-- ADD DETAILED DATA TO CHILD_GAME_SESSIONS
-- =============================================================================

-- Add completed words array (which words, attempts per word, time per word)
ALTER TABLE child_game_sessions
  ADD COLUMN IF NOT EXISTS completed_words JSONB;
-- Stores: [{ word: string, attempts: number, timeMs?: number }]

-- Add wrong attempts for error pattern analysis
ALTER TABLE child_game_sessions
  ADD COLUMN IF NOT EXISTS wrong_attempts JSONB;
-- Stores: [{ word: string, attempt: string }]

-- Comment the columns for documentation
COMMENT ON COLUMN child_game_sessions.completed_words IS 'Array of completed words with attempts and timing: [{ word: string, attempts: number, timeMs?: number }]';
COMMENT ON COLUMN child_game_sessions.wrong_attempts IS 'Array of wrong attempts for error analysis: [{ word: string, attempt: string }]';

-- =============================================================================
-- ADD DETAILED STATS TO CHILD_STATISTICS
-- =============================================================================

-- Word accuracy: per-word aggregate of attempts and correct count
ALTER TABLE child_statistics
  ADD COLUMN IF NOT EXISTS word_accuracy JSONB DEFAULT '{}';
-- Stores: Record<string, { attempts: number, correct: number }>

-- First correct dates: when each word was first spelled correctly
ALTER TABLE child_statistics
  ADD COLUMN IF NOT EXISTS first_correct_dates JSONB DEFAULT '{}';
-- Stores: Record<string, string> (word -> ISO date)

-- Personal bests: fastest spelling time per word
ALTER TABLE child_statistics
  ADD COLUMN IF NOT EXISTS personal_bests JSONB DEFAULT '{}';
-- Stores: Record<string, { timeMs: number, date: string, attempts: number }>

-- Error patterns: categorized spelling mistakes
ALTER TABLE child_statistics
  ADD COLUMN IF NOT EXISTS error_patterns JSONB DEFAULT '{}';
-- Stores: Record<ErrorPattern, { count: number, lastOccurrence: string, examples: [{ word, attempt, date }] }>

-- Comment the columns for documentation
COMMENT ON COLUMN child_statistics.word_accuracy IS 'Per-word accuracy stats: Record<word, { attempts: number, correct: number }>';
COMMENT ON COLUMN child_statistics.first_correct_dates IS 'First correct spelling dates: Record<word, ISO date string>';
COMMENT ON COLUMN child_statistics.personal_bests IS 'Personal best times: Record<word, { timeMs: number, date: string, attempts: number }>';
COMMENT ON COLUMN child_statistics.error_patterns IS 'Error pattern tracking: Record<pattern, { count, lastOccurrence, examples[] }>';
