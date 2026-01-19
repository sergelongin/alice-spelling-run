import { Word, GameStatistics } from './index';

/**
 * Achievement types for the Word Bank Child Mode.
 * Achievements are calculated from existing data rather than stored separately.
 */

export type AchievementId =
  | 'streak-master-3'
  | 'streak-master-5'
  | 'streak-master-7'
  | 'first-timer'
  | 'word-wizard-10'
  | 'word-wizard-25'
  | 'word-wizard-50'
  | 'quick-speller'
  | 'perfect-week';

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string; // Emoji icon
  tier?: number; // For tiered achievements (e.g., streak-master has 3 tiers)
  isEarned: boolean;
  earnedAt?: string; // ISO date when earned (calculated)
  progress?: number; // Progress towards earning (0-1)
  progressText?: string; // Human readable progress
}

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  tier?: number;
}

/**
 * Achievement definitions - metadata about each achievement
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'streak-master-3',
    name: 'Streak Starter',
    description: 'Practice for 3 days in a row',
    icon: '🔥',
    tier: 1,
  },
  {
    id: 'streak-master-5',
    name: 'Streak Champion',
    description: 'Practice for 5 days in a row',
    icon: '🔥',
    tier: 2,
  },
  {
    id: 'streak-master-7',
    name: 'Streak Master',
    description: 'Practice for 7 days in a row',
    icon: '🔥',
    tier: 3,
  },
  {
    id: 'first-timer',
    name: 'First Steps',
    description: 'Spell your first word correctly',
    icon: '⭐',
  },
  {
    id: 'word-wizard-10',
    name: 'Word Learner',
    description: 'Master 10 words',
    icon: '📚',
    tier: 1,
  },
  {
    id: 'word-wizard-25',
    name: 'Word Scholar',
    description: 'Master 25 words',
    icon: '📚',
    tier: 2,
  },
  {
    id: 'word-wizard-50',
    name: 'Word Wizard',
    description: 'Master 50 words',
    icon: '📚',
    tier: 3,
  },
  {
    id: 'quick-speller',
    name: 'Quick Speller',
    description: 'Spell a word correctly in under 3 seconds',
    icon: '⚡',
  },
  {
    id: 'perfect-week',
    name: 'Perfect Week',
    description: '100% accuracy for 7 days straight',
    icon: '✨',
  },
];

/**
 * Calculate practice streak from word attempt history.
 * Returns the current number of consecutive days with practice.
 */
export function calculatePracticeStreak(words: Word[]): number {
  // Collect all attempt dates across all words
  const attemptDates = new Set<string>();

  for (const word of words) {
    if (word.attemptHistory) {
      for (const attempt of word.attemptHistory) {
        // Extract date (YYYY-MM-DD) from timestamp
        const date = attempt.timestamp.split('T')[0];
        attemptDates.add(date);
      }
    }
  }

  if (attemptDates.size === 0) return 0;

  // Sort dates in descending order
  const sortedDates = Array.from(attemptDates).sort().reverse();

  // Check if today or yesterday has practice (streak must be current)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  let currentDate = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    if (sortedDates[i] === prevDateStr) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Check if any word has been spelled correctly
 */
export function hasFirstCorrectSpelling(words: Word[]): boolean {
  return words.some(word => word.timesCorrect > 0);
}

/**
 * Get the date of the first correct spelling
 */
export function getFirstCorrectDate(words: Word[]): string | undefined {
  let earliestDate: string | undefined;

  for (const word of words) {
    if (word.attemptHistory) {
      for (const attempt of word.attemptHistory) {
        if (attempt.wasCorrect) {
          if (!earliestDate || attempt.timestamp < earliestDate) {
            earliestDate = attempt.timestamp;
          }
        }
      }
    }
  }

  return earliestDate;
}

/**
 * Count mastered words (mastery level 5)
 */
export function countMasteredWords(words: Word[]): number {
  return words.filter(w => w.masteryLevel === 5 && w.isActive !== false).length;
}

/**
 * Check if any word has been spelled in under 3 seconds
 */
export function hasQuickSpelling(words: Word[]): { achieved: boolean; date?: string } {
  for (const word of words) {
    if (word.attemptHistory) {
      for (const attempt of word.attemptHistory) {
        if (attempt.wasCorrect && attempt.timeMs && attempt.timeMs < 3000) {
          return { achieved: true, date: attempt.timestamp };
        }
      }
    }
  }
  return { achieved: false };
}

/**
 * Check for perfect week (100% accuracy over 7 consecutive days)
 */
export function hasPerfectWeek(words: Word[]): { achieved: boolean; date?: string } {
  // Group attempts by date
  const attemptsByDate = new Map<string, { correct: number; total: number }>();

  for (const word of words) {
    if (word.attemptHistory) {
      for (const attempt of word.attemptHistory) {
        const date = attempt.timestamp.split('T')[0];
        const existing = attemptsByDate.get(date) || { correct: 0, total: 0 };
        existing.total++;
        if (attempt.wasCorrect) existing.correct++;
        attemptsByDate.set(date, existing);
      }
    }
  }

  // Need at least 7 days of data
  const dates = Array.from(attemptsByDate.keys()).sort();
  if (dates.length < 7) return { achieved: false };

  // Check for 7 consecutive perfect days
  for (let i = 0; i <= dates.length - 7; i++) {
    let consecutive = 0;
    let startDate = new Date(dates[i]);

    for (let j = 0; j < 7; j++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + j);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      const dayStats = attemptsByDate.get(checkDateStr);
      if (dayStats && dayStats.total > 0 && dayStats.correct === dayStats.total) {
        consecutive++;
      } else {
        break;
      }
    }

    if (consecutive === 7) {
      // Return the last day of the perfect week
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      return { achieved: true, date: endDate.toISOString() };
    }
  }

  return { achieved: false };
}

/**
 * Calculate all achievements for a user
 * @param words - All words in the word bank
 * @param _statistics - Game statistics (reserved for future achievements)
 */
export function calculateAchievements(words: Word[], _statistics: GameStatistics): Achievement[] {
  const achievements: Achievement[] = [];
  const streak = calculatePracticeStreak(words);
  const masteredCount = countMasteredWords(words);
  const hasFirst = hasFirstCorrectSpelling(words);
  const firstDate = getFirstCorrectDate(words);
  const quickSpell = hasQuickSpelling(words);
  const perfectWeek = hasPerfectWeek(words);

  // Streak achievements
  for (const def of ACHIEVEMENT_DEFINITIONS.filter(d => d.id.startsWith('streak-master'))) {
    const requiredDays = parseInt(def.id.split('-')[2]);
    achievements.push({
      ...def,
      isEarned: streak >= requiredDays,
      progress: Math.min(1, streak / requiredDays),
      progressText: `${streak}/${requiredDays} days`,
    });
  }

  // First timer achievement
  achievements.push({
    ...ACHIEVEMENT_DEFINITIONS.find(d => d.id === 'first-timer')!,
    isEarned: hasFirst,
    earnedAt: firstDate,
    progress: hasFirst ? 1 : 0,
  });

  // Word wizard achievements
  for (const def of ACHIEVEMENT_DEFINITIONS.filter(d => d.id.startsWith('word-wizard'))) {
    const requiredWords = parseInt(def.id.split('-')[2]);
    achievements.push({
      ...def,
      isEarned: masteredCount >= requiredWords,
      progress: Math.min(1, masteredCount / requiredWords),
      progressText: `${masteredCount}/${requiredWords} words`,
    });
  }

  // Quick speller achievement
  achievements.push({
    ...ACHIEVEMENT_DEFINITIONS.find(d => d.id === 'quick-speller')!,
    isEarned: quickSpell.achieved,
    earnedAt: quickSpell.date,
    progress: quickSpell.achieved ? 1 : 0,
  });

  // Perfect week achievement
  achievements.push({
    ...ACHIEVEMENT_DEFINITIONS.find(d => d.id === 'perfect-week')!,
    isEarned: perfectWeek.achieved,
    earnedAt: perfectWeek.date,
    progress: perfectWeek.achieved ? 1 : 0,
  });

  return achievements;
}

/**
 * Get words that were recently mastered (within the last 7 days)
 */
export function getRecentlyMasteredWords(words: Word[], limit: number = 8): Word[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find mastered words and sort by when they reached mastery level 5
  // We approximate this by finding the latest successful attempt that pushed them to level 5
  const masteredWords = words
    .filter(w => w.masteryLevel === 5 && w.isActive !== false)
    .map(word => {
      // Find the most recent correct attempt (approximate mastery date)
      const lastCorrect = word.attemptHistory?.find(a => a.wasCorrect);
      return {
        word,
        masteryDate: lastCorrect?.timestamp || word.lastAttemptAt || word.addedAt,
      };
    })
    .filter(({ masteryDate }) => new Date(masteryDate) >= sevenDaysAgo)
    .sort((a, b) => new Date(b.masteryDate).getTime() - new Date(a.masteryDate).getTime())
    .slice(0, limit)
    .map(({ word }) => word);

  return masteredWords;
}

/**
 * Get count of words due for practice today
 */
export function getWordsDueCount(words: Word[]): number {
  const now = new Date();

  return words.filter(word => {
    if (word.isActive === false) return false;
    if (word.introducedAt === null) return false; // Not yet introduced
    const nextReview = new Date(word.nextReviewAt);
    return nextReview <= now;
  }).length;
}

/**
 * Get encouraging message based on current state
 */
export function getTodaysMissionMessage(
  dueCount: number,
  masteredCount: number,
  totalCount: number,
  canIntroduceNew: boolean
): { title: string; subtitle: string } {
  if (dueCount > 0) {
    return {
      title: `${dueCount} word${dueCount === 1 ? '' : 's'} ready to practice!`,
      subtitle: dueCount === 1 ? "Let's master this word!" : "Let's do this!",
    };
  }

  if (canIntroduceNew && totalCount > masteredCount) {
    return {
      title: 'Ready for new challenges?',
      subtitle: "Time to learn some new words!",
    };
  }

  if (masteredCount === totalCount && totalCount > 0) {
    return {
      title: 'Amazing! All words mastered!',
      subtitle: 'Add more words to keep learning!',
    };
  }

  return {
    title: "You're all caught up!",
    subtitle: 'Check back later for more practice.',
  };
}
