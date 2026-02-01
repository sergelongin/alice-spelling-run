/**
 * GradeProgress Model
 * Tracks per-grade level map progress and points
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export class GradeProgress extends Model {
  static table = 'grade_progress';

  @text('child_id') childId!: string;
  @field('grade_level') gradeLevel!: number;
  @field('total_points') totalPoints!: number;
  @field('current_milestone_index') currentMilestoneIndex!: number;
  @field('words_mastered') wordsMastered!: number;
  @date('first_point_at') firstPointAt?: Date;
  @date('last_activity_at') lastActivityAt?: Date;
  @date('client_updated_at') clientUpdatedAt?: Date;
  @text('server_id') serverId?: string;

}
