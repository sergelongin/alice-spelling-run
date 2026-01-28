/**
 * Calibration Model
 * Stores calibration assessment results
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';
import type { CalibrationAttempt, GradeScore } from '@/types';
import type { GradeLevel } from '@/data/gradeWords';

// Sanitizer for JSON fields
const sanitizeJson = <T>(raw: unknown): T | undefined => {
  if (raw === null || raw === undefined) return undefined;
  return raw as T;
};

export class Calibration extends Model {
  static table = 'calibration';

  @text('child_id') childId!: string;
  @text('client_calibration_id') clientCalibrationId!: string;
  @field('completed_at') completedAtRaw!: number;
  @text('status') status!: 'completed' | 'skipped';
  @field('recommended_grade') recommendedGrade!: GradeLevel;
  @text('confidence') confidence!: 'high' | 'medium' | 'low';
  @field('total_time_ms') totalTimeMs?: number;
  @json('attempts_json', sanitizeJson) attempts?: CalibrationAttempt[];
  @json('grade_scores_json', sanitizeJson) gradeScores?: Record<GradeLevel, GradeScore>;
  @text('server_id') serverId?: string;

  // Computed getter for ISO date string
  get completedAt(): string {
    return new Date(this.completedAtRaw).toISOString();
  }
}
