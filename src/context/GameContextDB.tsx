/**
 * GameContext (WatermelonDB version)
 * Provides game state with offline-first database storage
 *
 * This context replaces the localStorage-based GameContext with WatermelonDB,
 * providing the same API while enabling:
 * - Larger data storage (no 5-10MB limit)
 * - Real database queries and indexes
 * - Automatic sync with Supabase
 * - React Native compatibility
 */

import React, { createContext, useContext, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useDatabase } from '@/db/hooks';
import { useAuth } from '@/context/AuthContext';
import { defaultWords } from '@/data/defaultWords';
import { GradeLevel, WordDefinition } from '@/data/gradeWords';
import { getWordsForGradeAsync } from '@/hooks/useWordCatalog';
import type {
  WordBank,
  GameStatistics,
  GameResult,
  GameModeId,
  CalibrationResult,
  StoredCalibration,
  LearningProgress,
} from '@/types';
import type { SyncHealthReport, SyncHealthStatus, HealOptions } from '@/db/hooks';

interface GameContextValue {
  // Loading state
  isLoading: boolean;
  isSyncing: boolean;

  // Initial sync state (for new devices)
  needsInitialSync: boolean;
  initialSyncCompleted: boolean;

  // Word Bank
  wordBank: WordBank;
  addWord: (text: string, definition?: string, exampleSentence?: string, immediatelyIntroduced?: boolean) => Promise<boolean>;
  removeWord: (id: string) => Promise<void>;
  importDefaultWords: () => Promise<void>;
  importGradeWords: (grade: GradeLevel) => Promise<number>;
  clearWordBank: () => Promise<void>;
  deduplicateWords: () => Promise<number>;
  wordExists: (text: string) => boolean;
  markWordsAsIntroduced: (wordTexts: string[]) => Promise<void>;
  forceIntroduceWord: (id: string) => Promise<void>;
  archiveWord: (id: string) => Promise<void>;
  unarchiveWord: (id: string) => Promise<void>;
  recordWordAttempt: (wordText: string, typedText: string, wasCorrect: boolean, mode: GameModeId, timeMs?: number) => Promise<void>;
  addWordsFromCatalog: (words: WordDefinition[]) => Promise<number>;
  importCustomWords: (wordTexts: string[]) => Promise<number>;

  // Statistics
  statistics: GameStatistics;
  recordGame: (result: GameResult) => Promise<void>;
  clearHistory: () => Promise<void>;

  // Learning Progress (Level Map)
  learningProgress: LearningProgress;

  // Calibration
  calibration: StoredCalibration;
  hasCompletedCalibration: boolean;
  setCalibrationComplete: (result: CalibrationResult) => Promise<void>;
  resetCalibration: () => Promise<void>;

  // Sync
  syncNow: () => Promise<void>;

  // Sync Health (diagnostics)
  syncHealth: SyncHealthReport | null;
  syncHealthStatus: SyncHealthStatus;
  checkSyncHealth: () => Promise<void>;
  healSync: (options?: HealOptions) => Promise<void>;

  // Fresh data fetch (bypasses subscription timing)
  fetchFreshData: () => Promise<{ wordBank: WordBank; statistics: GameStatistics; learningProgress: LearningProgress; hasCompletedCalibration: boolean }>;
}

const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: React.ReactNode;
  childId: string;
}

export function GameProvider({ children, childId }: GameProviderProps) {
  // Access auth context for activeChild data and updateChild function
  const { activeChild, updateChild, registerPreSyncCallback } = useAuth();

  // Check online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Database hook provides all state and operations
  const db = useDatabase(childId, isOnline);

  // Register syncNow with AuthContext so it can trigger sync before logout/child-switch
  useEffect(() => {
    if (registerPreSyncCallback && db.syncNow) {
      registerPreSyncCallback(db.syncNow);
    }
  }, [registerPreSyncCallback, db.syncNow]);

  // Track if pending import has been handled to prevent duplicate imports
  const pendingImportHandled = useRef<string | null>(null);

  // Handle pending grade import when GameProvider mounts
  // This runs when a child was created with manual grade selection (not calibration)
  useEffect(() => {
    async function handlePendingImport() {
      // Only proceed if:
      // 1. activeChild exists and matches the current childId
      // 2. There's a pending_grade_import set
      // 3. Database is loaded (not loading)
      // 4. We haven't already handled this import
      if (
        !activeChild ||
        activeChild.id !== childId ||
        !activeChild.pending_grade_import ||
        db.isLoading ||
        pendingImportHandled.current === childId
      ) {
        return;
      }

      // Mark as handled before starting to prevent race conditions
      pendingImportHandled.current = childId;

      const gradeToImport = activeChild.pending_grade_import as GradeLevel;
      console.log(`[GameProvider] Processing pending grade import: Grade ${gradeToImport} for child ${childId}`);

      try {
        // Import grade words from local word catalog (falls back to bundled files)
        const gradeWordList = await getWordsForGradeAsync(gradeToImport);
        let addedCount = 0;

        for (const wordDef of gradeWordList) {
          const normalized = wordDef.word.toLowerCase().trim();
          const wasAdded = await db.addWord(normalized, wordDef.definition, wordDef.example, false);
          if (wasAdded) addedCount++;
        }

        console.log(`[GameProvider] Imported ${addedCount} words for Grade ${gradeToImport}`);

        // Clear the pending_grade_import flag
        const { error } = await updateChild(childId, { pending_grade_import: null });
        if (error) {
          console.error('[GameProvider] Failed to clear pending_grade_import:', error);
        } else {
          console.log('[GameProvider] Cleared pending_grade_import flag');
        }
      } catch (err) {
        console.error('[GameProvider] Error processing pending grade import:', err);
        // Reset handled flag so it can be retried
        pendingImportHandled.current = null;
      }
    }

    handlePendingImport();
  }, [activeChild, childId, db.isLoading, db.addWord, updateChild]);

  // Import default (starter) words
  // Note: addWord handles deduplication atomically, so no need for client-side checks
  const importDefaultWords = useCallback(async () => {
    for (const wordDef of defaultWords) {
      const normalized = wordDef.word.toLowerCase().trim();
      // addWord handles deduplication atomically inside a write transaction
      await db.addWord(normalized, wordDef.definition, wordDef.example);
    }
  }, [db.addWord]);

  // Import grade-level words from local word catalog
  // Note: addWord handles deduplication atomically, so no need for client-side checks
  const importGradeWords = useCallback(async (grade: GradeLevel): Promise<number> => {
    // Get words from local catalog (falls back to bundled files if catalog empty)
    const gradeWordList = await getWordsForGradeAsync(grade);
    let addedCount = 0;

    for (const wordDef of gradeWordList) {
      const normalized = wordDef.word.toLowerCase().trim();
      // addWord handles deduplication atomically inside a write transaction
      const wasAdded = await db.addWord(normalized, wordDef.definition, wordDef.example, false);
      if (wasAdded) addedCount++;
    }

    return addedCount;
  }, [db.addWord]);

  // Add words from catalog - uses gradual introduction (immediatelyIntroduced = false)
  const addWordsFromCatalog = useCallback(async (words: WordDefinition[]): Promise<number> => {
    let addedCount = 0;

    for (const wordDef of words) {
      const normalized = wordDef.word.toLowerCase().trim();
      // addWord handles deduplication atomically inside a write transaction
      // immediatelyIntroduced = false for catalog words (gradual introduction)
      const wasAdded = await db.addWord(normalized, wordDef.definition, wordDef.example, false);
      if (wasAdded) addedCount++;
    }

    return addedCount;
  }, [db.addWord]);

  // Import custom curriculum words - immediately introduced since parent explicitly wants them practiced
  const importCustomWords = useCallback(async (wordTexts: string[]): Promise<number> => {
    let addedCount = 0;

    for (const text of wordTexts) {
      const normalized = text.toLowerCase().trim();
      if (normalized) {
        // addWord handles deduplication atomically inside a write transaction
        // immediatelyIntroduced = true for custom words (immediate introduction)
        const wasAdded = await db.addWord(normalized, undefined, undefined, true);
        if (wasAdded) addedCount++;
      }
    }

    return addedCount;
  }, [db.addWord]);

  // Clear word bank (remove all words)
  const clearWordBank = useCallback(async () => {
    for (const word of db.wordBank.words) {
      await db.removeWord(word.id);
    }
  }, [db.wordBank.words, db.removeWord]);

  // Clear history (delete game sessions and reset statistics)
  const clearHistory = useCallback(async () => {
    await db.clearHistory();
  }, [db.clearHistory]);

  const value = useMemo<GameContextValue>(
    () => ({
      isLoading: db.isLoading,
      isSyncing: db.isSyncing,
      needsInitialSync: db.needsInitialSync,
      initialSyncCompleted: db.initialSyncCompleted,
      wordBank: db.wordBank,
      addWord: db.addWord,
      removeWord: db.removeWord,
      importDefaultWords,
      importGradeWords,
      clearWordBank,
      deduplicateWords: db.deduplicateWords,
      wordExists: db.wordExists,
      markWordsAsIntroduced: db.markWordsAsIntroduced,
      forceIntroduceWord: db.forceIntroduceWord,
      archiveWord: db.archiveWord,
      unarchiveWord: db.unarchiveWord,
      recordWordAttempt: db.recordWordAttempt,
      addWordsFromCatalog,
      importCustomWords,
      statistics: db.statistics,
      recordGame: db.recordGame,
      clearHistory,
      learningProgress: db.learningProgress,
      calibration: db.calibration,
      hasCompletedCalibration: db.hasCompletedCalibration,
      setCalibrationComplete: db.setCalibrationComplete,
      resetCalibration: db.resetCalibration,
      syncNow: db.syncNow,
      syncHealth: db.syncHealth,
      syncHealthStatus: db.syncHealthStatus,
      checkSyncHealth: db.checkSyncHealth,
      healSync: db.healSync,
      fetchFreshData: db.fetchFreshData,
    }),
    [
      db.isLoading,
      db.isSyncing,
      db.needsInitialSync,
      db.initialSyncCompleted,
      db.wordBank,
      db.addWord,
      db.removeWord,
      importDefaultWords,
      importGradeWords,
      clearWordBank,
      db.deduplicateWords,
      db.wordExists,
      db.markWordsAsIntroduced,
      db.forceIntroduceWord,
      db.archiveWord,
      db.unarchiveWord,
      db.recordWordAttempt,
      addWordsFromCatalog,
      importCustomWords,
      db.statistics,
      db.recordGame,
      clearHistory,
      db.learningProgress,
      db.calibration,
      db.hasCompletedCalibration,
      db.setCalibrationComplete,
      db.resetCalibration,
      db.syncNow,
      db.syncHealth,
      db.syncHealthStatus,
      db.checkSyncHealth,
      db.healSync,
      db.fetchFreshData,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

/**
 * Optional version of useGameContext that returns null instead of throwing
 * when used outside of GameProvider. Useful for components like Header
 * that render in both contexts (with and without an active child).
 */
export function useGameContextOptional(): GameContextValue | null {
  return useContext(GameContext);
}
