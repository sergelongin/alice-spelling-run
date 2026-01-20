import type { WordBank, GameStatistics } from '@/types';
import { createInitialStatistics } from '@/types';
import type { ChildData } from '@/types/parent';

// Storage keys matching GameContext
const getWordBankKey = (childId: string) => `alice-spelling-run-word-bank-${childId}`;
const getStatisticsKey = (childId: string) => `alice-spelling-run-statistics-${childId}`;

const initialWordBank: WordBank = {
  words: [],
  lastUpdated: new Date().toISOString(),
  lastNewWordDate: null,
  newWordsIntroducedToday: 0,
};

/**
 * Read a child's word bank from localStorage
 */
export function getChildWordBank(childId: string): WordBank {
  try {
    const key = getWordBankKey(childId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`Failed to read word bank for child ${childId}:`, e);
  }
  return initialWordBank;
}

/**
 * Read a child's statistics from localStorage
 */
export function getChildStatistics(childId: string): GameStatistics {
  try {
    const key = getStatisticsKey(childId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`Failed to read statistics for child ${childId}:`, e);
  }
  return createInitialStatistics();
}

/**
 * Read all data for a child
 */
export function getChildData(childId: string): ChildData {
  return {
    wordBank: getChildWordBank(childId),
    statistics: getChildStatistics(childId),
  };
}

/**
 * Calculate overall accuracy from a word bank
 */
export function calculateAccuracy(wordBank: WordBank): number {
  let total = 0;
  let correct = 0;
  for (const word of wordBank.words) {
    total += word.timesUsed;
    correct += word.timesCorrect;
  }
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * Get the most recent activity date from a word bank
 */
export function getLastActivityDate(wordBank: WordBank): string | null {
  let lastDate: string | null = null;
  for (const word of wordBank.words) {
    if (word.lastAttemptAt) {
      if (!lastDate || word.lastAttemptAt > lastDate) {
        lastDate = word.lastAttemptAt;
      }
    }
  }
  return lastDate;
}

/**
 * Calculate days since last activity
 */
export function getDaysSinceActivity(lastActivityDate: string | null): number | null {
  if (!lastActivityDate) return null;
  const last = new Date(lastActivityDate);
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Count mastered words (masteryLevel === 5)
 */
export function countMasteredWords(wordBank: WordBank): number {
  return wordBank.words.filter(w => w.isActive !== false && w.masteryLevel === 5).length;
}

/**
 * Count active words (not archived)
 */
export function countActiveWords(wordBank: WordBank): number {
  return wordBank.words.filter(w => w.isActive !== false).length;
}

/**
 * Calculate practice streak from word bank
 */
export function calculateStreak(wordBank: WordBank): number {
  // Get all attempt dates
  const attemptDates = new Set<string>();
  for (const word of wordBank.words) {
    if (word.attemptHistory) {
      for (const attempt of word.attemptHistory) {
        const date = attempt.timestamp.split('T')[0];
        attemptDates.add(date);
      }
    }
  }

  if (attemptDates.size === 0) return 0;

  // Sort dates descending
  const sortedDates = Array.from(attemptDates).sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if there's activity today or yesterday
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }

  // Count consecutive days
  let streak = 0;
  let currentDate = sortedDates[0] === today ? today : yesterday;

  for (const date of sortedDates) {
    if (date === currentDate) {
      streak++;
      // Move to previous day
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      currentDate = prevDate.toISOString().split('T')[0];
    } else if (date < currentDate) {
      break;
    }
  }

  return streak;
}

/**
 * Get struggling words (low accuracy, has been attempted)
 */
export function getStrugglingWordsList(wordBank: WordBank): string[] {
  return wordBank.words
    .filter(w => {
      if (w.isActive === false) return false;
      if (w.timesUsed < 2) return false;
      const accuracy = w.timesUsed > 0 ? (w.timesCorrect / w.timesUsed) * 100 : 100;
      return accuracy < 60;
    })
    .map(w => w.text);
}
