/**
 * WordAttempt Model
 * Normalized table for word attempt history
 * Insert-only sync (like GameSession) for multi-device safety
 */

import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { GameModeId } from '@/types';

export class WordAttemptModel extends Model {
  static table = 'word_attempts';

  @text('child_id') childId!: string;
  @text('word_text') wordText!: string;
  @text('client_attempt_id') clientAttemptId!: string;
  @field('attempt_number') attemptNumber?: number;
  @text('typed_text') typedText!: string;
  @field('was_correct') wasCorrect!: boolean;
  @text('mode') mode!: GameModeId;
  @field('time_ms') timeMs?: number;
  @field('attempted_at') attemptedAtRaw!: number;
  @text('session_id') sessionId?: string;
  @text('server_id') serverId?: string;

  // Computed getter for ISO date string
  get attemptedAt(): string {
    return new Date(this.attemptedAtRaw).toISOString();
  }
}
