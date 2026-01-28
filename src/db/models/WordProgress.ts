/**
 * WordProgress Model
 * Tracks per-word mastery state for spaced repetition
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';
import type { WordAttempt, MasteryLevel } from '@/types';

// Sanitizer for JSON fields - handles null/undefined
const sanitizeJson = <T>(raw: unknown): T | undefined => {
  if (raw === null || raw === undefined) return undefined;
  return raw as T;
};

export class WordProgress extends Model {
  static table = 'word_progress';

  @text('child_id') childId!: string;
  @text('word_text') wordText!: string;
  @field('mastery_level') masteryLevel!: MasteryLevel;
  @field('correct_streak') correctStreak!: number;
  @field('times_used') timesUsed!: number;
  @field('times_correct') timesCorrect!: number;
  @field('last_attempt_at') lastAttemptAtRaw!: number | null;
  @field('next_review_at') nextReviewAtRaw!: number | null;
  @field('introduced_at') introducedAtRaw!: number | null;
  @field('is_active') isActive!: boolean;
  @field('archived_at') archivedAtRaw!: number | null;
  @text('definition') definition?: string;
  @text('example_sentence') exampleSentence?: string;
  @json('attempt_history_json', sanitizeJson) attemptHistory?: WordAttempt[];
  @text('server_id') serverId?: string;

  // Computed getters for ISO date strings
  get lastAttemptAt(): string | null {
    return this.lastAttemptAtRaw ? new Date(this.lastAttemptAtRaw).toISOString() : null;
  }

  get nextReviewAt(): string | null {
    return this.nextReviewAtRaw ? new Date(this.nextReviewAtRaw).toISOString() : null;
  }

  get introducedAt(): string | null {
    return this.introducedAtRaw ? new Date(this.introducedAtRaw).toISOString() : null;
  }

  get archivedAt(): string | null {
    return this.archivedAtRaw ? new Date(this.archivedAtRaw).toISOString() : null;
  }
}
