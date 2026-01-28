/**
 * GameSession Model
 * Append-only events tracking individual game plays
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';
import type { CompletedWord, SessionWrongAttempt, GameModeId, TrophyTier } from '@/types';

// Sanitizer for JSON fields
const sanitizeJson = <T>(raw: unknown): T | undefined => {
  if (raw === null || raw === undefined) return undefined;
  return raw as T;
};

export class GameSession extends Model {
  static table = 'game_sessions';

  @text('child_id') childId!: string;
  @text('client_session_id') clientSessionId!: string;
  @text('mode') mode!: GameModeId;
  @field('played_at') playedAtRaw!: number;
  @field('duration_seconds') durationSeconds?: number;
  @field('words_attempted') wordsAttempted!: number;
  @field('words_correct') wordsCorrect!: number;
  @field('won') won!: boolean;
  @text('trophy') trophy?: TrophyTier;
  @json('completed_words_json', sanitizeJson) completedWords?: CompletedWord[];
  @json('wrong_attempts_json', sanitizeJson) wrongAttempts?: SessionWrongAttempt[];
  @text('server_id') serverId?: string;

  // Computed getter for ISO date string
  get playedAt(): string {
    return new Date(this.playedAtRaw).toISOString();
  }
}
