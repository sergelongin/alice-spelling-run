/**
 * useChildData - Hook for reading any child's data from WatermelonDB
 * Used by parent dashboard components to view child data
 *
 * This hook replaces the localStorage-based childDataReader functions
 * with reactive WatermelonDB queries.
 */

import { useState, useEffect, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import type { WordProgress, GameSession, Statistics } from '@/db/models';
import type {
  Word,
  WordBank,
  GameStatistics,
  ModeStatistics,
  TrophyTier,
  StatsModeId,
  GameResult,
} from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseChildDataResult {
  /** The child's word bank */
  wordBank: WordBank;
  /** The child's statistics */
  statistics: GameStatistics;
  /** Loading state */
  isLoading: boolean;
}

// =============================================================================
// HELPER FUNCTIONS (pure, no localStorage)
// =============================================================================

/**
 * Calculate overall accuracy from a word bank using attemptHistory
 */
export function calculateAccuracy(wordBank: WordBank): number {
  let total = 0;
  let correct = 0;
  for (const word of wordBank.words) {
    const attempts = word.attemptHistory || [];
    total += attempts.length;
    correct += attempts.filter(a => a.wasCorrect).length;
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
 * Get struggling words (low accuracy, has been attempted) using attemptHistory
 */
export function getStrugglingWordsList(wordBank: WordBank): string[] {
  return wordBank.words
    .filter(w => {
      if (w.isActive === false) return false;
      const attempts = w.attemptHistory || [];
      if (attempts.length < 2) return false;
      const correctCount = attempts.filter(a => a.wasCorrect).length;
      const accuracy = attempts.length > 0 ? (correctCount / attempts.length) * 100 : 100;
      return accuracy < 60;
    })
    .map(w => w.text);
}

// =============================================================================
// MODEL CONVERTERS
// =============================================================================

function wordProgressToWord(wp: WordProgress): Word {
  return {
    id: wp.id,
    text: wp.wordText,
    addedAt: wp.introducedAt || new Date().toISOString(),
    timesUsed: wp.timesUsed,
    timesCorrect: wp.timesCorrect,
    masteryLevel: wp.masteryLevel,
    correctStreak: wp.correctStreak,
    lastAttemptAt: wp.lastAttemptAt,
    nextReviewAt: wp.nextReviewAt || new Date().toISOString(),
    introducedAt: wp.introducedAt,
    lastMasteredCheckAt: null,
    definition: wp.definition,
    exampleSentence: wp.exampleSentence,
    attemptHistory: wp.attemptHistory || [],
    isActive: wp.isActive,
    archivedAt: wp.archivedAt,
  };
}

function gameSessionToGameResult(gs: GameSession): GameResult {
  // Derive finalLives from trophy tier for won games
  let finalLives = 0;
  if (gs.won && gs.trophy) {
    switch (gs.trophy) {
      case 'platinum': finalLives = 5; break;
      case 'gold': finalLives = 4; break;
      case 'silver': finalLives = 3; break;
      case 'bronze': finalLives = 2; break;
      case 'participant': finalLives = 1; break;
    }
  }

  // Normalize mode: savannah-quick -> savannah for display
  const normalizedMode = gs.mode === 'savannah-quick' ? 'savannah' : gs.mode;

  return {
    id: gs.clientSessionId,
    date: gs.playedAt,
    mode: normalizedMode as 'meadow' | 'savannah' | 'wildlands',
    wordsAttempted: gs.wordsAttempted,
    wordsCorrect: gs.wordsCorrect,
    won: gs.won,
    trophy: (gs.trophy as TrophyTier) || null,
    completedWords: gs.completedWords || [],
    wrongAttempts: gs.wrongAttempts || [],
    totalTime: gs.durationSeconds ? gs.durationSeconds * 1000 : 0,
    finalLives,
  };
}

function createEmptyTrophyCounts(): Record<TrophyTier, number> {
  return { platinum: 0, gold: 0, silver: 0, bronze: 0, participant: 0 };
}

function createEmptyModeStatistics(): ModeStatistics {
  return {
    totalGamesPlayed: 0,
    totalWins: 0,
    totalWordsAttempted: 0,
    totalWordsCorrect: 0,
    streakCurrent: 0,
    streakBest: 0,
    trophyCounts: createEmptyTrophyCounts(),
    gameHistory: [],
  };
}

function createEmptyStatistics(): GameStatistics {
  return {
    modeStats: {
      meadow: createEmptyModeStatistics(),
      savannah: createEmptyModeStatistics(),
      wildlands: createEmptyModeStatistics(),
    },
    wordAccuracy: {},
    firstCorrectDates: {},
    personalBests: {},
    errorPatterns: {
      'vowel-swap': { count: 0, lastOccurrence: '', examples: [] },
      'double-letter': { count: 0, lastOccurrence: '', examples: [] },
      'silent-letter': { count: 0, lastOccurrence: '', examples: [] },
      'phonetic': { count: 0, lastOccurrence: '', examples: [] },
      'suffix': { count: 0, lastOccurrence: '', examples: [] },
      'prefix': { count: 0, lastOccurrence: '', examples: [] },
      'missing-letter': { count: 0, lastOccurrence: '', examples: [] },
      'extra-letter': { count: 0, lastOccurrence: '', examples: [] },
      'transposition': { count: 0, lastOccurrence: '', examples: [] },
    },
    totalGamesPlayed: 0,
    totalWins: 0,
    totalWordsAttempted: 0,
    totalWordsCorrect: 0,
    trophyCounts: createEmptyTrophyCounts(),
    gameHistory: [],
    streakCurrent: 0,
    streakBest: 0,
  };
}

function statisticsToGameStatistics(stats: Statistics[], gameSessions: GameSession[]): GameStatistics {
  const initial = createEmptyStatistics();

  // Deduplicate game sessions by clientSessionId (keep first occurrence)
  const seenSessionIds = new Set<string>();
  const uniqueSessions: GameSession[] = [];
  for (const gs of gameSessions) {
    if (!seenSessionIds.has(gs.clientSessionId)) {
      seenSessionIds.add(gs.clientSessionId);
      uniqueSessions.push(gs);
    }
  }

  // Build game history from game sessions (grouped by mode)
  const sessionsByMode = new Map<StatsModeId, GameResult[]>();
  for (const gs of uniqueSessions) {
    // Normalize savannah-quick to savannah for stats purposes
    const mode: StatsModeId = gs.mode === 'savannah-quick' ? 'savannah' : gs.mode as StatsModeId;
    if (!sessionsByMode.has(mode)) {
      sessionsByMode.set(mode, []);
    }
    sessionsByMode.get(mode)!.push(gameSessionToGameResult(gs));
  }

  // Populate aggregated gameHistory (all modes combined)
  initial.gameHistory = uniqueSessions.map(gameSessionToGameResult);

  for (const stat of stats) {
    const mode = stat.mode as StatsModeId;

    const modeStats: ModeStatistics = {
      totalGamesPlayed: stat.totalGamesPlayed,
      totalWins: stat.totalWins,
      totalWordsAttempted: stat.totalWordsAttempted,
      totalWordsCorrect: stat.totalWordsCorrect,
      streakCurrent: stat.streakCurrent,
      streakBest: stat.streakBest,
      trophyCounts: stat.trophyCounts || createEmptyTrophyCounts(),
      gameHistory: sessionsByMode.get(mode) || [],
    };

    initial.modeStats[mode] = modeStats;

    // Merge shared data (take from first non-empty)
    if (stat.wordAccuracy && Object.keys(stat.wordAccuracy).length > 0) {
      initial.wordAccuracy = { ...initial.wordAccuracy, ...stat.wordAccuracy };
    }
    if (stat.firstCorrectDates && Object.keys(stat.firstCorrectDates).length > 0) {
      initial.firstCorrectDates = { ...initial.firstCorrectDates, ...stat.firstCorrectDates };
    }
    if (stat.personalBests && Object.keys(stat.personalBests).length > 0) {
      initial.personalBests = { ...initial.personalBests, ...stat.personalBests };
    }
    if (stat.errorPatterns) {
      initial.errorPatterns = { ...initial.errorPatterns, ...stat.errorPatterns };
    }

    // Update legacy aggregates
    initial.totalGamesPlayed += stat.totalGamesPlayed;
    initial.totalWins += stat.totalWins;
    initial.totalWordsAttempted += stat.totalWordsAttempted;
    initial.totalWordsCorrect += stat.totalWordsCorrect;
    initial.streakCurrent = Math.max(initial.streakCurrent, stat.streakCurrent);
    initial.streakBest = Math.max(initial.streakBest, stat.streakBest);
  }

  return initial;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

const initialWordBank: WordBank = {
  words: [],
  lastUpdated: new Date().toISOString(),
  lastNewWordDate: null,
  newWordsIntroducedToday: 0,
};

/**
 * Hook to read any child's data from WatermelonDB
 * Unlike useDatabase, this is read-only and doesn't require the child to be the active player
 */
export function useChildData(childId: string): UseChildDataResult {
  const [isLoading, setIsLoading] = useState(true);
  const [wordProgressRecords, setWordProgressRecords] = useState<WordProgress[]>([]);
  const [statisticsRecords, setStatisticsRecords] = useState<Statistics[]>([]);
  const [gameSessionRecords, setGameSessionRecords] = useState<GameSession[]>([]);

  // Subscribe to data changes for this child
  useEffect(() => {
    if (!childId) {
      setIsLoading(false);
      return;
    }

    console.log('[useChildData] Subscribing to data for child:', childId);
    setIsLoading(true);
    const subscriptions: { unsubscribe: () => void }[] = [];

    const wordProgressCollection = database.get<WordProgress>('word_progress');
    const statisticsCollection = database.get<Statistics>('statistics');
    const gameSessionCollection = database.get<GameSession>('game_sessions');

    // Word Progress subscription
    const wpSubscription = wordProgressCollection
      .query(Q.where('child_id', childId))
      .observe()
      .subscribe(records => {
        console.log('[useChildData] word_progress update:', records.length, 'records');
        setWordProgressRecords(records);
      });
    subscriptions.push(wpSubscription);

    // Statistics subscription
    const statsSubscription = statisticsCollection
      .query(Q.where('child_id', childId))
      .observe()
      .subscribe(records => {
        console.log('[useChildData] statistics update:', records.length, 'records');
        setStatisticsRecords(records);
      });
    subscriptions.push(statsSubscription);

    // Game Sessions subscription
    const gsSubscription = gameSessionCollection
      .query(Q.where('child_id', childId), Q.sortBy('played_at', Q.desc))
      .observe()
      .subscribe(records => {
        console.log('[useChildData] game_sessions update:', records.length, 'records');
        setGameSessionRecords(records);
        // Mark loading as done after first data fetch
        setIsLoading(false);
      });
    subscriptions.push(gsSubscription);

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    };
  }, [childId]);

  // Convert WatermelonDB records to app types
  const wordBank: WordBank = useMemo(() => {
    if (!childId) return initialWordBank;
    return {
      words: wordProgressRecords.map(wordProgressToWord),
      lastUpdated: new Date().toISOString(),
      lastNewWordDate: null,
      newWordsIntroducedToday: 0,
    };
  }, [childId, wordProgressRecords]);

  const statistics: GameStatistics = useMemo(
    () => statisticsToGameStatistics(statisticsRecords, gameSessionRecords),
    [statisticsRecords, gameSessionRecords]
  );

  return {
    wordBank,
    statistics,
    isLoading,
  };
}
