import type { GameModeId } from './gameMode';

// Mastery level for spaced repetition (Leitner system boxes)
// 0 = new/struggling, 5 = mastered
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Record of a single spelling attempt for detailed history tracking
 */
export interface WordAttempt {
  id: string;
  timestamp: string;           // ISO date string
  wasCorrect: boolean;
  typedText: string;           // What the user typed
  mode: GameModeId;            // Which game mode
  timeMs?: number;             // Time to spell (if correct, timed mode)
  attemptNumber?: number;      // Which try in the session (1st, 2nd, etc.)
}

// Spacing intervals in days for each mastery level
export const MASTERY_INTERVALS: Record<MasteryLevel, number> = {
  0: 0,   // Review immediately
  1: 1,   // Review tomorrow
  2: 3,   // Review in 3 days
  3: 7,   // Review in a week
  4: 14,  // Review in 2 weeks
  5: 30,  // Review monthly (mastered)
};

// Minimum streak required to advance TO each level
// Levels 4-5 require proven consistency before longer review intervals
export const STREAK_REQUIRED_FOR_LEVEL: Record<MasteryLevel, number> = {
  0: 0,  // N/A
  1: 1,  // 1 correct to reach level 1
  2: 1,  // 1 correct to reach level 2
  3: 1,  // 1 correct to reach level 3
  4: 2,  // 2 consecutive to reach level 4 (14-day interval)
  5: 2,  // 2 consecutive to reach Mastered (30-day interval)
};

export interface Word {
  id: string;
  text: string;
  addedAt: string;
  timesUsed: number;
  timesCorrect: number;

  // Spaced repetition fields
  masteryLevel: MasteryLevel;
  correctStreak: number;        // Consecutive correct spellings
  lastAttemptAt: string | null; // ISO date string
  nextReviewAt: string;         // ISO date string - when to review next

  // Gradual introduction fields
  introducedAt: string | null;       // null = available but not yet introduced into rotation
  lastMasteredCheckAt: string | null; // When mastered word was last spot-checked

  // Definition fields (optional - may not be available for user-added words)
  definition?: string;        // Kid-friendly definition
  exampleSentence?: string;   // Word used in a sentence

  // Detailed attempt history
  attemptHistory: WordAttempt[];

  // Archive status (allows hiding words while preserving history)
  isActive: boolean;           // false = archived/hidden from selection
  archivedAt: string | null;   // When word was archived (null if active)
}

export interface WordBank {
  words: Word[];
  lastUpdated: string;

  // Daily introduction tracking
  lastNewWordDate: string | null;    // Date (YYYY-MM-DD) when new words were last introduced
  newWordsIntroducedToday: number;   // Count of words introduced today
}

/**
 * Options for creating a new word
 */
export interface CreateWordOptions {
  immediatelyIntroduced?: boolean;
  definition?: string;
  exampleSentence?: string;
}

/**
 * Create a new word for the word bank
 * @param text - The word text
 * @param options - Optional configuration including:
 *   - immediatelyIntroduced: If true, word is introduced immediately (manual additions).
 *                            If false, word is available but not yet introduced (grade imports).
 *   - definition: Kid-friendly definition of the word
 *   - exampleSentence: Word used in a sentence
 */
export const createWord = (text: string, options: CreateWordOptions | boolean = true): Word => {
  // Support legacy boolean parameter for backwards compatibility
  const opts: CreateWordOptions = typeof options === 'boolean'
    ? { immediatelyIntroduced: options }
    : options;

  const immediatelyIntroduced = opts.immediatelyIntroduced ?? true;
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    text: text.toLowerCase().trim(),
    addedAt: now,
    timesUsed: 0,
    timesCorrect: 0,

    // Initialize spaced repetition fields - new words start at level 0, due immediately
    masteryLevel: 0,
    correctStreak: 0,
    lastAttemptAt: null,
    nextReviewAt: now, // Due immediately when introduced

    // Gradual introduction fields
    introducedAt: immediatelyIntroduced ? now : null, // null = waiting in queue
    lastMasteredCheckAt: null,

    // Definition fields
    definition: opts.definition,
    exampleSentence: opts.exampleSentence,

    // Detailed attempt history
    attemptHistory: [],

    // Archive status - new words are active by default
    isActive: true,
    archivedAt: null,
  };
};

/**
 * Update word mastery after a spelling attempt
 * Based on Leitner system with SM-2 inspired adjustments
 *
 * @param word - The word to update
 * @param wasCorrect - True if spelled correctly on FIRST TRY (same-session retry = false)
 */
export const updateWordMastery = (word: Word, wasCorrect: boolean): Word => {
  const now = new Date();
  let newLevel: MasteryLevel;
  let newStreak: number;

  if (wasCorrect) {
    // Increment streak first
    newStreak = word.correctStreak + 1;

    // Check if streak meets requirement for advancement
    const targetLevel = Math.min(5, word.masteryLevel + 1) as MasteryLevel;
    const streakRequired = STREAK_REQUIRED_FOR_LEVEL[targetLevel];

    if (newStreak >= streakRequired) {
      newLevel = targetLevel;
    } else {
      // Stay at current level, building streak
      newLevel = word.masteryLevel;
    }
  } else {
    // Drop back 2 boxes (min 0) - creates "desirable difficulty"
    newLevel = Math.max(0, word.masteryLevel - 2) as MasteryLevel;
    newStreak = 0;
  }

  // Calculate next review date based on new mastery level
  const daysUntilReview = MASTERY_INTERVALS[newLevel];
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + daysUntilReview);

  return {
    ...word,
    masteryLevel: newLevel,
    correctStreak: newStreak,
    lastAttemptAt: now.toISOString(),
    nextReviewAt: nextReview.toISOString(),
    timesUsed: word.timesUsed + 1,
    timesCorrect: wasCorrect ? word.timesCorrect + 1 : word.timesCorrect,
  };
};

/**
 * Migrate old word format to include mastery, introduction, definition, attempt history, and archive fields
 * Existing words are treated as already introduced (introducedAt = addedAt)
 */
export const migrateWord = (oldWord: Partial<Word>): Word => {
  const addedAt = oldWord.addedAt || new Date().toISOString();
  return {
    id: oldWord.id || crypto.randomUUID(),
    text: oldWord.text || '',
    addedAt,
    timesUsed: oldWord.timesUsed || 0,
    timesCorrect: oldWord.timesCorrect || 0,
    // Add mastery fields with defaults
    masteryLevel: oldWord.masteryLevel ?? 0,
    correctStreak: oldWord.correctStreak ?? 0,
    lastAttemptAt: oldWord.lastAttemptAt ?? null,
    nextReviewAt: oldWord.nextReviewAt ?? new Date().toISOString(),
    // Gradual introduction fields - treat existing words as already introduced
    introducedAt: oldWord.introducedAt ?? addedAt,
    lastMasteredCheckAt: oldWord.lastMasteredCheckAt ?? null,
    // Definition fields - preserve if they exist
    definition: oldWord.definition,
    exampleSentence: oldWord.exampleSentence,
    // Attempt history - preserve if exists, otherwise empty array
    attemptHistory: oldWord.attemptHistory ?? [],
    // Archive status - existing words default to active
    isActive: oldWord.isActive ?? true,
    archivedAt: oldWord.archivedAt ?? null,
  };
};
