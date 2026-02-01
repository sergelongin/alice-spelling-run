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
 */
export function transformWordProgressFromServer(row: ServerWordProgress): RawRecord {
  return {
    id: row.id, // Use server ID as WatermelonDB ID for synced records
    child_id: row.child_id,
    word_text: row.word_text,
    mastery_level: row.mastery_level,
    correct_streak: row.correct_streak,
    times_used: row.times_used,
    times_correct: row.times_correct,
    last_attempt_at: row.last_attempt_at ? new Date(row.last_attempt_at).getTime() : null,
    next_review_at: row.next_review_at ? new Date(row.next_review_at).getTime() : null,
    introduced_at: row.introduced_at ? new Date(row.introduced_at).getTime() : null,
    is_active: row.is_active,
    archived_at: row.archived_at ? new Date(row.archived_at).getTime() : null,
    server_id: row.id,
  };
}

/**
 * Convert server game session to WatermelonDB raw record
 */
export function transformGameSessionFromServer(row: ServerGameSession): RawRecord {
  return {
    id: row.id,
    child_id: row.child_id,
    client_session_id: row.client_session_id,
    mode: row.mode,
    played_at: new Date(row.played_at).getTime(),
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
 */
export function transformCalibrationFromServer(row: ServerCalibration): RawRecord {
  return {
    id: row.id,
    child_id: row.child_id,
    client_calibration_id: row.client_calibration_id,
    completed_at: new Date(row.completed_at).getTime(),
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
 */
export function transformWordAttemptFromServer(row: ServerWordAttempt): RawRecord {
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
    attempted_at: new Date(row.attempted_at).getTime(),
    session_id: row.session_id,
    server_id: row.id,
  };
}

/**
 * Convert server learning progress to WatermelonDB raw record
 */
export function transformLearningProgressFromServer(row: ServerLearningProgress): RawRecord {
  return {
    id: row.id,
    child_id: row.child_id,
    total_points: row.total_lifetime_points, // Map to legacy field for backward compatibility
    total_lifetime_points: row.total_lifetime_points,
    current_milestone_index: row.current_milestone_index,
    milestone_progress: row.milestone_progress,
    point_history_json: row.point_history ? JSON.stringify(row.point_history) : null,
    client_updated_at: row.client_updated_at ? new Date(row.client_updated_at).getTime() : null,
    server_id: row.id,
  };
}

/**
 * Convert server grade progress to WatermelonDB raw record
 */
export function transformGradeProgressFromServer(row: ServerGradeProgress): RawRecord {
  return {
    id: row.id,
    child_id: row.child_id,
    grade_level: row.grade_level,
    total_points: row.total_points,
    current_milestone_index: row.current_milestone_index,
    words_mastered: row.words_mastered,
    first_point_at: row.first_point_at ? new Date(row.first_point_at).getTime() : null,
    last_activity_at: row.last_activity_at ? new Date(row.last_activity_at).getTime() : null,
    client_updated_at: row.client_updated_at ? new Date(row.client_updated_at).getTime() : null,
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
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformWordProgressToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    word_text: r['word_text'],
    mastery_level: r['mastery_level'],
    correct_streak: r['correct_streak'],
    times_used: r['times_used'],
    times_correct: r['times_correct'],
    last_attempt_at: r['last_attempt_at']
      ? new Date(r['last_attempt_at'] as number).toISOString()
      : null,
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
 * Convert WatermelonDB statistics to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformStatisticsToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    mode: r['mode'],
    total_games_played: r['total_games_played'],
    total_wins: r['total_wins'],
    total_words_attempted: r['total_words_attempted'],
    total_words_correct: r['total_words_correct'],
    streak_current: r['streak_current'],
    streak_best: r['streak_best'],
    trophy_counts: r['trophy_counts_json']
      ? JSON.parse(r['trophy_counts_json'] as string)
      : null,
    word_accuracy: r['word_accuracy_json']
      ? JSON.parse(r['word_accuracy_json'] as string)
      : null,
    first_correct_dates: r['first_correct_dates_json']
      ? JSON.parse(r['first_correct_dates_json'] as string)
      : null,
    personal_bests: r['personal_bests_json']
      ? JSON.parse(r['personal_bests_json'] as string)
      : null,
    error_patterns: r['error_patterns_json']
      ? JSON.parse(r['error_patterns_json'] as string)
      : null,
    client_updated_at: new Date().toISOString(),
  };
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
 * Convert WatermelonDB learning progress to server format
 * IMPORTANT: child_id is included so RPC can use the record's own child_id
 */
export function transformLearningProgressToServer(record: RawRecord): Record<string, unknown> {
  const r = record as Record<string, unknown>;
  return {
    child_id: r['child_id'],
    total_lifetime_points: r['total_lifetime_points'] ?? r['total_points'], // Use new field or fallback to legacy
    current_milestone_index: r['current_milestone_index'],
    milestone_progress: r['milestone_progress'],
    point_history: r['point_history_json']
      ? JSON.parse(r['point_history_json'] as string)
      : null,
    client_updated_at: r['client_updated_at']
      ? new Date(r['client_updated_at'] as number).toISOString()
      : new Date().toISOString(),
  };
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
    statistics: {
      created: changes.statistics.created.map(transformStatisticsToServer),
      updated: changes.statistics.updated.map(transformStatisticsToServer),
    },
    calibration: {
      created: changes.calibration.created.map(transformCalibrationToServer),
    },
    word_attempts: {
      created: changes.word_attempts.created.map(transformWordAttemptToServer),
    },
    learning_progress: {
      created: changes.learning_progress.created.map(transformLearningProgressToServer),
      updated: changes.learning_progress.updated.map(transformLearningProgressToServer),
    },
    grade_progress: {
      created: changes.grade_progress.created.map(transformGradeProgressToServer),
      updated: changes.grade_progress.updated.map(transformGradeProgressToServer),
    },
  };
}
