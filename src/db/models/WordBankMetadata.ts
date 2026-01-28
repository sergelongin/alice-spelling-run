/**
 * WordBankMetadata Model
 * Tracks daily word introduction limits
 */

import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class WordBankMetadata extends Model {
  static table = 'word_bank_metadata';

  @text('child_id') childId!: string;
  @field('last_updated') lastUpdatedRaw!: number;
  @text('last_new_word_date') lastNewWordDate?: string;
  @field('new_words_introduced_today') newWordsIntroducedToday!: number;

  // Computed getter for ISO date string
  get lastUpdated(): string {
    return new Date(this.lastUpdatedRaw).toISOString();
  }
}
