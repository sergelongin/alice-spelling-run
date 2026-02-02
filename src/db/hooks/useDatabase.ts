/**
 * Database React Hooks
 * Provides reactive access to WatermelonDB data
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../index';
import { syncWithSupabase } from '../sync';
import { migrateChildData, isMigrationComplete, hasLocalStorageData } from '../migration/localStorage-to-watermelon';
import {
  checkSyncHealth as checkSyncHealthFn,
  healSyncInconsistencies as healSyncFn,
  type SyncHealthReport,
  type SyncHealthStatus,
  type HealOptions,
} from '../syncDiagnostics';
import type { WordProgress, GameSession, Statistics, Calibration, LearningProgress as LearningProgressModel, GradeProgress as GradeProgressModel, WordBankMetadata, WordAttemptModel } from '../models';
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
  GradeProgressData,
} from '@/types';
import { calculateSessionPoints } from '@/utils/levelMapUtils';
import { GRADE_WORDS, type GradeLevel } from '@/data/gradeWords';

// =============================================================================
// TYPES
// =============================================================================

export interface UseDatabaseResult {
  // Loading state
  isLoading: boolean;
  isMigrating: boolean;
  error: string | null;

  // Initial sync state (for new devices)
  needsInitialSync: boolean;
  initialSyncCompleted: boolean;

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

  // Learning Progress (global lifetime)
  learningProgress: LearningProgress;

  // Grade Progress (per-grade)
  gradeProgress: Map<GradeLevel, GradeProgressData>;

  // Calibration
  calibration: StoredCalibration;
  hasCompletedCalibration: boolean;
  setCalibrationComplete: (result: CalibrationResult) => Promise<void>;
  resetCalibration: () => Promise<void>;

  // Sync
  syncNow: () => Promise<void>;
  isSyncing: boolean;

  // Sync Health (new diagnostic features)
  syncHealth: SyncHealthReport | null;
  syncHealthStatus: SyncHealthStatus;
  checkSyncHealth: () => Promise<void>;
  healSync: (options?: HealOptions) => Promise<void>;

  // Fresh data fetch (bypasses subscription timing)
  fetchFreshData: () => Promise<{
    wordBank: WordBank;
    statistics: GameStatistics;
    learningProgress: LearningProgress;
    gradeProgress: Map<GradeLevel, GradeProgressData>;
    hasCompletedCalibration: boolean;
  }>;
}

// =============================================================================
// HELPER: Grade Level Lookup
// =============================================================================

// Build a reverse lookup map from word text to grade level
const wordToGradeMap = new Map<string, GradeLevel>();
for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
  for (const wordDef of GRADE_WORDS[grade]) {
    wordToGradeMap.set(wordDef.word.toLowerCase(), grade);
  }
}

/**
 * Look up the grade level for a word text.
 * Returns the grade level from the static word catalog, or null if not found.
 * Note: Custom words added by parents may not have a grade level in the static catalog.
 */
function getWordGradeLevel(wordText: string): GradeLevel | null {
  return wordToGradeMap.get(wordText.toLowerCase()) ?? null;
}

// =============================================================================
// HELPER: Convert WatermelonDB models to app types
// =============================================================================

/**
 * Build a map of word_text -> WordAttempt[] from attempt records
 */
function buildAttemptsMap(attempts: WordAttemptModel[]): Map<string, WordAttempt[]> {
  const map = new Map<string, WordAttempt[]>();
  for (const attempt of attempts) {
    const key = attempt.wordText.toLowerCase();
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push({
      id: attempt.clientAttemptId,
      timestamp: attempt.attemptedAt,
      wasCorrect: attempt.wasCorrect,
      typedText: attempt.typedText,
      mode: attempt.mode,
      timeMs: attempt.timeMs,
      attemptNumber: attempt.attemptNumber,
    });
  }
  // Sort each word's attempts by timestamp descending (most recent first)
  for (const [, wordAttempts] of map) {
    wordAttempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  return map;
}

function wordProgressToWord(wp: WordProgress, attemptsMap?: Map<string, WordAttempt[]>): Word {
  // Get attempts from the new normalized table if available, otherwise fall back to JSONB field
  const attempts = attemptsMap?.get(wp.wordText.toLowerCase()) || wp.attemptHistory || [];

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
    attemptHistory: attempts,
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
// HELPER: Check for pending (unsynced) changes
// =============================================================================

/**
 * Check if there are any pending changes in WatermelonDB that haven't been synced.
 * Looks for records with _status === 'created' or _status === 'updated'.
 */
async function hasPendingChanges(childId: string): Promise<boolean> {
  const tables = ['word_progress', 'game_sessions', 'statistics', 'calibration', 'learning_progress', 'word_attempts'] as const;

  for (const tableName of tables) {
    const collection = database.get(tableName);
    const pendingCount = await collection
      .query(
        Q.where('child_id', childId),
        Q.or(
          Q.where('_status', 'created'),
          Q.where('_status', 'updated')
        )
      )
      .fetchCount();

    if (pendingCount > 0) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// STANDALONE MIGRATIONS (called during initialization)
// =============================================================================

const ATTEMPT_HISTORY_MIGRATION_KEY = 'attemptHistoryMigrationComplete';

/**
 * One-time migration: Copy local attempt_history_json data to the new word_attempts table.
 * This salvages historical attempt data that was stored in the JSONB field but never synced.
 * Safe to run multiple times - checks for existing records before creating.
 */
async function migrateLocalAttemptHistory(childId: string): Promise<number> {
  // Check if already migrated for this child
  const migrationFlag = `${ATTEMPT_HISTORY_MIGRATION_KEY}_${childId}`;
  if (localStorage.getItem(migrationFlag) === 'true') {
    return 0;
  }

  const wordProgressCollection = database.get<WordProgress>('word_progress');
  const wordAttemptCollection = database.get<WordAttemptModel>('word_attempts');

  // Fetch all word progress records for this child
  const wordProgressRecords = await wordProgressCollection
    .query(Q.where('child_id', childId))
    .fetch();

  // Filter to only records that have attempt history data
  const wordsWithHistory = wordProgressRecords.filter(
    wp => wp.attemptHistory && wp.attemptHistory.length > 0
  );

  if (wordsWithHistory.length === 0) {
    console.log('[useDatabase] No local attempt history to migrate');
    localStorage.setItem(migrationFlag, 'true');
    return 0;
  }

  console.log(`[useDatabase] Found ${wordsWithHistory.length} words with local attempt history to migrate`);

  let migratedCount = 0;

  await database.write(async () => {
    for (const wp of wordsWithHistory) {
      const attempts = wp.attemptHistory || [];

      for (const attempt of attempts) {
        // Generate a unique client_attempt_id based on available data
        // Use existing id if present, otherwise create from word+timestamp
        const clientAttemptId = attempt.id || `migrated-${wp.wordText}-${attempt.timestamp}`;

        // Check if this attempt already exists (idempotent migration)
        const existing = await wordAttemptCollection
          .query(
            Q.where('child_id', childId),
            Q.where('client_attempt_id', clientAttemptId)
          )
          .fetchCount();

        if (existing === 0) {
          await wordAttemptCollection.create(record => {
            record._raw.id = crypto.randomUUID();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.child_id = childId;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_text = wp.wordText.toLowerCase();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.client_attempt_id = clientAttemptId;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.attempt_number = attempt.attemptNumber || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.typed_text = attempt.typedText;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.was_correct = attempt.wasCorrect;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.mode = attempt.mode;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.time_ms = attempt.timeMs || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.attempted_at = new Date(attempt.timestamp).getTime();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.session_id = null; // Original JSONB didn't track session_id
          });
          migratedCount++;
        }
      }
    }
  });

  console.log(`[useDatabase] Migrated ${migratedCount} local attempt history records to word_attempts table`);

  // Mark migration as complete
  localStorage.setItem(migrationFlag, 'true');

  return migratedCount;
}

const LEARNING_PROGRESS_MIGRATION_KEY = 'learning_progress_schema_migrated';

/**
 * One-time migration: Copy total_points to total_lifetime_points for sync compatibility.
 * This ensures existing learning progress data has the new field populated.
 * Safe to run multiple times - checks for existing migration flag.
 */
async function migrateLearningProgressSchema(childId: string): Promise<void> {
  const migrationFlag = `${LEARNING_PROGRESS_MIGRATION_KEY}_${childId}`;
  if (localStorage.getItem(migrationFlag) === 'true') {
    return;
  }

  const learningProgressCollection = database.get<LearningProgressModel>('learning_progress');

  // Fetch learning progress record for this child
  const records = await learningProgressCollection
    .query(Q.where('child_id', childId))
    .fetch();

  if (records.length === 0) {
    console.log('[useDatabase] No learning progress record to migrate');
    localStorage.setItem(migrationFlag, 'true');
    return;
  }

  const record = records[0];
  const totalPoints = record.totalPoints || 0;
  const totalLifetimePoints = record.totalLifetimePoints || 0;

  // Only migrate if total_lifetime_points is not yet set but total_points exists
  if (totalPoints > 0 && totalLifetimePoints === 0) {
    console.log(`[useDatabase] Migrating learning progress: copying ${totalPoints} points to total_lifetime_points`);

    await database.write(async () => {
      await record.update(r => {
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.total_lifetime_points = totalPoints;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        r._raw.client_updated_at = Date.now();
      });
    });

    console.log('[useDatabase] Learning progress schema migration complete');
  } else {
    console.log('[useDatabase] Learning progress schema already migrated or no points to migrate');
  }

  // Mark migration as complete
  localStorage.setItem(migrationFlag, 'true');
}

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

  // Initial sync state - detect if this is a new device/browser for this child
  // With parent-level sync, we check if child has any local data instead of per-child timestamps
  const [needsInitialSync, setNeedsInitialSync] = useState<boolean>(false);
  const [initialSyncCompleted, setInitialSyncCompleted] = useState<boolean>(false);

  // Sync health state
  const [syncHealth, setSyncHealth] = useState<SyncHealthReport | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Raw data from WatermelonDB
  const [wordProgressRecords, setWordProgressRecords] = useState<WordProgress[]>([]);
  const [statisticsRecords, setStatisticsRecords] = useState<Statistics[]>([]);
  const [gameSessionRecords, setGameSessionRecords] = useState<GameSession[]>([]);
  const [calibrationRecords, setCalibrationRecords] = useState<Calibration[]>([]);
  const [learningProgressRecord, setLearningProgressRecord] = useState<LearningProgressModel | null>(null);
  const [gradeProgressRecords, setGradeProgressRecords] = useState<GradeProgressModel[]>([]);
  const [wordBankMetadataRecord, setWordBankMetadataRecord] = useState<WordBankMetadata | null>(null);
  const [wordAttemptRecords, setWordAttemptRecords] = useState<WordAttemptModel[]>([]);

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

        // Migrate local attempt_history_json to word_attempts table (one-time)
        // This salvages historical attempt data that was stored in JSONB but never synced
        console.log('[useDatabase] Checking for local attempt history to migrate...');
        await migrateLocalAttemptHistory(childId);

        // Migrate learning_progress to have total_lifetime_points field
        // This ensures existing data syncs correctly
        console.log('[useDatabase] Checking for learning progress schema migration...');
        await migrateLearningProgressSchema(childId);

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

          // Check if this child has any local data (word_progress records)
          // If no local data exists and we're online, perform initial sync
          const wordProgressCollection = database.get<WordProgress>('word_progress');
          const localWordCount = await wordProgressCollection
            .query(Q.where('child_id', childId))
            .fetchCount();
          const hasLocalData = localWordCount > 0;

          if (!hasLocalData && isOnline) {
            console.log('[useDatabase] No local data for child, starting initial sync...');
            setNeedsInitialSync(true);
            setInitialSyncCompleted(false);

            // Set a timeout to allow proceeding even if sync is slow
            const syncTimeoutId = setTimeout(() => {
              if (!isCancelled) {
                console.log('[useDatabase] Initial sync timeout, proceeding anyway');
                setInitialSyncCompleted(true);
              }
            }, 15000); // 15 second timeout

            syncWithSupabase(childId)
              .then(() => {
                clearTimeout(syncTimeoutId);
                if (!isCancelled) {
                  console.log('[useDatabase] Initial sync completed successfully');
                  setInitialSyncCompleted(true);
                }
              })
              .catch(err => {
                clearTimeout(syncTimeoutId);
                console.error('[useDatabase] Initial sync failed:', err);
                if (!isCancelled) {
                  // Still mark as completed so user can proceed (will use empty local data)
                  setInitialSyncCompleted(true);
                }
              });
          } else if (!hasLocalData && !isOnline) {
            // Offline and no local data - mark as completed so user can proceed
            console.log('[useDatabase] No local data but offline, allowing to proceed');
            setNeedsInitialSync(true);
            setInitialSyncCompleted(true);
          } else {
            // Has local data, no initial sync needed
            setNeedsInitialSync(false);
            setInitialSyncCompleted(true);
          }
        }
      } catch (err) {
        console.error('[useDatabase] Initialization error:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize database');
          setIsLoading(false);
          // Mark sync as completed on error so user isn't stuck
          setInitialSyncCompleted(true);
        }
      }
    }

    async function subscribeToData(): Promise<() => void> {
      const wordProgressCollection = database.get<WordProgress>('word_progress');
      const statisticsCollection = database.get<Statistics>('statistics');
      const gameSessionCollection = database.get<GameSession>('game_sessions');
      const calibrationCollection = database.get<Calibration>('calibration');
      const learningProgressCollection = database.get<LearningProgressModel>('learning_progress');
      const gradeProgressCollection = database.get<GradeProgressModel>('grade_progress');
      const wordBankMetadataCollection = database.get<WordBankMetadata>('word_bank_metadata');
      const wordAttemptCollection = database.get<WordAttemptModel>('word_attempts');

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

      // Learning Progress (global lifetime)
      const lpSubscription = learningProgressCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setLearningProgressRecord(records[0] || null);
        });

      // Grade Progress (per-grade)
      const gpSubscription = gradeProgressCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setGradeProgressRecords(records);
        });

      // Word Bank Metadata
      const wbmSubscription = wordBankMetadataCollection
        .query(Q.where('child_id', childId))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setWordBankMetadataRecord(records[0] || null);
        });

      // Word Attempts (sorted by attempted_at descending for recent first)
      const waSubscription = wordAttemptCollection
        .query(Q.where('child_id', childId), Q.sortBy('attempted_at', Q.desc))
        .observe()
        .subscribe(records => {
          if (!isCancelled) setWordAttemptRecords(records);
        });

      // Return cleanup function
      return () => {
        wpSubscription.unsubscribe();
        statsSubscription.unsubscribe();
        gsSubscription.unsubscribe();
        calSubscription.unsubscribe();
        lpSubscription.unsubscribe();
        gpSubscription.unsubscribe();
        wbmSubscription.unsubscribe();
        waSubscription.unsubscribe();
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
  }, [childId, isOnline]);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  // Build attempts map from word_attempts table
  const attemptsMap = useMemo(() => buildAttemptsMap(wordAttemptRecords), [wordAttemptRecords]);

  const wordBank: WordBank = useMemo(() => ({
    words: wordProgressRecords.map(wp => wordProgressToWord(wp, attemptsMap)),
    lastUpdated: wordBankMetadataRecord?.lastUpdated || new Date().toISOString(),
    lastNewWordDate: wordBankMetadataRecord?.lastNewWordDate || null,
    newWordsIntroducedToday: wordBankMetadataRecord?.newWordsIntroducedToday || 0,
  }), [wordProgressRecords, wordBankMetadataRecord, attemptsMap]);

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
    totalPoints: learningProgressRecord?.totalPoints || learningProgressRecord?.totalLifetimePoints || 0,
    pointsHistory: learningProgressRecord?.pointHistory || [],
    lastUpdated: new Date().toISOString(),
  }), [learningProgressRecord]);

  // Convert grade progress records to a Map<GradeLevel, GradeProgressData>
  const gradeProgress: Map<GradeLevel, GradeProgressData> = useMemo(() => {
    const map = new Map<GradeLevel, GradeProgressData>();
    for (const gp of gradeProgressRecords) {
      map.set(gp.gradeLevel as GradeLevel, {
        gradeLevel: gp.gradeLevel,
        totalPoints: gp.totalPoints,
        currentMilestoneIndex: gp.currentMilestoneIndex,
        wordsMastered: gp.wordsMastered,
        firstPointAt: gp.firstPointAt?.toISOString() ?? null,
        lastActivityAt: gp.lastActivityAt?.toISOString() ?? null,
      });
    }
    return map;
  }, [gradeProgressRecords]);

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
            // Use decorated field setters for proper sync tracking

            r.introducedAtRaw = now;

            r.nextReviewAtRaw = now;
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
        // Use decorated field setters for proper sync tracking

        r.introducedAtRaw = now;

        r.nextReviewAtRaw = now;
      });
    });
  }, []);

  const archiveWord = useCallback(async (id: string): Promise<void> => {
    const now = Date.now();
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.update(r => {
        // Use decorated field setters for proper sync tracking

        r.isActive = false;

        r.archivedAtRaw = now;
      });
    });
  }, []);

  const unarchiveWord = useCallback(async (id: string): Promise<void> => {
    const collection = database.get<WordProgress>('word_progress');

    await database.write(async () => {
      const record = await collection.find(id);
      await record.update(r => {
        // Use decorated field setters for proper sync tracking

        r.isActive = true;

        r.archivedAtRaw = null;
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
    timeMs?: number,
    sessionId?: string,
    attemptNumber?: number
  ): Promise<void> => {
    const normalized = wordText.toLowerCase();
    const now = Date.now();
    const clientAttemptId = crypto.randomUUID();

    const wordAttemptCollection = database.get<WordAttemptModel>('word_attempts');

    await database.write(async () => {
      await wordAttemptCollection.create(record => {
        record._raw.id = crypto.randomUUID();
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.child_id = childId;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.word_text = normalized;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.client_attempt_id = clientAttemptId;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.attempt_number = attemptNumber || null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.typed_text = typedText;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.was_correct = wasCorrect;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.mode = mode;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.time_ms = timeMs || null;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.attempted_at = now;
        // @ts-expect-error - WatermelonDB _raw setters not typed
        record._raw.session_id = sessionId || null;
      });
    });
  }, [childId]);

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
          // IMPORTANT: Use decorated field setters (not _raw) to enable WatermelonDB change tracking!
          // The @field decorator creates setters that call _setRaw internally, which properly
          // marks the record as "updated" and tracks changed fields for sync.
          // Direct _raw modifications bypass this tracking and break sync.


          s.totalGamesPlayed = existingStats.totalGamesPlayed + 1;

          s.totalWins = existingStats.totalWins + (result.won ? 1 : 0);

          s.totalWordsAttempted = existingStats.totalWordsAttempted + result.wordsAttempted;

          s.totalWordsCorrect = existingStats.totalWordsCorrect + result.wordsCorrect;

          s.streakCurrent = result.won ? existingStats.streakCurrent + 1 : 0;

          s.streakBest = Math.max(
            existingStats.streakBest,
            result.won ? existingStats.streakCurrent + 1 : 0
          );
          if (result.trophy) {
            const trophyCounts = { ...existingStats.trophyCounts };
            trophyCounts[result.trophy] = (trophyCounts[result.trophy] || 0) + 1;

            s.trophyCounts = trophyCounts;
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
        const gradeProgressCollection = database.get<GradeProgressModel>('grade_progress');

        // =====================================================================
        // UPDATE GLOBAL LEARNING PROGRESS (lifetime points)
        // =====================================================================
        if (learningProgressRecord) {
          // Update existing record
          const existingHistory: PointEvent[] = learningProgressRecord.pointHistory || [];
          const updatedHistory = [...pointEvents, ...existingHistory].slice(0, 20);
          const newTotal = (learningProgressRecord.totalPoints || 0) + totalNewPoints;

          await learningProgressRecord.update(r => {
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.total_points = newTotal;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.total_lifetime_points = newTotal;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.point_history_json = JSON.stringify(updatedHistory);
            // @ts-expect-error - WatermelonDB _raw setters not typed
            r._raw.client_updated_at = now;
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
            record._raw.total_lifetime_points = totalNewPoints;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.current_milestone_index = 0;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.milestone_progress = 0;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.point_history_json = JSON.stringify(pointEvents.slice(0, 20));
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.client_updated_at = now;
          });
        }

        // =====================================================================
        // UPDATE PER-GRADE PROGRESS
        // Group points by grade level and update each grade's progress
        // =====================================================================
        const pointsByGrade = new Map<GradeLevel, { points: number; newMasteries: number }>();

        // Calculate points per grade based on words completed
        for (const completed of result.completedWords) {
          const gradeLevel = getWordGradeLevel(completed.word);
          if (gradeLevel) {
            const existing = pointsByGrade.get(gradeLevel) || { points: 0, newMasteries: 0 };
            // Award base points for this word (simplified - uses same total as global)
            const wordPoints = pointEvents
              .filter(e => e.wordText?.toLowerCase() === completed.word.toLowerCase())
              .reduce((sum, e) => sum + e.points, 0);
            existing.points += wordPoints;
            pointsByGrade.set(gradeLevel, existing);
          }
        }

        // Count new masteries per grade
        for (const mastery of newMasteries) {
          const gradeLevel = getWordGradeLevel(mastery.wordText);
          if (gradeLevel) {
            const existing = pointsByGrade.get(gradeLevel) || { points: 0, newMasteries: 0 };
            existing.newMasteries += 1;
            pointsByGrade.set(gradeLevel, existing);
          }
        }

        // Update or create grade progress for each grade with points
        for (const [gradeLevel, gradeData] of pointsByGrade) {
          const existingGradeProgress = gradeProgressRecords.find(gp => gp.gradeLevel === gradeLevel);

          if (existingGradeProgress) {
            await existingGradeProgress.update(gp => {
              // @ts-expect-error - WatermelonDB _raw setters not typed
              gp._raw.total_points = existingGradeProgress.totalPoints + gradeData.points;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              gp._raw.words_mastered = existingGradeProgress.wordsMastered + gradeData.newMasteries;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              gp._raw.last_activity_at = now;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              gp._raw.client_updated_at = now;
            });
          } else {
            await gradeProgressCollection.create(record => {
              record._raw.id = crypto.randomUUID();
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.child_id = childId;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.grade_level = gradeLevel;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.total_points = gradeData.points;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.current_milestone_index = 0;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.words_mastered = gradeData.newMasteries;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.first_point_at = now;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.last_activity_at = now;
              // @ts-expect-error - WatermelonDB _raw setters not typed
              record._raw.client_updated_at = now;
            });
          }
        }
      }
    });
  }, [childId, statisticsRecords, wordProgressRecords, learningProgressRecord, gradeProgressRecords]);

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
  // SYNC HEALTH MONITORING
  // ==========================================================================

  const checkSyncHealth = useCallback(async (): Promise<void> => {
    if (!isOnline) {
      setSyncHealth({
        status: 'offline',
        hasUnsyncedChanges: false,
        inconsistencyCount: 0,
        details: 'Offline - cannot check sync health',
        checkedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const report = await checkSyncHealthFn(childId);
      setSyncHealth(report);
    } catch (err) {
      console.error('[useDatabase] Failed to check sync health:', err);
      setSyncHealth({
        status: 'error',
        hasUnsyncedChanges: false,
        inconsistencyCount: -1,
        details: `Error: ${err instanceof Error ? err.message : String(err)}`,
        checkedAt: new Date().toISOString(),
      });
    }
  }, [childId, isOnline]);

  const healSync = useCallback(async (options?: HealOptions): Promise<void> => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const report = await healSyncFn(childId, options);
      setSyncHealth(report);
    } catch (err) {
      console.error('[useDatabase] Failed to heal sync:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [childId, isOnline, isSyncing]);

  // Periodic sync health check and pending changes sync (every 5 minutes when online)
  useEffect(() => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    // Only set up periodic checks when online and not loading
    if (!isOnline || isLoading) return;

    // Initial check after sync completes
    const initialTimeout = setTimeout(() => {
      checkSyncHealth();
    }, 5000); // Wait 5 seconds after mount for initial sync to complete

    // Set up periodic checks every 5 minutes
    healthCheckIntervalRef.current = setInterval(async () => {
      checkSyncHealth();

      // Also sync if there are pending changes (prevents data staying local indefinitely)
      try {
        const hasPending = await hasPendingChanges(childId);
        if (hasPending && !isSyncing) {
          console.log('[useDatabase] Periodic sync: found pending changes');
          syncNow().catch(err => {
            console.warn('[useDatabase] Periodic sync failed:', err);
          });
        }
      } catch (err) {
        console.warn('[useDatabase] Error checking pending changes:', err);
      }
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [isOnline, isLoading, checkSyncHealth, childId, isSyncing, syncNow]);

  // Derived sync health status for quick access
  const syncHealthStatus: SyncHealthStatus = syncHealth?.status ?? (isOnline ? 'checking' : 'offline');

  // ==========================================================================
  // FRESH DATA FETCH (bypasses subscription timing issues)
  // ==========================================================================

  const fetchFreshData = useCallback(async () => {
    const wpCollection = database.get<WordProgress>('word_progress');
    const statsCollection = database.get<Statistics>('statistics');
    const gsCollection = database.get<GameSession>('game_sessions');
    const lpCollection = database.get<LearningProgressModel>('learning_progress');
    const gpCollection = database.get<GradeProgressModel>('grade_progress');
    const wbmCollection = database.get<WordBankMetadata>('word_bank_metadata');
    const calibrationCollection = database.get<Calibration>('calibration');
    const waCollection = database.get<WordAttemptModel>('word_attempts');

    const [freshWP, freshStats, freshGS, freshLP, freshGP, freshMeta, freshCalibration, freshAttempts] = await Promise.all([
      wpCollection.query(Q.where('child_id', childId)).fetch(),
      statsCollection.query(Q.where('child_id', childId)).fetch(),
      gsCollection.query(Q.where('child_id', childId), Q.sortBy('played_at', Q.desc)).fetch(),
      lpCollection.query(Q.where('child_id', childId)).fetch(),
      gpCollection.query(Q.where('child_id', childId)).fetch(),
      wbmCollection.query(Q.where('child_id', childId)).fetch(),
      calibrationCollection.query(Q.where('child_id', childId)).fetch(),
      waCollection.query(Q.where('child_id', childId), Q.sortBy('attempted_at', Q.desc)).fetch(),
    ]);

    const freshAttemptsMap = buildAttemptsMap(freshAttempts);

    // Build grade progress map
    const freshGradeProgress = new Map<GradeLevel, GradeProgressData>();
    for (const gp of freshGP) {
      freshGradeProgress.set(gp.gradeLevel as GradeLevel, {
        gradeLevel: gp.gradeLevel,
        totalPoints: gp.totalPoints,
        currentMilestoneIndex: gp.currentMilestoneIndex,
        wordsMastered: gp.wordsMastered,
        firstPointAt: gp.firstPointAt?.toISOString() ?? null,
        lastActivityAt: gp.lastActivityAt?.toISOString() ?? null,
      });
    }

    return {
      wordBank: {
        words: freshWP.map(wp => wordProgressToWord(wp, freshAttemptsMap)),
        lastUpdated: freshMeta[0]?.lastUpdated || new Date().toISOString(),
        lastNewWordDate: freshMeta[0]?.lastNewWordDate || null,
        newWordsIntroducedToday: freshMeta[0]?.newWordsIntroducedToday || 0,
      },
      statistics: statisticsToGameStatistics(freshStats, freshGS),
      learningProgress: {
        totalPoints: freshLP[0]?.totalPoints || freshLP[0]?.totalLifetimePoints || 0,
        pointsHistory: freshLP[0]?.pointHistory || [],
        lastUpdated: new Date().toISOString(),
      },
      gradeProgress: freshGradeProgress,
      hasCompletedCalibration: freshCalibration.length > 0,
    };
  }, [childId]);

  return {
    isLoading,
    isMigrating,
    error,
    needsInitialSync,
    initialSyncCompleted,
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
    gradeProgress,
    calibration,
    hasCompletedCalibration,
    setCalibrationComplete,
    resetCalibration,
    syncNow,
    isSyncing,
    syncHealth,
    syncHealthStatus,
    checkSyncHealth,
    healSync,
    fetchFreshData,
  };
}
