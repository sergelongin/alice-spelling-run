/**
 * WordCatalog Model
 * Local cache of system words and parent's custom words from Supabase.
 * Pull-only sync - the client never modifies this data directly.
 */

import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import type { GradeLevel } from '@/data/gradeWords';

export class WordCatalog extends Model {
  static table = 'word_catalog';

  @text('word_text') wordText!: string;
  @text('word_normalized') wordNormalized!: string;
  @text('definition') definition!: string;
  @text('example_sentence') exampleSentence?: string;
  @field('grade_level') gradeLevel!: GradeLevel;
  @field('is_custom') isCustom!: boolean;
  @text('created_by') createdBy?: string; // parent_id for custom words
  @text('server_id') serverId!: string; // Supabase word ID
  @field('server_updated_at') serverUpdatedAt!: number; // For incremental sync
}
