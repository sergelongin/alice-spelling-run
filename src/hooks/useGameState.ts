import { useReducer, useCallback } from 'react';
import {
  GameState,
  GameResult,
  CompletedWord,
  WrongAttempt,
  SessionWrongAttempt,
  INITIAL_LIVES,
  TIME_PER_WORD,
  GameModeConfig,
  GameModeId,
  getStatsModeId,
} from '@/types';
import { findIncorrectIndices, calculateTrophy } from '@/utils';

type GameAction =
  | { type: 'START_GAME'; words: string[]; config?: GameModeConfig }
  | { type: 'SET_INPUT'; input: string }
  | { type: 'SUBMIT_ANSWER'; config?: GameModeConfig }
  | { type: 'TIME_UP' }
  | { type: 'NEXT_WORD' }
  | { type: 'SKIP_WORD' }
  | { type: 'RESET_TIMER' }
  | { type: 'HIDE_CONFETTI' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' };

const initialState: GameState = {
  status: 'idle',
  currentWordIndex: 0,
  words: [],
  currentInput: '',
  lives: INITIAL_LIVES,
  maxLives: INITIAL_LIVES,
  timeRemaining: TIME_PER_WORD,
  maxTime: TIME_PER_WORD,
  completedWords: [],
  incorrectIndices: [],
  wrongAttempts: [],
  sessionWrongAttempts: [],
  showConfetti: false,
  currentAttempts: 0,
  wordStartTime: 0,
  sessionStartTime: 0,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const config = action.config;
      const lives = config?.hasLives ? config.initialLives : 999; // Unlimited lives if mode doesn't have lives
      const maxTime = config?.hasTimer ? config.timePerWord : 999999;
      const now = Date.now();

      return {
        ...initialState,
        status: 'playing',
        words: action.words,
        lives,
        maxLives: lives,
        timeRemaining: maxTime,
        maxTime,
        wrongAttempts: [],
        sessionWrongAttempts: [], // Track all session wrong attempts for error analysis
        wordStartTime: now, // Track when this word started
        sessionStartTime: now, // Track when session started
      };
    }

    case 'SET_INPUT':
      return {
        ...state,
        currentInput: action.input,
        incorrectIndices: [], // Clear errors while typing
      };

    case 'SUBMIT_ANSWER': {
      const currentWord = state.words[state.currentWordIndex];
      const isCorrect = state.currentInput.toLowerCase() === currentWord.toLowerCase();

      if (isCorrect) {
        // Calculate time to spell this word (for personal best tracking)
        const timeMs = Date.now() - state.wordStartTime;

        const completedWord: CompletedWord = {
          word: currentWord,
          attempts: state.currentAttempts + 1,
          timeMs, // Track how long it took
        };

        const isLastWord = state.currentWordIndex >= state.words.length - 1;

        return {
          ...state,
          completedWords: [...state.completedWords, completedWord],
          showConfetti: true,
          incorrectIndices: [],
          wrongAttempts: [],
          currentAttempts: 0,
          status: isLastWord ? 'won' : state.status,
        };
      } else {
        // Wrong answer - don't lose a life, just record the attempt
        // Timer keeps running (if applicable) - only lose life when timer runs out
        const incorrectIndices = findIncorrectIndices(state.currentInput, currentWord);

        const wrongAttempt: WrongAttempt = {
          input: state.currentInput,
          incorrectIndices,
        };

        // Track for error pattern analysis (session-wide)
        const sessionWrongAttempt: SessionWrongAttempt = {
          word: currentWord,
          attempt: state.currentInput,
        };

        return {
          ...state,
          incorrectIndices: [],
          wrongAttempts: [...state.wrongAttempts, wrongAttempt],
          sessionWrongAttempts: [...state.sessionWrongAttempts, sessionWrongAttempt],
          currentInput: '',
          currentAttempts: state.currentAttempts + 1,
        };
      }
    }

    case 'TIME_UP': {
      // Lion catches you! Lose a life
      const newLives = state.lives - 1;

      if (newLives <= 0) {
        return {
          ...state,
          lives: 0,
          status: 'lost',
        };
      }

      // Move to next word with fresh timer
      const nextWordIndex = state.currentWordIndex + 1;
      const isLastWord = nextWordIndex >= state.words.length;

      if (isLastWord) {
        // No more words but still have lives - they lose but tried all words
        return {
          ...state,
          lives: newLives,
          status: 'lost',
        };
      }

      return {
        ...state,
        lives: newLives,
        currentWordIndex: nextWordIndex,
        currentInput: '',
        timeRemaining: state.maxTime,
        wrongAttempts: [],
        incorrectIndices: [],
        currentAttempts: 0,
        wordStartTime: Date.now(), // Reset timer for next word
      };
    }

    case 'NEXT_WORD':
      return {
        ...state,
        currentWordIndex: state.currentWordIndex + 1,
        currentInput: '',
        timeRemaining: state.maxTime,
        incorrectIndices: [],
        wrongAttempts: [],
        showConfetti: false,
        wordStartTime: Date.now(), // Reset timer for next word
      };

    case 'SKIP_WORD': {
      // Skip word without penalty (for Meadow mode)
      const nextWordIndex = state.currentWordIndex + 1;
      const isLastWord = nextWordIndex >= state.words.length;

      if (isLastWord) {
        // Last word - end the practice session
        return {
          ...state,
          status: 'won', // Practice complete
          currentInput: '',
          wrongAttempts: [],
        };
      }

      return {
        ...state,
        currentWordIndex: nextWordIndex,
        currentInput: '',
        wrongAttempts: [],
        incorrectIndices: [],
        currentAttempts: 0,
        wordStartTime: Date.now(), // Reset timer for next word
      };
    }

    case 'RESET_TIMER':
      return {
        ...state,
        timeRemaining: state.maxTime,
      };

    case 'HIDE_CONFETTI':
      return {
        ...state,
        showConfetti: false,
      };

    case 'PAUSE':
      return {
        ...state,
        status: 'paused',
      };

    case 'RESUME':
      return {
        ...state,
        status: 'playing',
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface UseGameStateReturn {
  gameState: GameState;
  startGame: (words: string[], config?: GameModeConfig) => void;
  setInput: (input: string) => void;
  submitAnswer: (config?: GameModeConfig) => void;
  handleTimeUp: () => void;
  nextWord: () => void;
  skipWord: () => void;
  resetTimer: () => void;
  hideConfetti: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  getCurrentWord: () => string;
  getGameResult: (mode?: GameModeId) => GameResult | null;
}

export function useGameState(): UseGameStateReturn {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);

  const startGame = useCallback((words: string[], config?: GameModeConfig) => {
    dispatch({ type: 'START_GAME', words, config });
  }, []);

  const setInput = useCallback((input: string) => {
    dispatch({ type: 'SET_INPUT', input });
  }, []);

  const submitAnswer = useCallback((config?: GameModeConfig) => {
    dispatch({ type: 'SUBMIT_ANSWER', config });
  }, []);

  const handleTimeUp = useCallback(() => {
    dispatch({ type: 'TIME_UP' });
  }, []);

  const nextWord = useCallback(() => {
    dispatch({ type: 'NEXT_WORD' });
  }, []);

  const skipWord = useCallback(() => {
    dispatch({ type: 'SKIP_WORD' });
  }, []);

  const resetTimer = useCallback(() => {
    dispatch({ type: 'RESET_TIMER' });
  }, []);

  const hideConfetti = useCallback(() => {
    dispatch({ type: 'HIDE_CONFETTI' });
  }, []);

  const pauseGame = useCallback(() => {
    dispatch({ type: 'PAUSE' });
  }, []);

  const resumeGame = useCallback(() => {
    dispatch({ type: 'RESUME' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const getCurrentWord = useCallback(() => {
    return gameState.words[gameState.currentWordIndex] || '';
  }, [gameState.words, gameState.currentWordIndex]);

  const getGameResult = useCallback((mode: GameModeId = 'savannah'): GameResult | null => {
    if (gameState.status !== 'won' && gameState.status !== 'lost') {
      return null;
    }

    // For meadow mode, always consider it a "win" (practice complete)
    const isWon = mode === 'meadow' ? true : gameState.status === 'won';

    // Map mode to stats mode (savannah-quick -> savannah for storage)
    const statsMode = getStatsModeId(mode);

    return {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mode: statsMode,
      wordsAttempted: gameState.currentWordIndex + 1,
      wordsCorrect: gameState.completedWords.length,
      finalLives: gameState.lives,
      trophy: isWon && statsMode !== 'meadow' ? calculateTrophy(gameState.lives) : null,
      won: isWon,
      completedWords: gameState.completedWords,
      wrongAttempts: gameState.sessionWrongAttempts, // Include wrong attempts for error pattern analysis
      totalTime: Date.now() - gameState.sessionStartTime,
    };
  }, [gameState]);

  return {
    gameState,
    startGame,
    setInput,
    submitAnswer,
    handleTimeUp,
    nextWord,
    skipWord,
    resetTimer,
    hideConfetti,
    pauseGame,
    resumeGame,
    resetGame,
    getCurrentWord,
    getGameResult,
  };
}
