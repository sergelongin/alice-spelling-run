/**
 * Sync types for offline-first data synchronization
 * localStorage remains authoritative during gameplay; sync is opportunistic
 */

import type { MasteryLevel, Word, WordAttempt } from './word';
import type { ModeStatistics, ErrorPattern, ErrorPatternStats, PersonalBest, WordAccuracy } from './statistics';
import type { StatsModeId } from './gameMode';
import type { CompletedWord, SessionWrongAttempt } from './game';

// =============================================================================
// SYNC QUEUE TYPES
// =============================================================================

export type SyncOperation = 'upsert' | 'insert';

export type SyncTable =
  | 'child_word_progress'
  | 'child_statistics'
  | 'child_game_sessions'
  | 'child_calibration';

export type SyncQueueStatus = 'pending' | 'syncing' | 'confirmed' | 'failed';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  table: SyncTable;
  payload: Record<string, unknown>;
  clientTimestamp: string; // ISO string
  status: SyncQueueStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string; // ISO string
}

// =============================================================================
// SYNC CONTEXT TYPES
// =============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncContextValue {
  isOnline: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  pendingChanges: number;
  lastError: string | null;
  syncNow: () => Promise<void>;
  queueForSync: (item: Omit<SyncQueueItem, 'id' | 'status' | 'retryCount' | 'createdAt'>) => void;
}

// =============================================================================
// SYNC METADATA (localStorage)
// =============================================================================

/**
 * Sync metadata version - increment when sync logic changes significantly.
 * When version mismatches, timestamps are reset to force fresh syncs.
 * This fixes stale data issues when sync logic is updated.
 */
export const SYNC_METADATA_VERSION = 2;

export interface SyncMetadata {
  version: number; // Schema version for invalidating stale metadata
  lastSyncAt: string | null; // ISO string
  lastWordProgressSyncAt: string | null;
  lastStatisticsSyncAt: string | null;
  lastSessionsSyncAt: string | null;
  lastCalibrationSyncAt: string | null;
  initialMigrationCompleted: boolean;
  serverTimeOffset: number; // ms offset between client and server clocks
}

export const DEFAULT_SYNC_METADATA: SyncMetadata = {
  version: SYNC_METADATA_VERSION,
  lastSyncAt: null,
  lastWordProgressSyncAt: null,
  lastStatisticsSyncAt: null,
  lastSessionsSyncAt: null,
  lastCalibrationSyncAt: null,
  initialMigrationCompleted: false,
  serverTimeOffset: 0,
};

// =============================================================================
// DATABASE ROW TYPES (for Supabase responses)
// =============================================================================

export interface ChildWordProgressRow {
  id: string;
  child_id: string;
  word_text: string;
  mastery_level: number;
  correct_streak: number;
  times_used: number;
  times_correct: number;
  last_attempt_at: string | null;
  next_review_at: string;
  introduced_at: string | null;
  is_active: boolean;
  archived_at: string | null;
  updated_at: string;
  client_updated_at: string;
  attempt_history_json?: WordAttempt[]; // Array of spelling attempts (limited to 100)
}

export interface ChildStatisticsRow {
  id: string;
  child_id: string;
  mode: StatsModeId;
  total_games_played: number;
  total_wins: number;
  total_words_attempted: number;
  total_words_correct: number;
  streak_current: number;
  streak_best: number;
  trophy_counts: Record<string, number>;
  updated_at: string;
  client_updated_at: string;
  // Detailed statistics (JSONB columns)
  word_accuracy?: Record<string, WordAccuracy>;
  first_correct_dates?: Record<string, string>;
  personal_bests?: Record<string, PersonalBest>;
  error_patterns?: Record<ErrorPattern, ErrorPatternStats>;
}

export interface ChildGameSessionRow {
  id: string;
  child_id: string;
  mode: string;
  played_at: string;
  duration_seconds: number | null;
  words_attempted: number;
  words_correct: number;
  won: boolean;
  trophy: string | null;
  client_session_id: string;
  created_at: string;
  // Detailed session data (JSONB columns)
  completed_words?: CompletedWord[];
  wrong_attempts?: SessionWrongAttempt[];
}

export interface ChildCalibrationRow {
  id: string;
  child_id: string;
  completed_at: string;
  status: 'completed' | 'skipped';
  recommended_grade: number;
  confidence: 'high' | 'medium' | 'low';
  total_time_ms: number | null;
  attempts_json: unknown;
  grade_scores_json: unknown;
  client_calibration_id: string;
  created_at: string;
}

export interface ChildSyncMetadataRow {
  id: string;
  child_id: string;
  last_sync_at: string | null;
  last_word_progress_sync_at: string | null;
  last_statistics_sync_at: string | null;
  last_sessions_sync_at: string | null;
  last_calibration_sync_at: string | null;
  initial_migration_completed: boolean;
  updated_at: string;
}

// =============================================================================
// SYNC PAYLOADS (for queue items)
// =============================================================================

export interface WordProgressSyncPayload {
  child_id: string;
  word_text: string;
  mastery_level: MasteryLevel;
  correct_streak: number;
  times_used: number;
  times_correct: number;
  last_attempt_at: string | null;
  next_review_at: string;
  introduced_at: string | null;
  is_active: boolean;
  archived_at: string | null;
  client_updated_at: string;
  attempt_history_json?: WordAttempt[]; // Array of attempts (limited to 100 most recent)
}

// =============================================================================
// SYNC STATUS (for polling)
// =============================================================================

/**
 * Row from child_sync_status table
 * Used to detect when server data has changed
 */
export interface ChildSyncStatusRow {
  child_id: string;
  last_data_changed_at: string; // ISO timestamp
}

export interface StatisticsSyncPayload {
  child_id: string;
  mode: StatsModeId;
  total_games_played: number;
  total_wins: number;
  total_words_attempted: number;
  total_words_correct: number;
  streak_current: number;
  streak_best: number;
  trophy_counts: Record<string, number>;
  client_updated_at: string;
  // Detailed statistics (optional for backward compatibility)
  word_accuracy?: Record<string, WordAccuracy>;
  first_correct_dates?: Record<string, string>;
  personal_bests?: Record<string, PersonalBest>;
  error_patterns?: Record<ErrorPattern, ErrorPatternStats>;
}

export interface GameSessionSyncPayload {
  child_id: string;
  mode: string;
  played_at: string;
  duration_seconds?: number;
  words_attempted: number;
  words_correct: number;
  won: boolean;
  trophy?: string;
  client_session_id: string;
  // Detailed session data (optional for backward compatibility)
  completed_words?: CompletedWord[];
  wrong_attempts?: SessionWrongAttempt[];
}

export interface CalibrationSyncPayload {
  child_id: string;
  completed_at: string;
  status: 'completed' | 'skipped';
  recommended_grade: number;
  confidence: 'high' | 'medium' | 'low';
  total_time_ms?: number;
  attempts_json?: unknown;
  grade_scores_json?: unknown;
  client_calibration_id: string;
}

// =============================================================================
// MERGE TYPES
// =============================================================================

export interface MergeResult<T> {
  merged: T;
  source: 'local' | 'server' | 'merged';
  conflicts: string[]; // Field names that had conflicts
}

export interface WordProgressMergeInput {
  local: Word;
  server: ChildWordProgressRow;
}

export interface StatisticsMergeInput {
  local: ModeStatistics;
  server: ChildStatisticsRow;
}

// =============================================================================
// SYNC RESULT TYPES
// =============================================================================

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  itemsSynced: number;
  itemsFailed: number;
  errors: string[];
}

export interface PullResult {
  wordProgress: ChildWordProgressRow[];
  statistics: ChildStatisticsRow[];
  gameSessions: ChildGameSessionRow[];
  calibrations: ChildCalibrationRow[];
}
