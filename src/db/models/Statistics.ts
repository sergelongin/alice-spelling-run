/**
 * Statistics Model
 * Per-mode aggregated statistics
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';
import type {
  StatsModeId,
  TrophyTier,
  GameResult,
  WordAccuracy,
  PersonalBest,
  ErrorPattern,
  ErrorPatternStats,
} from '@/types';

// Sanitizer for JSON fields
const sanitizeJson = <T>(raw: unknown): T | undefined => {
  if (raw === null || raw === undefined) return undefined;
  return raw as T;
};

export class Statistics extends Model {
  static table = 'statistics';

  @text('child_id') childId!: string;
  @text('mode') mode!: StatsModeId;
  @field('total_games_played') totalGamesPlayed!: number;
  @field('total_wins') totalWins!: number;
  @field('total_words_attempted') totalWordsAttempted!: number;
  @field('total_words_correct') totalWordsCorrect!: number;
  @field('streak_current') streakCurrent!: number;
  @field('streak_best') streakBest!: number;
  @json('trophy_counts_json', sanitizeJson) trophyCounts!: Record<TrophyTier, number>;
  @json('game_history_json', sanitizeJson) gameHistory?: GameResult[];
  @json('word_accuracy_json', sanitizeJson) wordAccuracy?: Record<string, WordAccuracy>;
  @json('first_correct_dates_json', sanitizeJson) firstCorrectDates?: Record<string, string>;
  @json('personal_bests_json', sanitizeJson) personalBests?: Record<string, PersonalBest>;
  @json('error_patterns_json', sanitizeJson) errorPatterns?: Record<ErrorPattern, ErrorPatternStats>;
  @text('server_id') serverId?: string;
}
