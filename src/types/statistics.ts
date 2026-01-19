import { TrophyTier, GameResult } from './game';
import { StatsModeId } from './gameMode';

// Error pattern types for categorizing spelling mistakes
export type ErrorPattern =
  | 'vowel-swap'      // recieve → receive
  | 'double-letter'   // begining → beginning
  | 'silent-letter'   // nife → knife
  | 'phonetic'        // enuff → enough
  | 'suffix'          // hapyness → happiness
  | 'prefix'          // unessary → unnecessary
  | 'missing-letter'  // diferent → different
  | 'extra-letter'    // tomorroww → tomorrow
  | 'transposition';  // freind → friend

// Tracking for error patterns
export interface ErrorPatternStats {
  count: number;
  lastOccurrence: string; // ISO date
  examples: { word: string; attempt: string; date: string }[];
}

// Personal best for a word
export interface PersonalBest {
  timeMs: number;
  date: string;
  attempts: number; // How many attempts it took that session
}

// Per-mode statistics structure
export interface ModeStatistics {
  totalGamesPlayed: number;
  totalWins: number;
  totalWordsAttempted: number;
  totalWordsCorrect: number;
  trophyCounts: Record<TrophyTier, number>;
  gameHistory: GameResult[];
  streakCurrent: number;
  streakBest: number;
}

// Word accuracy tracking (shared across all modes)
export interface WordAccuracy {
  attempts: number;
  correct: number;
}

// Main statistics interface with per-mode breakdown
// Note: savannah-quick shares stats with savannah
export interface GameStatistics {
  // Per-mode statistics (meadow, savannah, wildlands)
  // savannah-quick uses the savannah stats bucket
  modeStats: Record<StatsModeId, ModeStatistics>;

  // Shared word accuracy (across all modes)
  wordAccuracy: Record<string, WordAccuracy>;

  // Track first-time correct spellings (word -> ISO date when first spelled correctly)
  // Used for "First time spelling X!" celebrations
  firstCorrectDates: Record<string, string>;

  // Personal bests: fastest spelling time per word (word -> PersonalBest)
  personalBests: Record<string, PersonalBest>;

  // Error pattern tracking: pattern -> stats
  // Used for "Your Challenges" and celebrating pattern conquests
  errorPatterns: Record<ErrorPattern, ErrorPatternStats>;

  // Legacy aggregated fields (for backward compatibility)
  totalGamesPlayed: number;
  totalWins: number;
  totalWordsAttempted: number;
  totalWordsCorrect: number;
  trophyCounts: Record<TrophyTier, number>;
  gameHistory: GameResult[];
  streakCurrent: number;
  streakBest: number;
}

// Create initial per-mode statistics
export const createInitialModeStatistics = (): ModeStatistics => ({
  totalGamesPlayed: 0,
  totalWins: 0,
  totalWordsAttempted: 0,
  totalWordsCorrect: 0,
  trophyCounts: {
    platinum: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    participant: 0,
  },
  gameHistory: [],
  streakCurrent: 0,
  streakBest: 0,
});

// Create empty error pattern stats
export const createInitialErrorPatterns = (): Record<ErrorPattern, ErrorPatternStats> => ({
  'vowel-swap': { count: 0, lastOccurrence: '', examples: [] },
  'double-letter': { count: 0, lastOccurrence: '', examples: [] },
  'silent-letter': { count: 0, lastOccurrence: '', examples: [] },
  'phonetic': { count: 0, lastOccurrence: '', examples: [] },
  'suffix': { count: 0, lastOccurrence: '', examples: [] },
  'prefix': { count: 0, lastOccurrence: '', examples: [] },
  'missing-letter': { count: 0, lastOccurrence: '', examples: [] },
  'extra-letter': { count: 0, lastOccurrence: '', examples: [] },
  'transposition': { count: 0, lastOccurrence: '', examples: [] },
});

// Create initial statistics with per-mode structure
export const createInitialStatistics = (): GameStatistics => ({
  modeStats: {
    meadow: createInitialModeStatistics(),
    savannah: createInitialModeStatistics(),
    wildlands: createInitialModeStatistics(),
  },
  wordAccuracy: {},
  firstCorrectDates: {},
  personalBests: {},
  errorPatterns: createInitialErrorPatterns(),
  // Legacy aggregated fields
  totalGamesPlayed: 0,
  totalWins: 0,
  totalWordsAttempted: 0,
  totalWordsCorrect: 0,
  trophyCounts: {
    platinum: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    participant: 0,
  },
  gameHistory: [],
  streakCurrent: 0,
  streakBest: 0,
});

// Migration function for existing statistics without per-mode structure
export const migrateStatistics = (oldStats: Partial<GameStatistics>): GameStatistics => {
  const initial = createInitialStatistics();

  // If already has modeStats, use it (but ensure new fields exist)
  if (oldStats.modeStats) {
    return {
      ...initial,
      ...oldStats,
      modeStats: {
        meadow: oldStats.modeStats.meadow || createInitialModeStatistics(),
        savannah: oldStats.modeStats.savannah || createInitialModeStatistics(),
        wildlands: oldStats.modeStats.wildlands || createInitialModeStatistics(),
      },
      firstCorrectDates: oldStats.firstCorrectDates || {},
      personalBests: oldStats.personalBests || {},
      errorPatterns: oldStats.errorPatterns || createInitialErrorPatterns(),
    } as GameStatistics;
  }

  // Migrate legacy stats to savannah mode (existing game was savannah)
  const legacyModeStats: ModeStatistics = {
    totalGamesPlayed: oldStats.totalGamesPlayed || 0,
    totalWins: oldStats.totalWins || 0,
    totalWordsAttempted: oldStats.totalWordsAttempted || 0,
    totalWordsCorrect: oldStats.totalWordsCorrect || 0,
    trophyCounts: oldStats.trophyCounts || initial.trophyCounts,
    gameHistory: (oldStats.gameHistory || []).map(game => ({
      ...game,
      mode: game.mode || 'savannah',
    })),
    streakCurrent: oldStats.streakCurrent || 0,
    streakBest: oldStats.streakBest || 0,
  };

  return {
    modeStats: {
      meadow: createInitialModeStatistics(),
      savannah: legacyModeStats,
      wildlands: createInitialModeStatistics(),
    },
    wordAccuracy: oldStats.wordAccuracy || {},
    firstCorrectDates: oldStats.firstCorrectDates || {},
    personalBests: oldStats.personalBests || {},
    errorPatterns: oldStats.errorPatterns || createInitialErrorPatterns(),
    // Keep legacy fields in sync
    totalGamesPlayed: oldStats.totalGamesPlayed || 0,
    totalWins: oldStats.totalWins || 0,
    totalWordsAttempted: oldStats.totalWordsAttempted || 0,
    totalWordsCorrect: oldStats.totalWordsCorrect || 0,
    trophyCounts: oldStats.trophyCounts || initial.trophyCounts,
    gameHistory: (oldStats.gameHistory || []).map(game => ({
      ...game,
      mode: game.mode || 'savannah',
    })),
    streakCurrent: oldStats.streakCurrent || 0,
    streakBest: oldStats.streakBest || 0,
  };
};
