import { Word } from '@/types';

/**
 * Leitner intervals in days for each mastery level
 * Index = mastery level (0-5)
 */
export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 14, 7] as const;

/**
 * Compute the next review timestamp based on mastery level and last attempt time.
 * Uses Leitner spaced repetition intervals.
 *
 * @param masteryLevel - Current mastery level (0-5)
 * @param lastAttemptAt - Timestamp of last attempt (ms since epoch)
 * @returns Next review timestamp (ms since epoch)
 */
export function computeNextReviewAt(masteryLevel: number, lastAttemptAt: number): number {
  const intervalDays = LEITNER_INTERVALS_DAYS[Math.min(masteryLevel, 5)];
  return lastAttemptAt + (intervalDays * 24 * 60 * 60 * 1000);
}

/**
 * Configuration for the spaced repetition and gradual introduction system
 */
export const SPACED_REP_CONFIG = {
  maxNewWordsPerDay: 10,           // Maximum new words to introduce per day
  maxNewWordsPerSession: 2,        // Maximum new words per session
  maxStrugglingBeforePause: 15,    // Pause new words if too many struggling
  masteredSpotCheckIntervalDays: 7, // How often to spot-check mastered words
  masteredSpotCheckPerSession: 1,  // How many mastered words to spot-check per session
};

/**
 * Word states for the gradual introduction system
 */
export type WordState = 'available' | 'learning' | 'review' | 'mastered';

/**
 * Get the current state of a word in the learning lifecycle
 */
export const getWordState = (word: Word): WordState => {
  // Not yet introduced = available (waiting in queue)
  if (word.introducedAt === null) {
    return 'available';
  }
  // Mastery level 5 = mastered
  if (word.masteryLevel === 5) {
    return 'mastered';
  }
  // Mastery 0-1 = learning (needs frequent practice)
  if (word.masteryLevel <= 1) {
    return 'learning';
  }
  // Mastery 2-4 = review (spaced repetition)
  return 'review';
};

/**
 * Categorize words by their learning state
 */
export const categorizeWordsByState = (words: Word[]): {
  available: Word[];  // Not yet introduced
  learning: Word[];   // Mastery 0-1, needs frequent practice
  review: Word[];     // Mastery 2-4, spaced repetition
  mastered: Word[];   // Mastery 5, weekly spot-check
} => {
  return {
    available: words.filter(w => getWordState(w) === 'available'),
    learning: words.filter(w => getWordState(w) === 'learning'),
    review: words.filter(w => getWordState(w) === 'review'),
    mastered: words.filter(w => getWordState(w) === 'mastered'),
  };
};

/**
 * Calculate days since a given ISO date string
 */
export const daysSince = (isoDateString: string | null): number => {
  if (!isoDateString) return Infinity;
  const date = new Date(isoDateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Pick random items from an array
 */
const pickRandom = <T>(array: T[], count: number): T[] => {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
};

/**
 * Check if a word is due for review based on spaced repetition
 */
export const isWordDueForReview = (word: Word): boolean => {
  const now = new Date();
  const nextReview = new Date(word.nextReviewAt);
  return nextReview <= now;
};

/**
 * Categorize words by mastery level (legacy, for backwards compatibility)
 */
export const categorizeWordsByMastery = (words: Word[]): {
  struggling: Word[];  // Mastery 0-1: Need frequent review
  practicing: Word[];  // Mastery 2-3: Making progress
  confident: Word[];   // Mastery 4-5: Approaching mastery
} => {
  return {
    struggling: words.filter(w => w.masteryLevel <= 1),
    practicing: words.filter(w => w.masteryLevel === 2 || w.masteryLevel === 3),
    confident: words.filter(w => w.masteryLevel >= 4),
  };
};

/**
 * Check if we can introduce new words based on current learning state
 */
export const canIntroduceNewWords = (words: Word[]): { canIntroduce: boolean; reason?: string } => {
  const { available, learning } = categorizeWordsByState(words);

  if (available.length === 0) {
    return { canIntroduce: false, reason: 'No available words to introduce' };
  }

  if (learning.length >= SPACED_REP_CONFIG.maxStrugglingBeforePause) {
    return {
      canIntroduce: false,
      reason: `Too many words being learned (${learning.length}). Master some first!`,
    };
  }

  return { canIntroduce: true };
};

/**
 * Get mastered words that need a weekly spot-check
 */
const getMasteredNeedingSpotCheck = (mastered: Word[]): Word[] => {
  return mastered.filter(w =>
    daysSince(w.lastMasteredCheckAt) >= SPACED_REP_CONFIG.masteredSpotCheckIntervalDays
  );
};

/**
 * Pick words prioritized by how long since they were last practiced
 * (oldest lastAttemptAt first, with some randomness)
 */
const pickPrioritizedByAge = (words: Word[], count: number): Word[] => {
  if (words.length === 0) return [];

  // Sort by last attempt (oldest first, never-attempted first)
  const sorted = [...words].sort((a, b) => {
    if (!a.lastAttemptAt && !b.lastAttemptAt) return 0;
    if (!a.lastAttemptAt) return -1;
    if (!b.lastAttemptAt) return 1;
    return new Date(a.lastAttemptAt).getTime() - new Date(b.lastAttemptAt).getTime();
  });

  // Take the top candidates (2x requested), then pick randomly from those
  // This ensures older words are prioritized but with some variety
  const candidates = sorted.slice(0, Math.min(count * 2, sorted.length));
  return pickRandom(candidates, count);
};

/**
 * Pick review words that are due for review (spaced repetition)
 */
const pickDueReviewWords = (reviewWords: Word[], count: number): Word[] => {
  const due = reviewWords.filter(isWordDueForReview);
  if (due.length >= count) {
    return pickPrioritizedByAge(due, count);
  }
  // If not enough due, include some not-yet-due review words
  const notDue = reviewWords.filter(w => !isWordDueForReview(w));
  return [...pickPrioritizedByAge(due, due.length), ...pickRandom(notDue, count - due.length)];
};

/**
 * Pick learning words that are due for review (respects next_review_at)
 * Learning words also follow spaced repetition, just with shorter intervals
 */
const pickDueLearningWords = (learningWords: Word[], count: number): Word[] => {
  const due = learningWords.filter(isWordDueForReview);
  if (due.length >= count) {
    return pickPrioritizedByAge(due, count);
  }
  // If not enough due, include some not-yet-due learning words
  const notDue = learningWords.filter(w => !isWordDueForReview(w));
  return [...pickPrioritizedByAge(due, due.length), ...pickRandom(notDue, count - due.length)];
};

/**
 * Result of word selection, including which words to introduce
 */
export interface WordSelectionResult {
  words: string[];           // Selected word texts for the session
  wordsToIntroduce: string[]; // Words that need to be marked as introduced
  spotCheckWords: string[];   // Mastered words being spot-checked
}

/**
 * Selects words using gradual introduction and spaced repetition
 *
 * Word Lifecycle:
 * - Available: Not yet introduced (waiting in queue)
 * - Learning: Mastery 0-1 (needs frequent practice)
 * - Review: Mastery 2-4 (spaced repetition intervals)
 * - Mastered: Mastery 5 (weekly spot-check only)
 *
 * Session Composition (for 8-word session):
 * - 1-2 NEW words (if eligible)
 * - 3-4 LEARNING words (frequent practice)
 * - 2-3 REVIEW words (due for review)
 * - 0-1 MASTERED word (weekly spot-check)
 */
export const selectWordsForSession = (
  words: Word[],
  count: number
): string[] => {
  const result = selectWordsForSessionDetailed(words, count);
  return result.words;
};

/**
 * Detailed word selection that returns information about which words
 * need to be introduced and which are spot-checks
 */
export const selectWordsForSessionDetailed = (
  words: Word[],
  count: number
): WordSelectionResult => {
  // Filter out archived words first
  const activeWords = words.filter(w => w.isActive !== false);

  if (activeWords.length === 0) {
    return { words: [], wordsToIntroduce: [], spotCheckWords: [] };
  }

  // Categorize words by learning state
  const { available, learning, review, mastered } = categorizeWordsByState(activeWords);

  // Calculate how many introduced words we have (learning + review + mastered)
  const introducedWords = [...learning, ...review, ...mastered];

  // If we have fewer introduced words than requested, we need to include available words
  // even if we wouldn't normally introduce them
  if (introducedWords.length < count && available.length > 0) {
    // We need to pull from available to fill the session
    const neededFromAvailable = Math.min(count - introducedWords.length, available.length);
    const toIntroduce = pickRandom(available, neededFromAvailable);
    const allAvailable = [...introducedWords, ...toIntroduce];
    return {
      words: shuffleArray(allAvailable).slice(0, count).map(w => w.text),
      wordsToIntroduce: toIntroduce.map(w => w.text),
      spotCheckWords: [],
    };
  }

  // Normal case: we have enough introduced words
  const selected: Word[] = [];
  const wordsToIntroduce: Word[] = [];
  const spotCheckWords: Word[] = [];

  // 1. Determine if we can/should introduce new words
  const { canIntroduce } = canIntroduceNewWords(words);
  let newWordQuota = 0;
  if (canIntroduce && available.length > 0) {
    newWordQuota = Math.min(
      SPACED_REP_CONFIG.maxNewWordsPerSession,
      available.length,
      Math.max(1, Math.floor(count * 0.25)) // At most 25% of session
    );
    const newWords = pickRandom(available, newWordQuota);
    selected.push(...newWords);
    wordsToIntroduce.push(...newWords);
  }

  // 2. Check if mastered words need spot-check
  const needsSpotCheck = getMasteredNeedingSpotCheck(mastered);
  let spotCheckQuota = 0;
  if (needsSpotCheck.length > 0) {
    spotCheckQuota = Math.min(SPACED_REP_CONFIG.masteredSpotCheckPerSession, needsSpotCheck.length);
    const spotChecks = pickRandom(needsSpotCheck, spotCheckQuota);
    selected.push(...spotChecks);
    spotCheckWords.push(...spotChecks);
  }

  // 3. Add learning words (high frequency practice, but respects next_review_at)
  const remainingSlots = count - selected.length;
  const learningQuota = Math.min(
    Math.ceil(remainingSlots * 0.6), // ~60% of remaining slots
    learning.length
  );
  if (learningQuota > 0) {
    selected.push(...pickDueLearningWords(learning, learningQuota));
  }

  // 4. Fill remaining with review words
  const reviewQuota = count - selected.length;
  if (reviewQuota > 0 && review.length > 0) {
    selected.push(...pickDueReviewWords(review, reviewQuota));
  }

  // 5. If still not enough, pull from any introduced words
  if (selected.length < count) {
    const selectedIds = new Set(selected.map(w => w.id));
    const remaining = introducedWords.filter(w => !selectedIds.has(w.id));
    const needed = count - selected.length;
    selected.push(...pickRandom(remaining, needed));
  }

  return {
    words: shuffleArray(selected).slice(0, count).map(w => w.text),
    wordsToIntroduce: wordsToIntroduce.map(w => w.text),
    spotCheckWords: spotCheckWords.map(w => w.text),
  };
};

/**
 * Legacy function: Selects random words without spaced repetition
 * Use selectWordsForSession instead for better learning outcomes
 */
export const selectRandomWordsForSession = (
  words: Word[],
  count: number
): string[] => {
  if (words.length === 0) return [];

  const shuffled = shuffleArray(words);
  const selected = shuffled.slice(0, Math.min(count, words.length));

  return selected.map(w => w.text);
};

/**
 * Validates a word for the word bank
 */
export const validateWord = (word: string): { valid: boolean; error?: string } => {
  const trimmed = word.trim().toLowerCase();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Word must be at least 2 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Word must be 20 characters or less' };
  }

  if (!/^[a-z]+$/.test(trimmed)) {
    return { valid: false, error: 'Word must contain only letters' };
  }

  return { valid: true };
};

/**
 * Compares user input with the correct word and returns indices of incorrect letters
 */
export const findIncorrectIndices = (
  input: string,
  correctWord: string
): number[] => {
  const incorrect: number[] = [];
  const inputLower = input.toLowerCase();
  const correctLower = correctWord.toLowerCase();

  for (let i = 0; i < correctLower.length; i++) {
    if (inputLower[i] !== correctLower[i]) {
      incorrect.push(i);
    }
  }

  return incorrect;
};
