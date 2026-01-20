import React, { createContext, useContext, useCallback, useMemo, useEffect } from 'react';
import { useLocalStorage } from '@/hooks';
import {
  Word,
  WordBank,
  WordAttempt,
  GameStatistics,
  GameResult,
  GameModeId,
  createWord,
  createInitialStatistics,
  migrateStatistics,
  createInitialModeStatistics,
  createInitialErrorPatterns,
  migrateWord,
  updateWordMastery,
  getStatsModeId,
  CalibrationResult,
  StoredCalibration,
  DEFAULT_STORED_CALIBRATION,
} from '@/types';
import { defaultWords } from '@/data/defaultWords';
import { GradeLevel, GRADE_WORDS } from '@/data/gradeWords';
import { analyzeError } from '@/utils/errorPatternAnalysis';

interface GameContextValue {
  // Word Bank
  wordBank: WordBank;
  addWord: (text: string) => boolean;
  removeWord: (id: string) => void;
  importDefaultWords: () => void;
  importGradeWords: (grade: GradeLevel) => number; // Returns count of words added
  clearWordBank: () => void;
  wordExists: (text: string) => boolean;
  markWordsAsIntroduced: (wordTexts: string[]) => void; // Mark words as introduced when first used
  forceIntroduceWord: (id: string) => void; // Manually introduce a waiting word
  archiveWord: (id: string) => void; // Hide word while preserving history
  unarchiveWord: (id: string) => void; // Restore archived word
  recordWordAttempt: (wordText: string, typedText: string, wasCorrect: boolean, mode: GameModeId, timeMs?: number) => void; // Record individual attempt immediately

  // Statistics
  statistics: GameStatistics;
  recordGame: (result: GameResult) => void;
  clearHistory: () => void;

  // Calibration
  calibration: StoredCalibration;
  hasCompletedCalibration: boolean;
  setCalibrationComplete: (result: CalibrationResult) => void;
  resetCalibration: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// Dynamic storage keys based on child ID for data isolation
const getWordBankKey = (childId: string) => `alice-spelling-run-word-bank-${childId}`;
const getStatisticsKey = (childId: string) => `alice-spelling-run-statistics-${childId}`;
const getCalibrationKey = (childId: string) => `alice-spelling-run-calibration-${childId}`;

const initialWordBank: WordBank = {
  words: [],
  lastUpdated: new Date().toISOString(),
  lastNewWordDate: null,
  newWordsIntroducedToday: 0,
};

/**
 * Migrate WordBank to include new gradual introduction fields
 */
const migrateWordBank = (bank: Partial<WordBank>): WordBank => ({
  words: bank.words || [],
  lastUpdated: bank.lastUpdated || new Date().toISOString(),
  lastNewWordDate: bank.lastNewWordDate ?? null,
  newWordsIntroducedToday: bank.newWordsIntroducedToday ?? 0,
});

/**
 * Get today's date as YYYY-MM-DD string
 */
const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

interface GameProviderProps {
  children: React.ReactNode;
  childId: string;  // Required - must have active child to use GameProvider
}

export function GameProvider({ children, childId }: GameProviderProps) {
  // Use child-specific localStorage keys for data isolation
  const [wordBank, setWordBank] = useLocalStorage<WordBank>(
    getWordBankKey(childId),
    initialWordBank
  );

  const [statistics, setStatistics] = useLocalStorage<GameStatistics>(
    getStatisticsKey(childId),
    createInitialStatistics()
  );

  const [calibration, setCalibration] = useLocalStorage<StoredCalibration>(
    getCalibrationKey(childId),
    DEFAULT_STORED_CALIBRATION
  );

  // Migrate statistics on mount if needed
  useEffect(() => {
    if (!statistics.modeStats || !statistics.firstCorrectDates || !statistics.personalBests || !statistics.errorPatterns) {
      const migrated = migrateStatistics(statistics);
      setStatistics(migrated);
    }
  }, []);

  // Migrate words and word bank to include new fields if needed
  useEffect(() => {
    const needsWordMigration = wordBank.words.some(
      w => w.masteryLevel === undefined ||
           w.introducedAt === undefined ||
           w.attemptHistory === undefined ||
           w.isActive === undefined
    );
    const needsBankMigration = wordBank.lastNewWordDate === undefined;

    if (needsWordMigration || needsBankMigration) {
      setWordBank(prev => {
        const migrated = migrateWordBank(prev);
        return {
          ...migrated,
          words: migrated.words.map(migrateWord),
          lastUpdated: new Date().toISOString(),
        };
      });
    }
  }, []);

  // Check if a word already exists in the bank
  const wordExists = useCallback(
    (text: string): boolean => {
      const normalized = text.toLowerCase().trim();
      return wordBank.words.some(w => w.text === normalized);
    },
    [wordBank.words]
  );

  // Add a new word to the bank (manually added words are immediately introduced)
  const addWord = useCallback(
    (text: string): boolean => {
      const normalized = text.toLowerCase().trim();

      if (wordExists(normalized)) {
        return false;
      }

      // Manual additions are immediately introduced (true = immediatelyIntroduced)
      const newWord = createWord(normalized, true);

      setWordBank(prev => ({
        ...prev,
        words: [...prev.words, newWord],
        lastUpdated: new Date().toISOString(),
      }));

      return true;
    },
    [wordExists, setWordBank]
  );

  // Remove a word from the bank
  const removeWord = useCallback(
    (id: string) => {
      setWordBank(prev => ({
        ...prev,
        words: prev.words.filter(w => w.id !== id),
        lastUpdated: new Date().toISOString(),
      }));
    },
    [setWordBank]
  );

  // Import default (starter) words - these are immediately introduced
  const importDefaultWords = useCallback(() => {
    const existingTexts = new Set(wordBank.words.map(w => w.text));
    const newWords: Word[] = [];

    for (const wordDef of defaultWords) {
      const normalized = wordDef.word.toLowerCase().trim();
      if (!existingTexts.has(normalized)) {
        // Starter words are immediately introduced, include definition
        newWords.push(createWord(normalized, {
          immediatelyIntroduced: true,
          definition: wordDef.definition,
          exampleSentence: wordDef.example,
        }));
        existingTexts.add(normalized);
      }
    }

    if (newWords.length > 0) {
      setWordBank(prev => ({
        ...prev,
        words: [...prev.words, ...newWords],
        lastUpdated: new Date().toISOString(),
      }));
    }
  }, [wordBank.words, setWordBank]);

  // Import grade-level words - these use GRADUAL introduction (not immediately introduced)
  // Preserves history: existing words are not duplicated, archived words are restored
  const importGradeWords = useCallback((grade: GradeLevel): number => {
    const gradeWordList = GRADE_WORDS[grade] || [];
    const existingWordMap = new Map(wordBank.words.map(w => [w.text, w]));
    const newWords: Word[] = [];
    const wordsToRestore: string[] = []; // Archived words to unarchive
    const wordsToUpdate: Map<string, { definition?: string; exampleSentence?: string }> = new Map();

    for (const wordDef of gradeWordList) {
      const normalized = wordDef.word.toLowerCase().trim();
      const existingWord = existingWordMap.get(normalized);

      if (!existingWord) {
        // New word - create it
        newWords.push(createWord(normalized, {
          immediatelyIntroduced: false,
          definition: wordDef.definition,
          exampleSentence: wordDef.example,
        }));
      } else if (existingWord.isActive === false) {
        // Archived word - restore it (preserving history)
        wordsToRestore.push(existingWord.id);
        // Also update definition if it was missing
        if (!existingWord.definition || !existingWord.exampleSentence) {
          wordsToUpdate.set(existingWord.id, {
            definition: existingWord.definition || wordDef.definition,
            exampleSentence: existingWord.exampleSentence || wordDef.example,
          });
        }
      } else {
        // Active word - just update definition if missing
        if (!existingWord.definition || !existingWord.exampleSentence) {
          wordsToUpdate.set(existingWord.id, {
            definition: existingWord.definition || wordDef.definition,
            exampleSentence: existingWord.exampleSentence || wordDef.example,
          });
        }
      }
    }

    // Apply changes
    const now = new Date().toISOString();
    const restoredCount = wordsToRestore.length;
    const hasChanges = newWords.length > 0 || restoredCount > 0 || wordsToUpdate.size > 0;

    if (hasChanges) {
      setWordBank(prev => {
        const restoreSet = new Set(wordsToRestore);
        const updatedWords = prev.words.map(word => {
          const updates = wordsToUpdate.get(word.id);
          const shouldRestore = restoreSet.has(word.id);

          if (shouldRestore || updates) {
            return {
              ...word,
              ...(shouldRestore ? { isActive: true, archivedAt: null } : {}),
              ...(updates || {}),
            };
          }
          return word;
        });

        return {
          ...prev,
          words: [...updatedWords, ...newWords],
          lastUpdated: now,
        };
      });
    }

    // Return count of new + restored words
    return newWords.length + restoredCount;
  }, [wordBank.words, setWordBank]);

  // Clear entire word bank
  const clearWordBank = useCallback(() => {
    setWordBank({
      words: [],
      lastUpdated: new Date().toISOString(),
      lastNewWordDate: null,
      newWordsIntroducedToday: 0,
    });
  }, [setWordBank]);

  // Mark words as introduced when they're first used in a session
  const markWordsAsIntroduced = useCallback((wordTexts: string[]) => {
    if (wordTexts.length === 0) return;

    const now = new Date().toISOString();
    const today = getTodayDateString();
    const textsToIntroduce = new Set(wordTexts.map(t => t.toLowerCase()));

    setWordBank(prev => {
      // Reset daily count if it's a new day
      const isNewDay = prev.lastNewWordDate !== today;
      const currentDailyCount = isNewDay ? 0 : prev.newWordsIntroducedToday;

      // Update words that need to be introduced
      const updatedWords = prev.words.map(word => {
        if (textsToIntroduce.has(word.text.toLowerCase()) && word.introducedAt === null) {
          return {
            ...word,
            introducedAt: now,
            nextReviewAt: now, // Due immediately for first practice
          };
        }
        return word;
      });

      // Count how many words were actually introduced
      const introducedCount = updatedWords.filter(w =>
        textsToIntroduce.has(w.text.toLowerCase()) &&
        prev.words.find(pw => pw.id === w.id)?.introducedAt === null
      ).length;

      return {
        ...prev,
        words: updatedWords,
        lastUpdated: now,
        lastNewWordDate: introducedCount > 0 ? today : prev.lastNewWordDate,
        newWordsIntroducedToday: currentDailyCount + introducedCount,
      };
    });
  }, [setWordBank]);

  // Force introduce a specific word (from "Waiting" to "Learning")
  const forceIntroduceWord = useCallback((id: string) => {
    const now = new Date().toISOString();
    setWordBank(prev => ({
      ...prev,
      words: prev.words.map(word =>
        word.id === id && word.introducedAt === null
          ? { ...word, introducedAt: now, nextReviewAt: now }
          : word
      ),
      lastUpdated: now,
    }));
  }, [setWordBank]);

  // Archive a word (hide from selection while preserving history)
  const archiveWord = useCallback((id: string) => {
    const now = new Date().toISOString();
    setWordBank(prev => ({
      ...prev,
      words: prev.words.map(word =>
        word.id === id
          ? { ...word, isActive: false, archivedAt: now }
          : word
      ),
      lastUpdated: now,
    }));
  }, [setWordBank]);

  // Unarchive a word (restore to active rotation)
  const unarchiveWord = useCallback((id: string) => {
    const now = new Date().toISOString();
    setWordBank(prev => ({
      ...prev,
      words: prev.words.map(word =>
        word.id === id
          ? { ...word, isActive: true, archivedAt: null }
          : word
      ),
      lastUpdated: now,
    }));
  }, [setWordBank]);

  // Record a single word attempt immediately (for real-time persistence)
  const recordWordAttempt = useCallback((
    wordText: string,
    typedText: string,
    wasCorrect: boolean,
    mode: GameModeId,
    timeMs?: number
  ) => {
    const now = new Date().toISOString();

    setWordBank(prev => {
      const updatedWords = prev.words.map(word => {
        if (word.text.toLowerCase() === wordText.toLowerCase()) {
          const newAttempt: WordAttempt = {
            id: crypto.randomUUID(),
            timestamp: now,
            wasCorrect,
            typedText,
            mode,
            timeMs,
          };
          return {
            ...word,
            attemptHistory: [newAttempt, ...(word.attemptHistory || [])].slice(0, 100),
          };
        }
        return word;
      });

      return {
        ...prev,
        words: updatedWords,
        lastUpdated: now,
      };
    });
  }, [setWordBank]);

  // Record a game result
  const recordGame = useCallback(
    (result: GameResult) => {
      // Map the game mode to its stats bucket (savannah-quick -> savannah)
      const mode = getStatsModeId(result.mode || 'savannah');

      setStatistics(prev => {
        // Ensure modeStats exists
        const modeStats = prev.modeStats || {
          meadow: createInitialModeStatistics(),
          savannah: createInitialModeStatistics(),
          wildlands: createInitialModeStatistics(),
        };

        // Update mode-specific stats
        const currentModeStats = modeStats[mode] || createInitialModeStatistics();
        const newModeTrophyCounts = { ...currentModeStats.trophyCounts };
        if (result.trophy) {
          newModeTrophyCounts[result.trophy] = (newModeTrophyCounts[result.trophy] || 0) + 1;
        }
        const newModeStreak = result.won ? currentModeStats.streakCurrent + 1 : 0;

        const updatedModeStats = {
          ...modeStats,
          [mode]: {
            totalGamesPlayed: currentModeStats.totalGamesPlayed + 1,
            totalWins: currentModeStats.totalWins + (result.won ? 1 : 0),
            totalWordsAttempted: currentModeStats.totalWordsAttempted + result.wordsAttempted,
            totalWordsCorrect: currentModeStats.totalWordsCorrect + result.wordsCorrect,
            trophyCounts: newModeTrophyCounts,
            gameHistory: [result, ...currentModeStats.gameHistory].slice(0, 50),
            streakCurrent: newModeStreak,
            streakBest: Math.max(currentModeStats.streakBest, newModeStreak),
          },
        };

        // Update legacy aggregated stats
        const newTrophyCounts = { ...prev.trophyCounts };
        if (result.trophy) {
          newTrophyCounts[result.trophy] = (newTrophyCounts[result.trophy] || 0) + 1;
        }
        const newStreak = result.won ? prev.streakCurrent + 1 : 0;

        // Update word accuracy tracking
        const wordAccuracy = { ...prev.wordAccuracy };
        for (const completed of result.completedWords) {
          const wordKey = completed.word.toLowerCase();
          const current = wordAccuracy[wordKey] || { attempts: 0, correct: 0 };
          wordAccuracy[wordKey] = {
            attempts: current.attempts + completed.attempts,
            correct: current.correct + 1,
          };
        }

        // Track first-time correct spellings for "First time!" celebrations
        const firstCorrectDates = { ...prev.firstCorrectDates };
        const now = new Date().toISOString();
        for (const completed of result.completedWords) {
          const wordKey = completed.word.toLowerCase();
          // Only record if this is the first time spelling correctly
          if (!firstCorrectDates[wordKey]) {
            firstCorrectDates[wordKey] = now;
          }
        }

        // Track personal bests (fastest spelling time per word)
        const personalBests = { ...prev.personalBests };
        const newPersonalBests: Record<string, boolean> = {};
        for (const completed of result.completedWords) {
          const wordKey = completed.word.toLowerCase();
          // Only track if we have timing data and it was spelled on first attempt
          if (completed.timeMs && completed.attempts === 1) {
            const existing = personalBests[wordKey];
            if (!existing || completed.timeMs < existing.timeMs) {
              personalBests[wordKey] = {
                timeMs: completed.timeMs,
                date: now,
                attempts: completed.attempts,
              };
              newPersonalBests[wordKey] = true;
            }
          }
        }
        // Store new personal bests on the result for UI display
        if (Object.keys(newPersonalBests).length > 0) {
          result.newPersonalBests = newPersonalBests;
        }

        // Analyze error patterns from wrong attempts
        const errorPatterns = { ...(prev.errorPatterns || createInitialErrorPatterns()) };
        if (result.wrongAttempts && result.wrongAttempts.length > 0) {
          for (const wrongAttempt of result.wrongAttempts) {
            const patterns = analyzeError(wrongAttempt.attempt, wrongAttempt.word);
            for (const pattern of patterns) {
              const existing = errorPatterns[pattern];
              errorPatterns[pattern] = {
                count: (existing?.count || 0) + 1,
                lastOccurrence: now,
                examples: [
                  { word: wrongAttempt.word, attempt: wrongAttempt.attempt, date: now },
                  ...(existing?.examples || []).slice(0, 9), // Keep last 10 examples
                ],
              };
            }
          }
        }

        return {
          modeStats: updatedModeStats,
          wordAccuracy,
          firstCorrectDates,
          personalBests,
          errorPatterns,
          // Legacy fields
          totalGamesPlayed: prev.totalGamesPlayed + 1,
          totalWins: prev.totalWins + (result.won ? 1 : 0),
          totalWordsAttempted: prev.totalWordsAttempted + result.wordsAttempted,
          totalWordsCorrect: prev.totalWordsCorrect + result.wordsCorrect,
          trophyCounts: newTrophyCounts,
          gameHistory: [result, ...prev.gameHistory].slice(0, 50),
          streakCurrent: newStreak,
          streakBest: Math.max(prev.streakBest, newStreak),
        };
      });

      // Update word mastery using spaced repetition algorithm
      // Note: Attempt history is recorded in real-time by recordWordAttempt(), not here
      setWordBank(prev => {
        const now = new Date().toISOString();

        // Create a set of words that were completed (spelled correctly)
        const completedWordTexts = new Set(
          result.completedWords.map(cw => cw.word.toLowerCase())
        );

        // Create a set of spot-check words (mastered words being reviewed)
        const spotCheckTexts = new Set(
          (result.spotCheckWords || []).map(w => w.toLowerCase())
        );

        const updatedWords = prev.words.map(word => {
          const wordTextLower = word.text.toLowerCase();
          const wasCompleted = completedWordTexts.has(wordTextLower);
          const wasSpotChecked = spotCheckTexts.has(wordTextLower);

          // Only update word if it was completed correctly
          if (wasCompleted) {
            let updated = updateWordMastery(word, true);

            // If this was a spot-check of a mastered word, update the timestamp
            if (wasSpotChecked) {
              updated = { ...updated, lastMasteredCheckAt: now };
            }

            return updated;
          }

          return word;
        });

        return {
          ...prev,
          words: updatedWords,
          lastUpdated: now,
        };
      });
    },
    [setStatistics, setWordBank]
  );

  // Clear game history
  const clearHistory = useCallback(() => {
    setStatistics(createInitialStatistics());
  }, [setStatistics]);

  // Calibration: Mark calibration as complete
  const setCalibrationComplete = useCallback((result: CalibrationResult) => {
    setCalibration(prev => ({
      ...prev,
      lastResult: result,
      hasCompletedCalibration: true,
      calibrationHistory: [result, ...prev.calibrationHistory].slice(0, 10),
    }));
  }, [setCalibration]);

  // Calibration: Reset calibration state
  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_STORED_CALIBRATION);
  }, [setCalibration]);

  // Derived state: has calibration been completed
  const hasCompletedCalibration = calibration.hasCompletedCalibration;

  const value = useMemo(
    () => ({
      wordBank,
      addWord,
      removeWord,
      importDefaultWords,
      importGradeWords,
      clearWordBank,
      wordExists,
      markWordsAsIntroduced,
      forceIntroduceWord,
      archiveWord,
      unarchiveWord,
      recordWordAttempt,
      statistics,
      recordGame,
      clearHistory,
      calibration,
      hasCompletedCalibration,
      setCalibrationComplete,
      resetCalibration,
    }),
    [
      wordBank,
      addWord,
      removeWord,
      importDefaultWords,
      importGradeWords,
      clearWordBank,
      wordExists,
      markWordsAsIntroduced,
      forceIntroduceWord,
      archiveWord,
      unarchiveWord,
      recordWordAttempt,
      statistics,
      recordGame,
      clearHistory,
      calibration,
      hasCompletedCalibration,
      setCalibrationComplete,
      resetCalibration,
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
