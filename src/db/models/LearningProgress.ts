/**
 * LearningProgress Model
 * Tracks level map progress and points (global lifetime points)
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json, date } from '@nozbe/watermelondb/decorators';
import type { PointEvent } from '@/types';

// Sanitizer for JSON fields
const sanitizeJson = <T>(raw: unknown): T | undefined => {
  if (raw === null || raw === undefined) return undefined;
  return raw as T;
};

export class LearningProgress extends Model {
  static table = 'learning_progress';

  @text('child_id') childId!: string;
  @field('total_points') totalPoints!: number; // Legacy field for backward compatibility
  @field('total_lifetime_points') totalLifetimePoints!: number; // Global lifetime points for sync
  @field('current_milestone_index') currentMilestoneIndex!: number;
  @field('milestone_progress') milestoneProgress!: number;
  @json('point_history_json', sanitizeJson) pointHistory?: PointEvent[];
  @date('client_updated_at') clientUpdatedAt?: Date;
  @text('server_id') serverId?: string;
}
