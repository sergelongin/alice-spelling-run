/**
 * WatermelonDB Schema Definition
 * Defines the local SQLite schema for offline-first data storage
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    // Word progress tracks per-word mastery state
    tableSchema({
      name: 'word_progress',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'word_text', type: 'string', isIndexed: true },
        { name: 'mastery_level', type: 'number' },
        { name: 'correct_streak', type: 'number' },
        { name: 'times_used', type: 'number' },
        { name: 'times_correct', type: 'number' },
        { name: 'last_attempt_at', type: 'number', isOptional: true },
        { name: 'next_review_at', type: 'number', isOptional: true },
        { name: 'introduced_at', type: 'number', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'archived_at', type: 'number', isOptional: true },
        // Definition fields
        { name: 'definition', type: 'string', isOptional: true },
        { name: 'example_sentence', type: 'string', isOptional: true },
        // Attempt history stored as JSON string
        { name: 'attempt_history_json', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),

    // Game sessions are append-only events
    tableSchema({
      name: 'game_sessions',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'client_session_id', type: 'string', isIndexed: true },
        { name: 'mode', type: 'string' },
        { name: 'played_at', type: 'number' },
        { name: 'duration_seconds', type: 'number', isOptional: true },
        { name: 'words_attempted', type: 'number' },
        { name: 'words_correct', type: 'number' },
        { name: 'won', type: 'boolean' },
        { name: 'trophy', type: 'string', isOptional: true },
        // Detailed session data stored as JSON
        { name: 'completed_words_json', type: 'string', isOptional: true },
        { name: 'wrong_attempts_json', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),

    // Per-mode statistics aggregates
    tableSchema({
      name: 'statistics',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'mode', type: 'string', isIndexed: true },
        { name: 'total_games_played', type: 'number' },
        { name: 'total_wins', type: 'number' },
        { name: 'total_words_attempted', type: 'number' },
        { name: 'total_words_correct', type: 'number' },
        { name: 'streak_current', type: 'number' },
        { name: 'streak_best', type: 'number' },
        // Complex objects stored as JSON
        { name: 'trophy_counts_json', type: 'string' },
        { name: 'game_history_json', type: 'string', isOptional: true },
        { name: 'word_accuracy_json', type: 'string', isOptional: true },
        { name: 'first_correct_dates_json', type: 'string', isOptional: true },
        { name: 'personal_bests_json', type: 'string', isOptional: true },
        { name: 'error_patterns_json', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),

    // Calibration results
    tableSchema({
      name: 'calibration',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'client_calibration_id', type: 'string', isIndexed: true },
        { name: 'completed_at', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'recommended_grade', type: 'number' },
        { name: 'confidence', type: 'string' },
        { name: 'total_time_ms', type: 'number', isOptional: true },
        // Complex objects stored as JSON
        { name: 'attempts_json', type: 'string', isOptional: true },
        { name: 'grade_scores_json', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),

    // Learning progress for level map
    tableSchema({
      name: 'learning_progress',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'total_points', type: 'number' },
        { name: 'current_milestone_index', type: 'number' },
        { name: 'milestone_progress', type: 'number' },
        // Point history stored as JSON
        { name: 'point_history_json', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),

    // Word bank metadata (daily tracking)
    tableSchema({
      name: 'word_bank_metadata',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'last_updated', type: 'number' },
        { name: 'last_new_word_date', type: 'string', isOptional: true },
        { name: 'new_words_introduced_today', type: 'number' },
      ],
    }),

    // Word attempts - normalized table for attempt history
    // Insert-only sync (like game_sessions) for multi-device safety
    tableSchema({
      name: 'word_attempts',
      columns: [
        { name: 'child_id', type: 'string', isIndexed: true },
        { name: 'word_text', type: 'string', isIndexed: true },
        { name: 'client_attempt_id', type: 'string', isIndexed: true },
        { name: 'attempt_number', type: 'number', isOptional: true },
        { name: 'typed_text', type: 'string' },
        { name: 'was_correct', type: 'boolean' },
        { name: 'mode', type: 'string' },
        { name: 'time_ms', type: 'number', isOptional: true },
        { name: 'attempted_at', type: 'number' },
        { name: 'session_id', type: 'string', isOptional: true },
        // Server sync tracking
        { name: 'server_id', type: 'string', isOptional: true },
      ],
    }),
  ],
});

// Export table names as constants for type safety
export const TableName = {
  WORD_PROGRESS: 'word_progress',
  GAME_SESSIONS: 'game_sessions',
  STATISTICS: 'statistics',
  CALIBRATION: 'calibration',
  LEARNING_PROGRESS: 'learning_progress',
  WORD_BANK_METADATA: 'word_bank_metadata',
  WORD_ATTEMPTS: 'word_attempts',
} as const;

export type TableNameType = (typeof TableName)[keyof typeof TableName];
