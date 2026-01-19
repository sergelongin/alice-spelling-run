export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

export type TrophyTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'participant';

export interface CompletedWord {
  word: string;
  attempts: number;
  timeMs?: number; // Time to spell correctly in milliseconds (for personal bests)
}

export interface WrongAttempt {
  input: string;
  incorrectIndices: number[];
}

export interface GameState {
  status: GameStatus;
  currentWordIndex: number;
  words: string[];
  currentInput: string;
  lives: number;
  maxLives: number;
  timeRemaining: number;
  maxTime: number;
  completedWords: CompletedWord[];
  incorrectIndices: number[];
  wrongAttempts: WrongAttempt[];           // Current word's wrong attempts (for UI feedback)
  sessionWrongAttempts: SessionWrongAttempt[]; // All session wrong attempts (for error pattern analysis)
  showConfetti: boolean;
  currentAttempts: number;
  wordStartTime: number; // Timestamp when current word started (for personal best tracking)
}

// Tracks a wrong attempt for error pattern analysis
export interface SessionWrongAttempt {
  word: string;       // The correct word
  attempt: string;    // What they typed
}

export interface GameResult {
  id: string;
  date: string;
  mode: 'meadow' | 'savannah' | 'wildlands';
  wordsAttempted: number;
  wordsCorrect: number;
  finalLives: number;
  trophy: TrophyTier | null;
  won: boolean;
  completedWords: CompletedWord[];
  totalTime: number;
  // Wrong attempts for error pattern analysis
  wrongAttempts?: SessionWrongAttempt[];
  // New personal bests achieved this session (word -> true)
  newPersonalBests?: Record<string, boolean>;
  // Gradual introduction tracking
  wordsIntroduced?: string[];  // Words that were introduced this session
  spotCheckWords?: string[];   // Mastered words that were spot-checked this session
  // Wildlands-specific fields
  challengeId?: string;
  score?: number;
}

export const INITIAL_LIVES = 5;
export const TIME_PER_WORD = 30;
export const MAX_WORDS_PER_SESSION = 20;
