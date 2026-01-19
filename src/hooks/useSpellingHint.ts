import { useState, useCallback, useRef } from 'react';
import { generateSpellingHint, isAIAvailable } from '@/services/aiProvider';
import { getRandomFallbackHint } from '@/types';

interface UseSpellingHintOptions {
  /** Number of wrong attempts before showing a hint (default: 2) */
  attemptsBeforeHint?: number;
  /** Whether to auto-generate hints (default: true) */
  autoGenerate?: boolean;
}

interface UseSpellingHintReturn {
  /** The current hint to display, or null if none */
  hint: string | null;
  /** Whether a hint is currently being generated */
  isLoading: boolean;
  /** Error message if hint generation failed */
  error: string | null;
  /** Number of wrong attempts for the current word */
  attemptCount: number;
  /** Record a wrong attempt - may trigger hint generation */
  recordAttempt: (guess: string, targetWord: string) => Promise<void>;
  /** Clear the current hint and reset attempt count */
  clearHint: () => void;
  /** Manually request a hint */
  requestHint: (guess: string, targetWord: string) => Promise<void>;
  /** Whether AI hints are available (API key configured) */
  aiAvailable: boolean;
}

const HINT_THRESHOLD = 2;

export function useSpellingHint(options: UseSpellingHintOptions = {}): UseSpellingHintReturn {
  const { attemptsBeforeHint = HINT_THRESHOLD, autoGenerate = true } = options;

  const [hint, setHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Track previous attempts for context
  const previousAttempts = useRef<string[]>([]);
  const currentTargetWord = useRef<string>('');
  // Use ref for attempt count to avoid stale closure issues
  const attemptCountRef = useRef(0);

  const aiAvailable = isAIAvailable();

  const generateHint = useCallback(async (guess: string, targetWord: string) => {
    console.log('[Hint] generateHint called, aiAvailable:', aiAvailable);
    setIsLoading(true);
    setError(null);

    try {
      if (!aiAvailable) {
        console.log('[Hint] AI not available, using fallback');
        // Use fallback hints if no API key
        setHint(getRandomFallbackHint());
        return;
      }

      const response = await generateSpellingHint({
        targetWord,
        guess,
        previousAttempts: previousAttempts.current,
      });

      setHint(response);
    } catch (err) {
      console.error('[Hint] Error generating hint:', err);
      console.log('[Hint] Using fallback hint due to error');
      setError('Could not generate hint');
      setHint(getRandomFallbackHint());
    } finally {
      setIsLoading(false);
    }
  }, [aiAvailable]);

  const recordAttempt = useCallback(async (guess: string, targetWord: string) => {
    console.log('[Hint] recordAttempt called:', { guess, targetWord, currentAttemptCount: attemptCountRef.current });

    // Reset if this is a new word
    if (targetWord !== currentTargetWord.current) {
      console.log('[Hint] New word detected, resetting');
      currentTargetWord.current = targetWord;
      previousAttempts.current = [];
      attemptCountRef.current = 0;
      setAttemptCount(0);
      setHint(null);
      setError(null);
    }

    // Add to previous attempts
    if (!previousAttempts.current.includes(guess)) {
      previousAttempts.current.push(guess);
    }

    // Use ref for reliable counting (avoids stale closure)
    const newCount = attemptCountRef.current + 1;
    attemptCountRef.current = newCount;
    setAttemptCount(newCount);
    console.log('[Hint] New attempt count:', newCount, 'threshold:', attemptsBeforeHint);

    // Auto-generate hint after threshold
    if (autoGenerate && newCount >= attemptsBeforeHint) {
      console.log('[Hint] Threshold reached, generating hint...');
      await generateHint(guess, targetWord);
    }
  }, [attemptsBeforeHint, autoGenerate, generateHint]);

  const clearHint = useCallback(() => {
    setHint(null);
    setError(null);
    setAttemptCount(0);
    attemptCountRef.current = 0;
    previousAttempts.current = [];
    currentTargetWord.current = '';
  }, []);

  const requestHint = useCallback(async (guess: string, targetWord: string) => {
    await generateHint(guess, targetWord);
  }, [generateHint]);

  return {
    hint,
    isLoading,
    error,
    attemptCount,
    recordAttempt,
    clearHint,
    requestHint,
    aiAvailable,
  };
}
