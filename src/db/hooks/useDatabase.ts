/**
 * Database React Hooks
 * Provides reactive access to WatermelonDB data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../index';
import { syncWithSupabase } from '../sync';
import { migrateChildData, isMigrationComplete, hasLocalStorageData } from '../migration/localStorage-to-watermelon';
import type { WordProgress, GameSession, Statistics, Calibration, LearningProgress as LearningProgressModel, WordBankMetadata } from '../models';
import type {
  Word,
  WordBank,
  GameStatistics,
  ModeStatistics,
  StoredCalibration,
  LearningProgress,
  StatsModeId,
  GameResult,
  CalibrationResult,
  WordAttempt,
  GameModeId,
  TrophyTier,
  MasteryLevel,
  PointEvent,
} from '@/types';
import { calculateSessionPoints } from '@/utils/levelMapUtils';

// =============================================================================
// TYPES
// =============================================================================

export interface UseDatabaseResult {
  // Loading state
  isLoading: boolean;
  isMigrating: boolean;
  error: string | null;

  // Word Bank
  wordBank: WordBank;
  addWord: (text: string, definition?: string, exampleSentence?: string, immediatelyIntroduced?: boolean) => Promise<boolean>;
  deduplicateWords: () => Promise<number>;
  removeWord: (id: string) => Promise<void>;
  markWordsAsIntroduced: (wordTexts: string[]) => Promise<void>;
  forceIntroduceWord: (id: string) => Promise<void>;
  archiveWord: (id: string) => Promise<void>;
  unarchiveWord: (id: string) => Promise<void>;
  recordWordAttempt: (wordText: string, typedText: string, wasCorrect: boolean, mode: GameModeId, timeMs?: number) => Promise<void>;
  wordExists: (text: string) => boolean;

  // Statistics
  statistics: GameStatistics;
  recordGame: (result: GameResult) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Learning Progress
  learningProgress: LearningProgress;

  // Calibration
  calibration: StoredCalibration;
  hasCompletedCalibration: boolean;
  setCalibrationComplete: (result: CalibrationResult) => Promise<void>;
  resetCalibration: () => Promise<void>;

  // Sync
  syncNow: () => Promise<void>;
  isSyncing: boolean;

  // Fresh data fetch (bypasses subscription timing)
  fetchFreshData: () => Promise<{
    wordBank: WordBank;
    statistics: GameStatistics;
    learningProgress: LearningProgress;
  }>;
}

// =============================================================================
// HELPER: Convert WatermelonDB models to app types
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

/**
 * Convert a GameSession model to a GameResult for display
 */
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

function statisticsToGameStatistics(stats: Statistics[], gameSessions: GameSession[]): GameStatistics {
  const initial = createEmptyStatistics();

  // Build game history from game sessions (grouped by mode)
  const sessionsByMode = new Map<StatsModeId, GameResult[]>();
  for (const gs of gameSessions) {
    // Normalize savannah-quick to savannah for stats purposes
    const mode: StatsModeId = gs.mode === 'savannah-quick' ? 'savannah' : gs.mode as StatsModeId;
    if (!sessionsByMode.has(mode)) {
      sessionsByMode.set(mode, []);
    }
    sessionsByMode.get(mode)!.push(gameSessionToGameResult(gs));
  }

  // Populate aggregated gameHistory (all modes combined)
  initial.gameHistory = gameSessions.map(gameSessionToGameResult);

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
      // Use game sessions for history instead of the never-populated stat.gameHistory
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

// =============================================================================
// STANDALONE DEDUPLICATION (called during initialization)
// =============================================================================

/**
 * Deduplicate word_progress records for a child by word_text.
 * This is a standalone function (not a hook) so it can be called during initialization.
 * Keeps the record with the most progress (highest timesUsed).
 */
async function deduplicateWordsForChild(childId: string): Promise<number> {
  const collection = database.get<WordProgress>('word_progress');

  return await database.write(async () => {
    const allWords = await collection
      .query(Q.where('child_id', childId))
      .fetch();

    // Group by word_text (lowercase), keep the one with most progress
    const seen = new Map<string, WordProgress>();
    const toDelete: WordProgress[] = [];

    for (const word of allWords) {
      const key = word.wordText.toLowerCase();
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, word);
      } else {
        // Keep the one with higher timesUsed (more progress)
        if (word.timesUsed > existing.timesUsed) {
          toDelete.push(existing);
          seen.set(key, word);
        } else {
          toDelete.push(word);
        }
      }
    }

    // Delete duplicates
    for (const dup of toDelete) {
      await dup.destroyPermanently();
    }

    if (toDelete.length > 0) {
      console.log(`[useDatabase] Deduplication removed ${toDelete.length} duplicate word records for child ${childId}`);
    }

    return toDelete.length;
  });
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useDatabase(childId: string, isOnline: boolean): UseDatabaseResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw data from WatermelonDB
  const [wordProgressRecords, setWordProgressRecords] = useState<WordProgress[]>([]);
  const [statisticsRecords, setStatisticsRecords] = useState<Statistics[]>([]);
  const [gameSessionRecords, setGameSessionRecords] = useState<GameSession[]>([]);
  const [calibrationRecords, setCalibrationRecords] = useState<Calibration[]>([]);
  const [learningProgressRecord, setLearningProgressRecord] = useState<LearningProgressModel | null>(null);
  const [wordBankMetadataRecord, setWordBankMetadataRecord] = useState<WordBankMetadata | null>(null);

  // ==========================================================================
  // INITIALIZATION & MIGRATION
  // ==========================================================================

  useEffect(() => {
    let isCancelled = false;
    let cleanupSubscriptions: (() => void) | null = null;

    async function initialize() {
      setIsLoading(true);
      setError(null);

      try {
        // Check if migration is needed
        if (hasLocalStorageData(childId) && !isMigrationComplete(childId)) {
          setIsMigrating(true);
          console.log('[useDatabase] Migrating localStorage data...');
          await migrateChildData(childId);
          setIsMigrating(false);
        }

        // Always run deduplication on init to clean up any existing duplicates
        // This handles duplicates from:
        // 1. Previous sync issues (before reconciliation fix)
        // 2. Migration from localStorage that may have had duplicates
        // 3. Race conditions from rapid imports
        console.log('[useDatabase] Running deduplication check...');
        await deduplicateWordsForChild(childId);

        // Subscribe to data changes
        if (!isCancelled) {
          cleanupSubscriptions = await subscribeToData();
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[useDatabase] Initialization error:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize database');
          setIsLoading(false);
        }
      }
    }

    async function subscribeToData(): Promise<() => void> {
      const wordProgressCollection = database.get<WordProgress>('word_progress');
      const statisticsCollection = database.get<Statistics>('statistics');
      const gameSessionCollection = database.get<GameSession>('game_sessions');
      const calibrationCollection = database.get<Calibration>('calibration');
      const learningProgressCollection = database.get<LearningProgressModel>('learning_progress');
      const wordBankMetadataCollection = database.get<WordBankMetadata>('word_bank_metadata');

      // Word Progress
      const wpSubscription = wordProgressCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setWordProgressRecords(records);
        });

      // Statistics
      const statsSubscription = statisticsCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setStatisticsRecords(records);
        });

      // Game Sessions (sorted by played_at descending for recent games first)
      const gsSubscription = gameSessionCollection
        .query(Q.where('child_id', childId), Q.sortBy('played_at', Q.desc))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setGameSessionRecords(records);
        });

      // Calibration
      const calSubscription = calibrationCollection
        .query(Q.where('child_id', childId), Q.sortBy('completed_at', Q.desc))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setCalibrationRecords(records);
        });

      // Learning Progress
      const lpSubscription = learningProgressCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setLearningProgressRecord(records[0] || null);
        });

      // Word Bank Metadata
      const wbmSubscription = wordBankMetadataCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setWordBankMetadataRecord(records[0] || null);
        });

      // Return cleanup function
      return () => {
        wpSubscription.unsubscribe();
        statsSubscription.unsubscribe();
        gsSubscription.unsubscribe();
        calSubscription.unsubscribe();
        lpSubscription.unsubscribe();
        wbmSubscription.unsubscribe();
      };
    }

    initialize();

    return () => {
      isCancelled = true;
      // Clean up subscriptions to prevent memory leaks
      if (cleanupSubscriptions) {
        cleanupSubscriptions();
      }
    };
  }, [childId]);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  const wordBank: WordBank = useMemo(() => ({
    words: wordProgressRecords.map(wordProgressToWord),
    lastUpdated: wordBankMetadataRecord?.lastUpdated || new Date().toISOString(),
    lastNewWordDate: wordBankMetadataRecord?.lastNewWordDate || null,
    newWordsIntroducedToday: wordBankMetadataRecord?.newWordsIntroducedToday || 0,
  }), [wordProgressRecords, wordBankMetadataRecord]);

  const statistics: GameStatistics = useMemo(
    () => statisticsToGameStatistics(statisticsRecords, gameSessionRecords),
    [statisticsRecords, gameSessionRecords]
  );

  const calibration: StoredCalibration = useMemo(() => {
    const history = calibrationRecords.map(c => ({
      id: c.clientCalibrationId,
      completedAt: c.completedAt,
      status: c.status,
      recommendedGrade: c.recommendedGrade,
      confidence: c.confidence,
      totalTimeMs: c.totalTimeMs || 0,
      attempts: c.attempts || [],
      gradeScores: c.gradeScores || {},
    })) as CalibrationResult[];

    return {
      lastResult: history[0] || null,
      hasCompletedCalibration: history.length > 0,
      calibrationHistory: history,
    };
  }, [calibrationRecords]);

  const hasCompletedCalibration = calibration.hasCompletedCalibration;

  const learningProgress: LearningProgress = useMemo(() => ({
    totalPoints: learningProgressRecord?.totalPoints || 0,
    pointsHistory: learningProgressRecord?.pointHistory || [],
    lastUpdated: new Date().toISOString(),
  }), [learningProgressRecord]);

  // ==========================================================================
  // WORD EXISTS CHECK
  // ==========================================================================

  const wordExists = useCallback((text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    return wordBank.words.some(w => w.text.toLowerCase() === normalized);
  }, [wordBank.words]);

  // ==========================================================================
  // WORD BANK OPERATIONS
  // ==========================================================================

  const addWord = useCallback(async (text: string, definition?: string, exampleSentence?: string, immediatelyIntroduced: boolean = true): Promise<boolean> => {
    const normalized = text.toLowerCase().trim();
    const now = Date.now();
    const collection = database.get<WordProgress>('word_progress');

    // Atomic find-or-create: query INSIDE the write transaction to prevent race conditions
    return await database.write(async () => {
      const existing = await collection
        .query(
          Q.where('child_id', childId),
          Q.where('word_text', normalized)
        )
        .fetch();

      if (existing.length > 0) {
        return false; // Already exists
      }

      await collection.create(record => {
        record._raw.id = crypto.randomUUID();
        // @ts-expect-error - WatermelonDB types
        record._raw.child_id = childId;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.word_text = normalized;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.mastery_level = 0;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.correct_streak = 0;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.times_used = 0;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.times_correct = 0;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.introduced_at = immediatelyIntroduced ? now : null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.next_review_at = immediatelyIntroduced ? now : null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.is_active = true;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.definition = definition || null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.example_sentence = exampleSentence || null;
      });
      return true;
    });
  }, [childId]);

  const removeWord = useCallback(async (id: string): Promise<void> => {
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.destroyPermanently();
    });
  }, []);

  const markWordsAsIntroduced = useCallback(async (wordTexts: string[]): Promise<void> => {
    if (wordTexts.length === 0) return;

    const now = Date.now();
    const textsToIntroduce = new Set(wordTexts.map(t => t.toLowerCase()));

    await database.write(async () => {
      for (const record of wordProgressRecords) {
        if (textsToIntroduce.has(record.wordText.toLowerCase()) && !record.introducedAtRaw) {
          await record.update(r => {
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.introduced_at = now;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.next_review_at = now;
          });
        }
      }
    });
  }, [wordProgressRecords]);

  const forceIntroduceWord = useCallback(async (id: string): Promise<void> => {
    const now = Date.now();
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.update(r => {
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.introduced_at = now;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.next_review_at = now;
      });
    });
  }, []);

  const archiveWord = useCallback(async (id: string): Promise<void> => {
    const now = Date.now();
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.update(r => {
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.is_active = false;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.archived_at = now;
      });
    });
  }, []);

  const unarchiveWord = useCallback(async (id: string): Promise<void> => {
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.update(r => {
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.is_active = true;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.archived_at = null;
      });
    });
  }, []);

  /**
   * Deduplicate words by removing duplicate entries for the same word text.
   * Keeps the record with the most progress (highest timesUsed).
   * @returns Number of duplicate records removed
   */
  const deduplicateWords = useCallback(async (): Promise<number> => {
    return deduplicateWordsForChild(childId);
  }, [childId]);

  const recordWordAttempt = useCallback(async (
    wordText: string,
    typedText: string,
    wasCorrect: boolean,
    mode: GameModeId,
    timeMs?: number
  ): Promise<void> => {
    const normalized = wordText.toLowerCase();
    const record = wordProgressRecords.find(r => r.wordText.toLowerCase() === normalized);
    if (!record) return;

    const now = new Date().toISOString();
    const newAttempt: WordAttempt = {
      id: crypto.randomUUID(),
      timestamp: now,
      wasCorrect,
      typedText,
      mode,
      timeMs,
    };

    const history = record.attemptHistory || [];
    const updatedHistory = [newAttempt, ...history].slice(0, 100);

    await database.write(async () => {
      await record.update(r => {
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.attempt_history_json = JSON.stringify(updatedHistory);
      });
    });
  }, [wordProgressRecords]);

  // ==========================================================================
  // GAME RECORDING
  // ==========================================================================

  const recordGame = useCallback(async (result: GameResult): Promise<void> => {
    const now = Date.now();
    const mode = result.mode || 'savannah';
    const gameSessionCollection = database.get<GameSession>('game_sessions');
    const statisticsCollection = database.get<Statistics>('statistics');

    await database.write(async () => {
      // Create game session record
      await gameSessionCollection.create(record => {
        record._raw.id = crypto.randomUUID();
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.child_id = childId;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.client_session_id = result.id;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.mode = mode;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.played_at = result.date ? new Date(result.date).getTime() : now;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.duration_seconds = result.totalTime ? Math.round(result.totalTime / 1000) : null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.words_attempted = result.wordsAttempted;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.words_correct = result.wordsCorrect;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.won = result.won;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.trophy = result.trophy || null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.completed_words_json = result.completedWords ? JSON.stringify(result.completedWords) : null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.wrong_attempts_json = result.wrongAttempts ? JSON.stringify(result.wrongAttempts) : null;
      });

      // Update or create statistics for this mode
      // @ts-expect-error - mode comparison with 'savannah-quick'
      const statsMode: StatsModeId = mode === 'savannah-quick' ? 'savannah' : mode;
      const existingStats = statisticsRecords.find(s => s.mode === statsMode);

      if (existingStats) {
        await existingStats.update(s => {
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.total_games_played = existingStats.totalGamesPlayed + 1;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.total_wins = existingStats.totalWins + (result.won ? 1 : 0);
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.total_words_attempted = existingStats.totalWordsAttempted + result.wordsAttempted;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.total_words_correct = existingStats.totalWordsCorrect + result.wordsCorrect;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.streak_current = result.won ? existingStats.streakCurrent + 1 : 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          s._raw.streak_best = Math.max(
            existingStats.streakBest,
            result.won ? existingStats.streakCurrent + 1 : 0
          );
          if (result.trophy) {
            const trophyCounts = { ...existingStats.trophyCounts };
            trophyCounts[result.trophy] = (trophyCounts[result.trophy] || 0) + 1;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            s._raw.trophy_counts_json = JSON.stringify(trophyCounts);
          }
        });
      } else {
        await statisticsCollection.create(record => {
          record._raw.id = crypto.randomUUID();
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.child_id = childId;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.mode = statsMode;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_games_played = 1;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_wins = result.won ? 1 : 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_words_attempted = result.wordsAttempted;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_words_correct = result.wordsCorrect;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.streak_current = result.won ? 1 : 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.streak_best = result.won ? 1 : 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.trophy_counts_json = result.trophy
            ? JSON.stringify({ [result.trophy]: 1 })
            : JSON.stringify({});
        });
      }

      // Track level-ups and new masteries for point calculation
      const levelUps: { wordText: string; oldLevel: number; newLevel: number }[] = [];
      const newMasteries: { wordText: string }[] = [];

      // Update word mastery for completed words
      for (const completed of result.completedWords) {
        const wordRecord = wordProgressRecords.find(
          r => r.wordText.toLowerCase() === completed.word.toLowerCase()
        );
        if (wordRecord) {
          const wasFirstTryCorrect = completed.attempts === 1;
          const oldLevel = wordRecord.masteryLevel;
          let newLevel = oldLevel;
          let newStreak = wordRecord.correctStreak;

          if (wasFirstTryCorrect) {
            newStreak = wordRecord.correctStreak + 1;
            newLevel = Math.min(5, oldLevel + 1) as MasteryLevel;
          } else {
            newLevel = Math.max(0, oldLevel - 2) as MasteryLevel;
            newStreak = 0;
          }

          // Track level-ups and new masteries
          if (newLevel > oldLevel) {
            levelUps.push({ wordText: completed.word, oldLevel, newLevel });
            if (newLevel === 5 && oldLevel < 5) {
              newMasteries.push({ wordText: completed.word });
            }
          }

          await wordRecord.update(r => {
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.mastery_level = newLevel;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.correct_streak = newStreak;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.times_used = wordRecord.timesUsed + 1;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.times_correct = wordRecord.timesCorrect + (wasFirstTryCorrect ? 1 : 0);
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.last_attempt_at = now;
          });
        }
      }

      // Calculate and award points
      const pointEvents = calculateSessionPoints(result.completedWords, levelUps, newMasteries);
      if (pointEvents.length > 0) {
        const totalNewPoints = pointEvents.reduce((sum, e) => sum + e.points, 0);
        const learningProgressCollection = database.get<LearningProgressModel>('learning_progress');

        if (learningProgressRecord) {
          // Update existing record
          const existingHistory: PointEvent[] = learningProgressRecord.pointHistory || [];
          const updatedHistory = [...pointEvents, ...existingHistory].slice(0, 20);

          await learningProgressRecord.update(r => {
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.total_points = learningProgressRecord.totalPoints + totalNewPoints;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.point_history_json = JSON.stringify(updatedHistory);
          });
        } else {
          // Create new learning progress record
          await learningProgressCollection.create(record => {
            record._raw.id = crypto.randomUUID();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.child_id = childId;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.total_points = totalNewPoints;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.current_milestone_index = 0;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.milestone_progress = 0;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.point_history_json = JSON.stringify(pointEvents.slice(0, 20));
          });
        }
      }
    });
  }, [childId, statisticsRecords, wordProgressRecords, learningProgressRecord]);

  // ==========================================================================
  // CLEAR HISTORY
  // ==========================================================================

  const clearHistory = useCallback(async (): Promise<void> => {
    const gameSessionCollection = database.get<GameSession>('game_sessions');
    const statisticsCollection = database.get<Statistics>('statistics');

    await database.write(async () => {
      // Delete all game sessions for this child
      const sessions = await gameSessionCollection
        .query(Q.where('child_id', childId))
        .fetch();
      for (const session of sessions) {
        await session.destroyPermanently();
      }

      // Reset statistics records (keep records, reset values)
      const stats = await statisticsCollection
        .query(Q.where('child_id', childId))
        .fetch();
      for (const stat of stats) {
        await stat.update(record => {
          // @ts-expect-error - WatermelonDB types
          record._raw.total_games_played = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_wins = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_words_attempted = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.total_words_correct = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.streak_current = 0;
          // @ts-expect-error - WatermelonDB _raw setters not typed
          record._raw.trophy_counts_json = JSON.stringify({ platinum: 0, gold: 0, silver: 0, bronze: 0, participant: 0 });
          // Keep personalBests, firstCorrectDates, and streakBest as historical reference
        });
      }
    });

    console.log('[useDatabase] Cleared game history for child', childId);
  }, [childId]);

  // ==========================================================================
  // CALIBRATION
  // ==========================================================================

  const setCalibrationComplete = useCallback(async (result: CalibrationResult): Promise<void> => {
    const calibrationCollection = database.get<Calibration>('calibration');

    await database.write(async () => {
      await calibrationCollection.create(record => {
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
    });
  }, [childId]);

  const resetCalibration = useCallback(async (): Promise<void> => {
    await database.write(async () => {
      for (const record of calibrationRecords) {
        await record.destroyPermanently();
      }
    });
  }, [calibrationRecords]);

  // ==========================================================================
  // SYNC
  // ==========================================================================

  const syncNow = useCallback(async (): Promise<void> => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      await syncWithSupabase(childId);
    } catch (err) {
      console.error('[useDatabase] Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [childId, isOnline, isSyncing]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && !isLoading) {
      syncNow();
    }
  }, [isOnline, isLoading]);

  // ==========================================================================
  // FRESH DATA FETCH (bypasses subscription timing issues)
  // ==========================================================================

  const fetchFreshData = useCallback(async () => {
    const wpCollection = database.get<WordProgress>('word_progress');
    const statsCollection = database.get<Statistics>('statistics');
    const gsCollection = database.get<GameSession>('game_sessions');
    const lpCollection = database.get<LearningProgressModel>('learning_progress');
    const wbmCollection = database.get<WordBankMetadata>('word_bank_metadata');

    const [freshWP, freshStats, freshGS, freshLP, freshMeta] = await Promise.all([
      wpCollection.query(Q.where('child_id', childId)).fetch(),
      statsCollection.query(Q.where('child_id', childId)).fetch(),
      gsCollection.query(Q.where('child_id', childId), Q.sortBy('played_at', Q.desc)).fetch(),
      lpCollection.query(Q.where('child_id', childId)).fetch(),
      wbmCollection.query(Q.where('child_id', childId)).fetch(),
    ]);

    return {
      wordBank: {
        words: freshWP.map(wordProgressToWord),
        lastUpdated: freshMeta[0]?.lastUpdated || new Date().toISOString(),
        lastNewWordDate: freshMeta[0]?.lastNewWordDate || null,
        newWordsIntroducedToday: freshMeta[0]?.newWordsIntroducedToday || 0,
      },
      statistics: statisticsToGameStatistics(freshStats, freshGS),
      learningProgress: {
        totalPoints: freshLP[0]?.totalPoints || 0,
        pointsHistory: freshLP[0]?.pointHistory || [],
        lastUpdated: new Date().toISOString(),
      },
    };
  }, [childId]);

  return {
    isLoading,
    isMigrating,
    error,
    wordBank,
    addWord,
    removeWord,
    markWordsAsIntroduced,
    forceIntroduceWord,
    archiveWord,
    unarchiveWord,
    deduplicateWords,
    recordWordAttempt,
    wordExists,
    statistics,
    recordGame,
    clearHistory,
    learningProgress,
    calibration,
    hasCompletedCalibration,
    setCalibrationComplete,
    resetCalibration,
    syncNow,
    isSyncing,
    fetchFreshData,
  };
}
