// Game mode identifiers
// Note: 'savannah-quick' shares stats with 'savannah' but has shorter sessions
export type GameModeId = 'meadow' | 'savannah' | 'savannah-quick' | 'wildlands';

// Helper to get the stats mode for a given game mode
// savannah-quick shares stats with savannah
export type StatsModeId = 'meadow' | 'savannah' | 'wildlands';
export const getStatsModeId = (modeId: GameModeId): StatsModeId => {
  if (modeId === 'savannah-quick') return 'savannah';
  return modeId;
};

// Letter feedback for Wordle-style hints (Meadow Mode)
export type LetterFeedback = 'correct' | 'present' | 'absent' | 'empty';

export interface LetterFeedbackResult {
  letter: string;
  feedback: LetterFeedback;
}

// Configuration object for each game mode
export interface GameModeConfig {
  id: GameModeId;
  name: string;
  description: string;
  icon: string; // Lucide icon name

  // Gameplay settings
  hasTimer: boolean;
  timePerWord: number; // 0 for no timer
  hasLives: boolean;
  initialLives: number; // 0 for unlimited
  hasLionChase: boolean;
  maxWordsPerSession: number;

  // Feedback settings
  feedbackStyle: 'simple' | 'wordle';
  unlimitedAttempts: boolean;

  // Rewards and progression
  awardsTrophies: boolean;

  // Visual theme
  theme: 'meadow' | 'savannah' | 'wildlands';

  // Word source
  wordSource: 'wordBank' | 'dailyChallenge' | 'weeklyChallenge';
}

// Predefined mode configurations
export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  meadow: {
    id: 'meadow',
    name: 'Meadow Mode',
    description: 'Practice at your own pace with helpful hints',
    icon: 'Flower2',
    hasTimer: false,
    timePerWord: 0,
    hasLives: false,
    initialLives: 0,
    hasLionChase: false,
    maxWordsPerSession: 10,
    feedbackStyle: 'wordle',
    unlimitedAttempts: true,
    awardsTrophies: false,
    theme: 'meadow',
    wordSource: 'wordBank',
  },
  savannah: {
    id: 'savannah',
    name: 'Full Run',
    description: 'The classic 20-word challenge (~15 min)',
    icon: 'Zap',
    hasTimer: true,
    timePerWord: 30,
    hasLives: true,
    initialLives: 5,
    hasLionChase: true,
    maxWordsPerSession: 20,
    feedbackStyle: 'simple',
    unlimitedAttempts: false,
    awardsTrophies: true,
    theme: 'savannah',
    wordSource: 'wordBank',
  },
  'savannah-quick': {
    id: 'savannah-quick',
    name: 'Quick Play',
    description: 'Fast 8-word sprint (~5 min)',
    icon: 'Rocket',
    hasTimer: true,
    timePerWord: 30,
    hasLives: true,
    initialLives: 5,
    hasLionChase: true,
    maxWordsPerSession: 8,
    feedbackStyle: 'simple',
    unlimitedAttempts: false,
    awardsTrophies: true,
    theme: 'savannah',
    wordSource: 'wordBank',
  },
  wildlands: {
    id: 'wildlands',
    name: 'Wildlands League',
    description: 'Compete in daily & weekly challenges!',
    icon: 'Trophy',
    hasTimer: true,
    timePerWord: 30,
    hasLives: true,
    initialLives: 5,
    hasLionChase: true,
    maxWordsPerSession: 15,
    feedbackStyle: 'simple',
    unlimitedAttempts: false,
    awardsTrophies: true,
    theme: 'wildlands',
    wordSource: 'dailyChallenge',
  },
};

// Helper to get mode config
export function getGameModeConfig(modeId: GameModeId): GameModeConfig {
  return GAME_MODES[modeId];
}

// Default mode - Quick Play for shorter, more engaging sessions
export const DEFAULT_GAME_MODE: GameModeId = 'savannah-quick';
