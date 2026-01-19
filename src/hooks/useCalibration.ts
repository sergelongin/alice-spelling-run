import { useReducer, useCallback, useMemo } from 'react';
import { GradeLevel } from '@/data/gradeWords';
import {
  CalibrationState,
  CalibrationResult,
  CalibrationAttempt,
  CALIBRATION_CONFIG,
} from '@/types/calibration';
import {
  initializeCalibrationWords,
  getNextCalibrationWords,
} from '@/utils/calibrationWordSelection';
import {
  calculateNextGrade,
  buildCalibrationResult,
  buildSkippedResult,
  shouldEndCalibration,
} from '@/utils/calibrationAlgorithm';

// Action types
type CalibrationAction =
  | { type: 'START' }
  | { type: 'SUBMIT_ANSWER'; isCorrect: boolean; responseTimeMs: number }
  | { type: 'NEXT_WORD' }
  | { type: 'SKIP'; selectedGrade: GradeLevel }
  | { type: 'COMPLETE' }
  | { type: 'RESET' }
  | { type: 'SET_PHASE'; phase: 'welcome' | 'playing' | 'results' };

// Initial state
const createInitialState = (): CalibrationState => {
  const { words, usedWords } = initializeCalibrationWords();

  return {
    status: 'not_started',
    phase: 'welcome',
    currentGrade: CALIBRATION_CONFIG.startingGrade,
    wordsAtCurrentGrade: 0,
    correctAtCurrentGrade: 0,
    totalWordsPresented: 0,
    attempts: [],
    currentWord: words[0] || '',
    currentWordIndex: 0,
    wordsForSession: words,
    usedWords,
    startTime: 0,
    wordStartTime: 0,
    gradeHistory: [],
    currentAttemptCount: 0,
    result: null,
  };
};

// Reducer
function calibrationReducer(
  state: CalibrationState,
  action: CalibrationAction
): CalibrationState {
  switch (action.type) {
    case 'START': {
      const { words, usedWords } = initializeCalibrationWords();
      return {
        ...state,
        status: 'in_progress',
        phase: 'playing',
        currentGrade: CALIBRATION_CONFIG.startingGrade,
        wordsAtCurrentGrade: 0,
        correctAtCurrentGrade: 0,
        totalWordsPresented: 0,
        attempts: [],
        currentWord: words[0] || '',
        currentWordIndex: 0,
        wordsForSession: words,
        usedWords,
        startTime: Date.now(),
        wordStartTime: Date.now(),
        gradeHistory: [],
        currentAttemptCount: 0,
        result: null,
      };
    }

    case 'SUBMIT_ANSWER': {
      const { isCorrect, responseTimeMs } = action;

      // Record the attempt
      const attempt: CalibrationAttempt = {
        word: state.currentWord,
        gradeLevel: state.currentGrade,
        isCorrect,
        responseTimeMs,
        attemptCount: state.currentAttemptCount + 1,
      };

      const newAttempts = [...state.attempts, attempt];
      const newGradeHistory = [...state.gradeHistory, state.currentGrade];
      const newWordsAtCurrentGrade = state.wordsAtCurrentGrade + 1;
      const newCorrectAtCurrentGrade = state.correctAtCurrentGrade + (isCorrect ? 1 : 0);
      const newTotalWordsPresented = state.totalWordsPresented + 1;

      // Create updated state for grade calculation
      const updatedState: CalibrationState = {
        ...state,
        attempts: newAttempts,
        gradeHistory: newGradeHistory,
        wordsAtCurrentGrade: newWordsAtCurrentGrade,
        correctAtCurrentGrade: newCorrectAtCurrentGrade,
        totalWordsPresented: newTotalWordsPresented,
        currentAttemptCount: 0,
      };

      // Check if calibration should end
      if (shouldEndCalibration(updatedState)) {
        const result = buildCalibrationResult(updatedState);
        return {
          ...updatedState,
          status: 'completed',
          phase: 'results',
          result,
        };
      }

      // Calculate next grade
      const gradeResult = calculateNextGrade(updatedState);

      if (gradeResult.action === 'complete') {
        const result = buildCalibrationResult(updatedState);
        return {
          ...updatedState,
          status: 'completed',
          phase: 'results',
          result,
        };
      }

      // Get next words if grade changed or need more words
      let newWordsForSession = state.wordsForSession;
      let newUsedWords = state.usedWords;
      let nextWordIndex = state.currentWordIndex + 1;

      if (gradeResult.action === 'move_up' || gradeResult.action === 'move_down') {
        // Grade changed - get new words for the new grade
        const newWords = getNextCalibrationWords(gradeResult.nextGrade, state.usedWords);
        newWordsForSession = newWords;
        nextWordIndex = 0;

        // Add new words to used set
        newUsedWords = new Set(state.usedWords);
        newWords.forEach(w => newUsedWords.add(w.toLowerCase()));

        return {
          ...updatedState,
          currentGrade: gradeResult.nextGrade,
          wordsAtCurrentGrade: 0,
          correctAtCurrentGrade: 0,
          wordsForSession: newWordsForSession,
          usedWords: newUsedWords,
          currentWordIndex: nextWordIndex,
          currentWord: newWordsForSession[nextWordIndex] || '',
          wordStartTime: Date.now(),
        };
      }

      // Same grade - check if we need more words
      if (nextWordIndex >= state.wordsForSession.length) {
        const newWords = getNextCalibrationWords(state.currentGrade, state.usedWords);
        newWordsForSession = newWords;
        nextWordIndex = 0;

        newUsedWords = new Set(state.usedWords);
        newWords.forEach(w => newUsedWords.add(w.toLowerCase()));
      }

      return {
        ...updatedState,
        wordsForSession: newWordsForSession,
        usedWords: newUsedWords,
        currentWordIndex: nextWordIndex,
        currentWord: newWordsForSession[nextWordIndex] || '',
        wordStartTime: Date.now(),
      };
    }

    case 'NEXT_WORD': {
      const nextIndex = state.currentWordIndex + 1;
      if (nextIndex < state.wordsForSession.length) {
        return {
          ...state,
          currentWordIndex: nextIndex,
          currentWord: state.wordsForSession[nextIndex],
          wordStartTime: Date.now(),
          currentAttemptCount: 0,
        };
      }
      return state;
    }

    case 'SKIP': {
      const result = buildSkippedResult(action.selectedGrade);
      return {
        ...state,
        status: 'skipped',
        phase: 'results',
        result,
      };
    }

    case 'COMPLETE': {
      const result = buildCalibrationResult(state);
      return {
        ...state,
        status: 'completed',
        phase: 'results',
        result,
      };
    }

    case 'SET_PHASE':
      return {
        ...state,
        phase: action.phase,
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// Hook return type
interface UseCalibrationReturn {
  state: CalibrationState;
  currentWord: string;
  currentGrade: GradeLevel;
  progress: number; // 0-100 percentage
  isComplete: boolean;
  result: CalibrationResult | null;
  actions: {
    start: () => void;
    submitAnswer: (isCorrect: boolean) => void;
    skip: (selectedGrade: GradeLevel) => void;
    reset: () => void;
    setPhase: (phase: 'welcome' | 'playing' | 'results') => void;
  };
}

export function useCalibration(): UseCalibrationReturn {
  const [state, dispatch] = useReducer(calibrationReducer, null, createInitialState);

  const start = useCallback(() => {
    dispatch({ type: 'START' });
  }, []);

  const submitAnswer = useCallback((isCorrect: boolean) => {
    const responseTimeMs = Date.now() - state.wordStartTime;
    dispatch({ type: 'SUBMIT_ANSWER', isCorrect, responseTimeMs });
  }, [state.wordStartTime]);

  const skip = useCallback((selectedGrade: GradeLevel) => {
    dispatch({ type: 'SKIP', selectedGrade });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setPhase = useCallback((phase: 'welcome' | 'playing' | 'results') => {
    dispatch({ type: 'SET_PHASE', phase });
  }, []);

  const progress = useMemo(() => {
    const maxWords = CALIBRATION_CONFIG.maxTotalWords;
    return Math.min(100, (state.totalWordsPresented / maxWords) * 100);
  }, [state.totalWordsPresented]);

  const isComplete = state.status === 'completed' || state.status === 'skipped';

  return {
    state,
    currentWord: state.currentWord,
    currentGrade: state.currentGrade,
    progress,
    isComplete,
    result: state.result,
    actions: {
      start,
      submitAnswer,
      skip,
      reset,
      setPhase,
    },
  };
}
