/**
 * Data Transformers for WatermelonDB Sync
 * Converts between WatermelonDB and Supabase data formats
 */

import type {
  CompletedWord,
  SessionWrongAttempt,
  TrophyTier,
  StatsModeId,
  WordAccuracy,
  PersonalBest,
  ErrorPattern,
  ErrorPatternStats,
  CalibrationAttempt,
  GradeScore,
} from '@/types';
import type { GradeLevel } from '@/data/gradeWords';
import { syncLog, safeTimestamp } from './syncDebug';

// Generic record type for WatermelonDB raw records
type RawRecord = Record<string, unknown>;

// =============================================================================
// TYPES FOR SERVER RESPONSES
// =============================================================================

export interface ServerWordProgress {
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
}

export interface ServerGameSession {
  id: string;
  child_id: string;
  client_session_id: string;
  mode: string;
  played_at: string;
  duration_seconds: number | null;
  words_attempted: number;
  words_correct: number;
  won: boolean;
  trophy: string | null;
  completed_words: CompletedWord[] | null;
  wrong_attempts: SessionWrongAttempt[] | null;
  created_at: string;
}

export interface ServerStatistics {
  id: string;
  child_id: string;
  mode: StatsModeId;
  total_games_played: number;
  total_wins: number;
  total_words_attempted: number;
  total_words_correct: number;
  streak_current: number;
  streak_best: number;
  trophy_counts: Record<TrophyTier, number>;
  word_accuracy: Record<string, WordAccuracy> | null;
  first_correct_dates: Record<string, string> | null;
  personal_bests: Record<string, PersonalBest> | null;
  error_patterns: Record<ErrorPattern, ErrorPatternStats> | null;
  updated_at: string;
}

export interface ServerCalibration {
  id: string;
  child_id: string;
  client_calibration_id: string;
  completed_at: string;
  status: 'completed' | 'skipped';
  recommended_grade: number;
  confidence: 'high' | 'medium' | 'low';
  total_time_ms: number | null;
  attempts_json: CalibrationAttempt[] | null;
  grade_scores_json: Record<GradeLevel, GradeScore> | null;
  created_at: string;
}

export interface ServerWordAttempt {
  id: string;
  child_id: string;
  word_text: string;
  client_attempt_id: string;
  attempt_number: number | null;
  typed_text: string;
  was_correct: boolean;
  mode: string;
  time_ms: number | null;
  attempted_at: string;
  session_id: string | null;
  created_at: string;
}

export interface ServerLearningProgress {
  id: string;
  child_id: string;
  total_lifetime_points: number;
  current_milestone_index: number;
  milestone_progress: number;
  point_history: unknown[] | null;
  client_updated_at: string;
  updated_at: string;
}

export interface ServerGradeProgress {
  id: string;
  child_id: string;
  grade_level: number;
  total_points: number;
  current_milestone_index: number;
  words_mastered: number;
  first_point_at: string | null;
  last_activity_at: string | null;
  client_updated_at: string;
  updated_at: string;
}

export interface ServerPullResponse {
  word_progress: ServerWordProgress[];
  game_sessions: ServerGameSession[];
  statistics: ServerStatistics[];
  calibration: ServerCalibration[];
  word_attempts: ServerWordAttempt[];
  learning_progress: ServerLearningProgress[];
  grade_progress: ServerGradeProgress[];
  timestamp: string;
  last_reset_at: string | null;
}

// =============================================================================
// WATERMELON SYNC TYPES
// =============================================================================

export interface SyncTableChanges<T = RawRecord> {
  created: T[];
  updated: T[];
  deleted: string[];
}

export interface SyncChangeset {
  word_progress: SyncTableChanges;
  game_sessions: SyncTableChanges;
  statistics: SyncTableChanges;
  calibration: SyncTableChanges;
  learning_progress: SyncTableChanges;
  grade_progress: SyncTableChanges;
  word_bank_metadata: SyncTableChanges;
  word_attempts: SyncTableChanges;
}

// =============================================================================
// PULL TRANSFORMERS (Server -> WatermelonDB)
// =============================================================================

/**
 * Convert server word progress to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 */
export function transformWordProgressFromServer(row: ServerWordProgress): RawRecord {
  const lastAttemptAt = safeTimestamp(row.last_attempt_at);
  const nextReviewAt = safeTimestamp(row.next_review_at);
  const introducedAt = safeTimestamp(row.introduced_at);
  const archivedAt = safeTimestamp(row.archived_at);

  // Log warning if any timestamp was invalid (safeTimestamp logs internally)
  const record: RawRecord = {
    id: row.id, // Use server ID as WatermelonDB ID for synced records
    child_id: row.child_id,
    word_text: row.word_text,
    mastery_level: row.mastery_level,
    correct_streak: row.correct_streak,
    times_used: row.times_used,
    times_correct: row.times_correct,
    last_attempt_at: lastAttemptAt,
    next_review_at: nextReviewAt,
    introduced_at: introducedAt,
    is_active: row.is_active,
    archived_at: archivedAt,
    server_id: row.id,
  };

  return record;
}

/**
 * Convert server game session to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 */
export function transformGameSessionFromServer(row: ServerGameSession): RawRecord {
  const playedAt = safeTimestamp(row.played_at);

  // Validate required timestamp
  if (playedAt === null || playedAt === 0) {
    syncLog.warn('Transform', `game_session ${row.id} has invalid played_at: ${row.played_at}`);
  }

  return {
    id: row.id,
    child_id: row.child_id,
    client_session_id: row.client_session_id,
    mode: row.mode,
    played_at: playedAt ?? 0, // Fallback to epoch if null
    duration_seconds: row.duration_seconds,
    words_attempted: row.words_attempted,
    words_correct: row.words_correct,
    won: row.won,
    trophy: row.trophy,
    completed_words_json: row.completed_words ? JSON.stringify(row.completed_words) : null,
    wrong_attempts_json: row.wrong_attempts ? JSON.stringify(row.wrong_attempts) : null,
    server_id: row.id,
  };
}

/**
 * Convert server statistics to WatermelonDB raw record
 */
export function transformStatisticsFromServer(row: ServerStatistics): RawRecord {
  return {
    id: row.id,
    child_id: row.child_id,
    mode: row.mode,
    total_games_played: row.total_games_played,
    total_wins: row.total_wins,
    total_words_attempted: row.total_words_attempted,
    total_words_correct: row.total_words_correct,
    streak_current: row.streak_current,
    streak_best: row.streak_best,
    trophy_counts_json: JSON.stringify(row.trophy_counts),
    word_accuracy_json: row.word_accuracy ? JSON.stringify(row.word_accuracy) : null,
    first_correct_dates_json: row.first_correct_dates ? JSON.stringify(row.first_correct_dates) : null,
    personal_bests_json: row.personal_bests ? JSON.stringify(row.personal_bests) : null,
    error_patterns_json: row.error_patterns ? JSON.stringify(row.error_patterns) : null,
    server_id: row.id,
  };
}

/**
 * Convert server calibration to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 */
export function transformCalibrationFromServer(row: ServerCalibration): RawRecord {
  const completedAt = safeTimestamp(row.completed_at);

  // Validate required timestamp
  if (completedAt === null || completedAt === 0) {
    syncLog.warn('Transform', `calibration ${row.id} has invalid completed_at: ${row.completed_at}`);
  }

  return {
    id: row.id,
    child_id: row.child_id,
    client_calibration_id: row.client_calibration_id,
    completed_at: completedAt ?? 0, // Fallback to epoch if null
    status: row.status,
    recommended_grade: row.recommended_grade,
    confidence: row.confidence,
    total_time_ms: row.total_time_ms,
    attempts_json: row.attempts_json ? JSON.stringify(row.attempts_json) : null,
    grade_scores_json: row.grade_scores_json ? JSON.stringify(row.grade_scores_json) : null,
    server_id: row.id,
  };
}

/**
 * Convert server word attempt to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 *
 * CRITICAL: attempted_at is required. If it's null/invalid, the record will
 * still be created with epoch timestamp (0) rather than NaN which would cause
 * WatermelonDB to silently reject the record.
 */
export function transformWordAttemptFromServer(row: ServerWordAttempt): RawRecord {
  const attemptedAt = safeTimestamp(row.attempted_at);

  // Validate required timestamp - this is the most common cause of sync issues
  if (attemptedAt === null || attemptedAt === 0) {
    syncLog.warn(
      'Transform',
      `word_attempt ${row.id} (client: ${row.client_attempt_id}) has invalid attempted_at: ${row.attempted_at}`
    );
  }

  return {
    id: row.id,
    child_id: row.child_id,
    word_text: row.word_text,
    client_attempt_id: row.client_attempt_id,
    attempt_number: row.attempt_number,
    typed_text: row.typed_text,
    was_correct: row.was_correct,
    mode: row.mode,
    time_ms: row.time_ms,
    attempted_at: attemptedAt ?? 0, // Fallback to epoch if null (prevents NaN rejection)
    session_id: row.session_id,
    server_id: row.id,
  };
}

/**
 * Convert server learning progress to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 */
export function transformLearningProgressFromServer(row: ServerLearningProgress): RawRecord {
  const clientUpdatedAt = safeTimestamp(row.client_updated_at);

  return {
    id: row.id,
    child_id: row.child_id,
    total_points: row.total_lifetime_points, // Map to legacy field for backward compatibility
    total_lifetime_points: row.total_lifetime_points,
    current_milestone_index: row.current_milestone_index,
    milestone_progress: row.milestone_progress,
    point_history_json: row.point_history ? JSON.stringify(row.point_history) : null,
    client_updated_at: clientUpdatedAt,
    server_id: row.id,
  };
}

/**
 * Convert server grade progress to WatermelonDB raw record
 * Uses safe timestamp conversion to prevent NaN values
 */
export function transformGradeProgressFromServer(row: ServerGradeProgress): RawRecord {
  const firstPointAt = safeTimestamp(row.first_point_at);
  const lastActivityAt = safeTimestamp(row.last_activity_at);
  const clientUpdatedAt = safeTimestamp(row.client_updated_at);

  return {
    id: row.id,
    child_id: row.child_id,
    grade_level: row.grade_level,
    total_points: row.total_points,
    current_milestone_index: row.current_milestone_index,
    words_mastered: row.words_mastered,
    first_point_at: firstPointAt,
    last_activity_at: lastActivityAt,
    client_updated_at: clientUpdatedAt,
    server_id: row.id,
  };
}

/**
 * Transform full server pull response to WatermelonDB sync changes
 * Note: This is used as a fallback; reconcilePullChanges handles actual sync
 */
export function transformPullChanges(serverData: ServerPullResponse): SyncChangeset {
  return {
    word_progress: {
      created: serverData.word_progress.map(transformWordProgressFromServer),
      updated: [],
      deleted: [],
    },
    game_sessions: {
      created: serverData.game_sessions.map(transformGameSessionFromServer),
      updated: [],
      deleted: [],
    },
    statistics: {
      created: serverData.statistics.map(transformStatisticsFromServer),
      updated: [],
      deleted: [],
    },
    calibration: {
      created: serverData.calibration.map(transformCalibrationFromServer),
      updated: [],
      deleted: [],
    },
    learning_progress: {
      created: (serverData.learning_progress || []).map(transformLearningProgressFromServer),
      updated: [],
      deleted: [],
    },
    grade_progress: {
      created: (serverData.grade_progress || []).map(transformGradeProgressFromServer),
      updated: [],
      deleted: [],
    },
    word_bank_metadata: {
      created: [],
      updated: [],
      deleted: [],
    },
    word_attempts: {
      created: (serverData.word_attempts || []).map(transformWordAttemptFromServer),
      updated: [],
      deleted: [],
    },
  };
}

// =============================================================================
// PUSH TRANSFORMERS (WatermelonDB -> Server)
// =============================================================================

/**
 * Convert WatermelonDB word progress to server format
 * IMPORTANT: Only metadata fields are pushed. Mastery fields are computed server-side from word_attempts.
 *
 * Fields pushed:
 * - child_id, word_text: Identity
 * - introduced_at, next_review_at: Scheduling
 * - is_active, archived_at: User preferences
 * - definition, example_sentence: Custom word content
 *
 * Fields NOT pushed (computed from word_attempts):
 * - mastery_level, correct_streak, times_used, times_correct, last_attempt_at
 */
export function transformWordProgressToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    word_text: r['word_text'],
    // Mastery fields are computed server-side from word_attempts - don't push
    // mastery_level, correct_streak, times_used, times_correct, last_attempt_at: COMPUTED
    next_review_at: r['next_review_at']
      ? new Date(r['next_review_at'] as number).toISOString()
      : null,
    introduced_at: r['introduced_at']
      ? new Date(r['introduced_at'] as number).toISOString()
      : null,
    is_active: r['is_active'],
    archived_at: r['archived_at']
      ? new Date(r['archived_at'] as number).toISOString()
      : null,
    // Include definition for custom words
    definition: r['definition'] || null,
    example_sentence: r['example_sentence'] || null,
    client_updated_at: new Date().toISOString(),
  };
}

/**
 * Convert WatermelonDB game session to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformGameSessionToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    client_session_id: r['client_session_id'],
    mode: r['mode'],
    played_at: new Date(r['played_at'] as number).toISOString(),
    duration_seconds: r['duration_seconds'],
    words_attempted: r['words_attempted'],
    words_correct: r['words_correct'],
    won: r['won'],
    trophy: r['trophy'],
    completed_words: r['completed_words_json']
      ? JSON.parse(r['completed_words_json'] as string)
      : null,
    wrong_attempts: r['wrong_attempts_json']
      ? JSON.parse(r['wrong_attempts_json'] as string)
      : null,
  };
}

/**
 * @deprecated Statistics are now computed server-side from game_sessions.
 * This function is kept for reference but should not be used.
 * Statistics are PULL-ONLY (computed from events) in the new architecture.
 */
export function transformStatisticsToServer(_record: RawRecord): Record<string, unknown> {
  // Statistics are computed server-side from game_sessions events.
  // No push needed - server derives stats from INSERT-only game_sessions.
  throw new Error('Statistics should not be pushed - they are computed server-side');
}

/**
 * Convert WatermelonDB calibration to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformCalibrationToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    client_calibration_id: r['client_calibration_id'],
    completed_at: new Date(r['completed_at'] as number).toISOString(),
    status: r['status'],
    recommended_grade: r['recommended_grade'],
    confidence: r['confidence'],
    total_time_ms: r['total_time_ms'],
    attempts: r['attempts_json']
      ? JSON.parse(r['attempts_json'] as string)
      : null,
    grade_scores: r['grade_scores_json']
      ? JSON.parse(r['grade_scores_json'] as string)
      : null,
  };
}

/**
 * Convert WatermelonDB word attempt to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformWordAttemptToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    word_text: r['word_text'],
    client_attempt_id: r['client_attempt_id'],
    attempt_number: r['attempt_number'],
    typed_text: r['typed_text'],
    was_correct: r['was_correct'],
    mode: r['mode'],
    time_ms: r['time_ms'],
    attempted_at: new Date(r['attempted_at'] as number).toISOString(),
    session_id: r['session_id'],
  };
}

/**
 * @deprecated Learning progress points are now computed server-side from word_attempts.
 * This function is kept for reference but should not be used.
 * Learning progress is PULL-ONLY (computed from events) in the new architecture.
 */
export function transformLearningProgressToServer(_record: RawRecord): Record<string, unknown> {
  // Learning progress points are computed server-side from word_attempts events.
  // No push needed - server derives points from INSERT-only word_attempts.
  throw new Error('Learning progress should not be pushed - it is computed server-side');
}

/**
 * Convert WatermelonDB grade progress to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformGradeProgressToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    grade_level: r['grade_level'],
    total_points: r['total_points'],
    current_milestone_index: r['current_milestone_index'],
    words_mastered: r['words_mastered'],
    first_point_at: r['first_point_at']
      ? new Date(r['first_point_at'] as number).toISOString()
      : null,
    last_activity_at: r['last_activity_at']
      ? new Date(r['last_activity_at'] as number).toISOString()
      : null,
    client_updated_at: r['client_updated_at']
      ? new Date(r['client_updated_at'] as number).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Transform WatermelonDB push changes to server format
 *
 * Note: Statistics and learning_progress are NOT pushed - they are computed server-side.
 * This is part of the event-sourcing architecture where:
 * - Events (game_sessions, word_attempts, calibration) are INSERT-only and pushed
 * - Derived state (statistics, learning_progress points) is computed by server and pulled
 */
export function transformPushChanges(changes: SyncChangeset): Record<string, unknown> {
  return {
    word_progress: {
      created: changes.word_progress.created.map(transformWordProgressToServer),
      updated: changes.word_progress.updated.map(transformWordProgressToServer),
    },
    game_sessions: {
      created: changes.game_sessions.created.map(transformGameSessionToServer),
    },
    // Statistics are NOT pushed - computed server-side from game_sessions
    // statistics: omitted intentionally
    calibration: {
      created: changes.calibration.created.map(transformCalibrationToServer),
    },
    word_attempts: {
      created: changes.word_attempts.created.map(transformWordAttemptToServer),
    },
    // learning_progress is NOT pushed - points are computed server-side from word_attempts
    // Only milestone metadata (current_milestone_index, milestone_progress) might need sync
    // but for now we treat the entire learning_progress as computed
    // learning_progress: omitted intentionally
    grade_progress: {
      created: changes.grade_progress.created.map(transformGradeProgressToServer),
      updated: changes.grade_progress.updated.map(transformGradeProgressToServer),
    },
  };
}
