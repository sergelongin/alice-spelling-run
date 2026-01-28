/**
 * LocalStorage to WatermelonDB Migration
 * Migrates existing localStorage data to WatermelonDB for seamless upgrade
 */

import { database } from '../index';
import type {
  WordBank,
  GameStatistics,
  StoredCalibration,
  LearningProgress,
  StatsModeId,
  GameResult,
} from '@/types';

// localStorage key patterns
const getWordBankKey = (childId: string) => `alice-spelling-run-word-bank-${childId}`;
const getStatisticsKey = (childId: string) => `alice-spelling-run-statistics-${childId}`;
const getCalibrationKey = (childId: string) => `alice-spelling-run-calibration-${childId}`;
const getLearningProgressKey = (childId: string) => `alice-spelling-run-learning-progress-${childId}`;
const getMigrationKey = (childId: string) => `alice-spelling-run-watermelon-migrated-${childId}`;

/**
 * Check if migration has already been completed for a child
 */
export function isMigrationComplete(childId: string): boolean {
  try {
    const migrated = localStorage.getItem(getMigrationKey(childId));
    return migrated === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete for a child
 */
function markMigrationComplete(childId: string): void {
  try {
    localStorage.setItem(getMigrationKey(childId), 'true');
  } catch (e) {
    console.warn('[Migration] Failed to mark migration complete:', e);
  }
}

/**
 * Read JSON from localStorage safely
 */
function readLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    return JSON.parse(stored) as T;
  } catch (e) {
    console.warn(`[Migration] Failed to read ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Migrate a single child's data from localStorage to WatermelonDB
 */
export async function migrateChildData(childId: string): Promise<{
  success: boolean;
  wordCount: number;
  sessionCount: number;
  statsCount: number;
  calibrationCount: number;
}> {
  // Check if already migrated
  if (isMigrationComplete(childId)) {
    console.log('[Migration] Already migrated for child:', childId);
    return { success: true, wordCount: 0, sessionCount: 0, statsCount: 0, calibrationCount: 0 };
  }

  console.log('[Migration] Starting migration for child:', childId);

  // Read all data from localStorage
  const wordBank = readLocalStorage<WordBank>(getWordBankKey(childId), {
    words: [],
    lastUpdated: new Date().toISOString(),
    lastNewWordDate: null,
    newWordsIntroducedToday: 0,
  });

  const emptyTrophyCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0, participant: 0 };
  const statistics = readLocalStorage<GameStatistics>(getStatisticsKey(childId), {
    modeStats: {
      meadow: { totalGamesPlayed: 0, totalWins: 0, totalWordsAttempted: 0, totalWordsCorrect: 0, trophyCounts: emptyTrophyCounts, gameHistory: [], streakCurrent: 0, streakBest: 0 },
      savannah: { totalGamesPlayed: 0, totalWins: 0, totalWordsAttempted: 0, totalWordsCorrect: 0, trophyCounts: emptyTrophyCounts, gameHistory: [], streakCurrent: 0, streakBest: 0 },
      wildlands: { totalGamesPlayed: 0, totalWins: 0, totalWordsAttempted: 0, totalWordsCorrect: 0, trophyCounts: emptyTrophyCounts, gameHistory: [], streakCurrent: 0, streakBest: 0 },
    },
    wordAccuracy: {},
    firstCorrectDates: {},
    personalBests: {},
    errorPatterns: {} as GameStatistics['errorPatterns'],
    totalGamesPlayed: 0,
    totalWins: 0,
    totalWordsAttempted: 0,
    totalWordsCorrect: 0,
    trophyCounts: emptyTrophyCounts,
    gameHistory: [],
    streakCurrent: 0,
    streakBest: 0,
  });

  const calibration = readLocalStorage<StoredCalibration>(getCalibrationKey(childId), {
    lastResult: null,
    hasCompletedCalibration: false,
    calibrationHistory: [],
  });

  const learningProgress = readLocalStorage<LearningProgress>(getLearningProgressKey(childId), {
    totalPoints: 0,
    pointsHistory: [],
    lastUpdated: new Date().toISOString(),
  });

  let wordCount = 0;
  let sessionCount = 0;
  let statsCount = 0;
  let calibrationCount = 0;

  try {
    await database.write(async () => {
      // Migrate word progress
      const wordProgressCollection = database.get('word_progress');
      for (const word of wordBank.words) {
        await wordProgressCollection.create((record) => {
          record._raw.id = crypto.randomUUID();
          // @ts-expect-error - WatermelonDB types don't expose _raw setters
          record._raw.child_id = childId;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.word_text = word.text;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.mastery_level = word.masteryLevel || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.correct_streak = word.correctStreak || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.times_used = word.timesUsed || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.times_correct = word.timesCorrect || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.last_attempt_at = word.lastAttemptAt ? new Date(word.lastAttemptAt).getTime() : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.next_review_at = word.nextReviewAt ? new Date(word.nextReviewAt).getTime() : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.introduced_at = word.introducedAt ? new Date(word.introducedAt).getTime() : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.is_active = word.isActive !== false;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.archived_at = word.archivedAt ? new Date(word.archivedAt).getTime() : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.definition = word.definition || null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.example_sentence = word.exampleSentence || null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.attempt_history_json = word.attemptHistory?.length ? JSON.stringify(word.attemptHistory) : null;
        });
        wordCount++;
      }

      // Migrate game sessions from gameHistory
      const gameSessionCollection = database.get('game_sessions');
      const allGameHistory: GameResult[] = [];

      // Collect all game history from mode stats and legacy
      for (const mode of ['meadow', 'savannah', 'wildlands'] as StatsModeId[]) {
        const modeStats = statistics.modeStats?.[mode];
        if (modeStats?.gameHistory) {
          allGameHistory.push(...modeStats.gameHistory);
        }
      }

      // Also include legacy gameHistory if not already included
      if (statistics.gameHistory) {
        for (const game of statistics.gameHistory) {
          if (!allGameHistory.some(g => g.id === game.id)) {
            allGameHistory.push(game);
          }
        }
      }

      // Deduplicate by ID
      const seenIds = new Set<string>();
      for (const game of allGameHistory) {
        if (seenIds.has(game.id)) continue;
        seenIds.add(game.id);

        await gameSessionCollection.create((record) => {
          record._raw.id = crypto.randomUUID();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.child_id = childId;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.client_session_id = game.id;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.mode = game.mode || 'savannah';
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.played_at = game.date ? new Date(game.date).getTime() : Date.now();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.duration_seconds = game.totalTime ? Math.round(game.totalTime / 1000) : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.words_attempted = game.wordsAttempted || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.words_correct = game.wordsCorrect || 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.won = game.won || false;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.trophy = game.trophy || null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.completed_words_json = game.completedWords?.length ? JSON.stringify(game.completedWords) : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.wrong_attempts_json = game.wrongAttempts?.length ? JSON.stringify(game.wrongAttempts) : null;
        });
        sessionCount++;
      }

      // Migrate statistics
      const statisticsCollection = database.get('statistics');
      for (const mode of ['meadow', 'savannah', 'wildlands'] as StatsModeId[]) {
        const modeStats = statistics.modeStats?.[mode];
        if (modeStats && modeStats.totalGamesPlayed > 0) {
          await statisticsCollection.create((record) => {
            record._raw.id = crypto.randomUUID();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.child_id = childId;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.mode = mode;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.total_games_played = modeStats.totalGamesPlayed;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.total_wins = modeStats.totalWins;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.total_words_attempted = modeStats.totalWordsAttempted;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.total_words_correct = modeStats.totalWordsCorrect;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.streak_current = modeStats.streakCurrent;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.streak_best = modeStats.streakBest;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.trophy_counts_json = JSON.stringify(modeStats.trophyCounts || {});
            // @ts-expect-error - Don't include gameHistory in stats (it's in game_sessions)
            record._raw.game_history_json = null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_accuracy_json = statistics.wordAccuracy ? JSON.stringify(statistics.wordAccuracy) : null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.first_correct_dates_json = statistics.firstCorrectDates ? JSON.stringify(statistics.firstCorrectDates) : null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.personal_bests_json = statistics.personalBests ? JSON.stringify(statistics.personalBests) : null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.error_patterns_json = statistics.errorPatterns ? JSON.stringify(statistics.errorPatterns) : null;
          });
          statsCount++;
        }
      }

      // Migrate calibration
      const calibrationCollection = database.get('calibration');
      for (const result of calibration.calibrationHistory || []) {
        await calibrationCollection.create((record) => {
          record._raw.id = crypto.randomUUID();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.child_id = childId;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.client_calibration_id = result.id;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.completed_at = new Date(result.completedAt).getTime();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.status = result.status;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.recommended_grade = result.recommendedGrade;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.confidence = result.confidence;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_time_ms = result.totalTimeMs || null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.attempts_json = result.attempts ? JSON.stringify(result.attempts) : null;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.grade_scores_json = result.gradeScores ? JSON.stringify(result.gradeScores) : null;
        });
        calibrationCount++;
      }

      // Migrate learning progress
      const learningProgressCollection = database.get('learning_progress');
      if (learningProgress.totalPoints > 0) {
        await learningProgressCollection.create((record) => {
          record._raw.id = crypto.randomUUID();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.child_id = childId;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_points = learningProgress.totalPoints;
          // @ts-expect-error - These are computed from totalPoints at runtime, use defaults
          record._raw.current_milestone_index = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.milestone_progress = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.point_history_json = learningProgress.pointsHistory?.length
            ? JSON.stringify(learningProgress.pointsHistory)
            : null;
        });
      }

      // Migrate word bank metadata
      const wordBankMetadataCollection = database.get('word_bank_metadata');
      await wordBankMetadataCollection.create((record) => {
        record._raw.id = crypto.randomUUID();
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.child_id = childId;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.last_updated = wordBank.lastUpdated ? new Date(wordBank.lastUpdated).getTime() : Date.now();
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.last_new_word_date = wordBank.lastNewWordDate || null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.new_words_introduced_today = wordBank.newWordsIntroducedToday || 0;
      });
    });

    // Mark migration as complete
    markMigrationComplete(childId);

    console.log('[Migration] Migration complete:', {
      childId,
      wordCount,
      sessionCount,
      statsCount,
      calibrationCount,
    });

    return { success: true, wordCount, sessionCount, statsCount, calibrationCount };
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    return { success: false, wordCount: 0, sessionCount: 0, statsCount: 0, calibrationCount: 0 };
  }
}

/**
 * Check if localStorage has data for a child
 */
export function hasLocalStorageData(childId: string): boolean {
  const wordBank = readLocalStorage<WordBank>(getWordBankKey(childId), {
    words: [],
    lastUpdated: new Date().toISOString(),
    lastNewWordDate: null,
    newWordsIntroducedToday: 0,
  });
  const statistics = readLocalStorage<GameStatistics>(getStatisticsKey(childId), { totalGamesPlayed: 0 } as GameStatistics);

  return wordBank.words.length > 0 || statistics.totalGamesPlayed > 0;
}

/**
 * Clear localStorage data after successful migration
 * Only call this after verifying WatermelonDB has the data
 */
export function clearLocalStorageData(childId: string): void {
  try {
    localStorage.removeItem(getWordBankKey(childId));
    localStorage.removeItem(getStatisticsKey(childId));
    localStorage.removeItem(getCalibrationKey(childId));
    localStorage.removeItem(getLearningProgressKey(childId));
    console.log('[Migration] localStorage data cleared for child:', childId);
  } catch (e) {
    console.warn('[Migration] Failed to clear localStorage:', e);
  }
}
