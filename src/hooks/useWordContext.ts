import { useState, useCallback, useMemo } from 'react';

export type ContextLevel = 'word' | 'definition' | 'full';

interface WordContextData {
  word: string;
  definition?: string;
  exampleSentence?: string;
}

interface UseWordContextReturn {
  contextLevel: ContextLevel;
  escalateContext: () => void;
  resetContext: () => void;
  canEscalate: boolean;
  formatPronunciation: (data: WordContextData) => string;
}

const CONTEXT_LEVELS: ContextLevel[] = ['word', 'definition', 'full'];

/**
 * Hook for managing progressive context disclosure in word pronunciation.
 *
 * Context levels:
 * - 'word': Just the word (e.g., "Knot")
 * - 'definition': Word + definition + word (e.g., "Knot. A tie made by looping rope or string. Knot.")
 * - 'full': Word + definition + sentence + word (e.g., "Knot. A tie made by looping rope or string. She tied a knot in the rope. Knot.")
 */
export function useWordContext(): UseWordContextReturn {
  const [contextLevel, setContextLevel] = useState<ContextLevel>('word');

  const escalateContext = useCallback(() => {
    setContextLevel(current => {
      const currentIndex = CONTEXT_LEVELS.indexOf(current);
      const nextIndex = Math.min(currentIndex + 1, CONTEXT_LEVELS.length - 1);
      return CONTEXT_LEVELS[nextIndex];
    });
  }, []);

  const resetContext = useCallback(() => {
    setContextLevel('word');
  }, []);

  const canEscalate = useMemo(() => {
    return contextLevel !== 'full';
  }, [contextLevel]);

  const formatPronunciation = useCallback((data: WordContextData): string => {
    const { word, definition, exampleSentence } = data;

    // Capitalize first letter for TTS
    const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);

    switch (contextLevel) {
      case 'word':
        return capitalizedWord;

      case 'definition':
        if (definition) {
          return `${capitalizedWord}. ${definition}. ${capitalizedWord}.`;
        }
        // Fall back to just the word if no definition available
        return capitalizedWord;

      case 'full':
        if (definition && exampleSentence) {
          return `${capitalizedWord}. ${definition}. ${exampleSentence}. ${capitalizedWord}.`;
        } else if (definition) {
          // No sentence available, just use definition
          return `${capitalizedWord}. ${definition}. ${capitalizedWord}.`;
        }
        // Fall back to just the word
        return capitalizedWord;

      default:
        return capitalizedWord;
    }
  }, [contextLevel]);

  return {
    contextLevel,
    escalateContext,
    resetContext,
    canEscalate,
    formatPronunciation,
  };
}
