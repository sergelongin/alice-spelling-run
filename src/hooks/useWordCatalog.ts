/**
 * useWordCatalog Hook
 * Provides access to the local word catalog with fallback to local files.
 *
 * The word catalog is synced from Supabase to local WatermelonDB.
 * When the local database is empty (first launch, offline), falls back
 * to the bundled GRADE_WORDS files.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { wordCatalogCollection } from '@/db';
import { WordCatalog } from '@/db/models/WordCatalog';
import { GRADE_WORDS, GradeLevel, WordDefinition } from '@/data/gradeWords';

export interface CatalogWord {
  id: string;
  word: string;
  wordNormalized: string;
  definition: string;
  example?: string;
  gradeLevel: GradeLevel;
  isCustom: boolean;
  createdBy?: string;
}

interface UseWordCatalogResult {
  /** All words in the catalog */
  words: CatalogWord[];
  /** Whether the catalog is loading */
  isLoading: boolean;
  /** Whether using fallback (local files) instead of synced data */
  isFallback: boolean;
  /** Get words for a specific grade level */
  getWordsForGrade: (grade: GradeLevel) => CatalogWord[];
  /** Get words for multiple grades (cumulative) */
  getWordsUpToGrade: (maxGrade: GradeLevel) => CatalogWord[];
  /** Get only system words (not custom) */
  getSystemWords: () => CatalogWord[];
  /** Get only custom words */
  getCustomWords: () => CatalogWord[];
  /** Check if a word exists in the catalog */
  hasWord: (word: string) => boolean;
  /** Find a word by its text */
  findWord: (word: string) => CatalogWord | undefined;
  /** Get total word count */
  totalCount: number;
  /** Get word counts by grade */
  countsByGrade: Record<GradeLevel, number>;
}

/**
 * Convert WatermelonDB model to plain object
 */
function modelToCatalogWord(model: WordCatalog): CatalogWord {
  return {
    id: model.id,
    word: model.wordText,
    wordNormalized: model.wordNormalized,
    definition: model.definition,
    example: model.exampleSentence,
    gradeLevel: model.gradeLevel,
    isCustom: model.isCustom,
    createdBy: model.createdBy,
  };
}

/**
 * Convert local WordDefinition to CatalogWord format
 */
function localWordToCatalogWord(
  word: WordDefinition,
  grade: GradeLevel,
  index: number
): CatalogWord {
  const normalized = word.word.toLowerCase().trim().replace(/[^a-z]/g, '');
  return {
    id: `local-${grade}-${index}`,
    word: word.word,
    wordNormalized: normalized,
    definition: word.definition,
    example: word.example,
    gradeLevel: grade,
    isCustom: false,
  };
}

/**
 * Get all words from local GRADE_WORDS files as fallback
 */
function getLocalFallbackWords(): CatalogWord[] {
  const words: CatalogWord[] = [];
  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    const gradeWords = GRADE_WORDS[grade] || [];
    gradeWords.forEach((word, index) => {
      words.push(localWordToCatalogWord(word, grade, index));
    });
  }
  return words;
}

/**
 * Hook to access the word catalog with automatic fallback
 */
export function useWordCatalog(): UseWordCatalogResult {
  const [words, setWords] = useState<CatalogWord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  // Subscribe to word_catalog table changes
  useEffect(() => {
    let mounted = true;

    // Check if we have local data
    const checkAndSubscribe = async () => {
      try {
        const count = await wordCatalogCollection.query().fetchCount();

        if (count === 0) {
          // No local data - use fallback
          if (mounted) {
            setWords(getLocalFallbackWords());
            setIsFallback(true);
            setIsLoading(false);
          }
          return;
        }

        // Subscribe to word catalog table
        const subscription = wordCatalogCollection
          .query()
          .observe()
          .subscribe(records => {
            if (mounted) {
              if (records.length === 0) {
                // Table became empty - switch to fallback
                setWords(getLocalFallbackWords());
                setIsFallback(true);
              } else {
                setWords(records.map(modelToCatalogWord));
                setIsFallback(false);
              }
              setIsLoading(false);
            }
          });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[useWordCatalog] Error loading catalog:', error);
        if (mounted) {
          // On error, use fallback
          setWords(getLocalFallbackWords());
          setIsFallback(true);
          setIsLoading(false);
        }
      }
    };

    checkAndSubscribe();

    return () => {
      mounted = false;
    };
  }, []);

  // Memoized lookup map for quick word existence checks
  const wordMap = useMemo(() => {
    const map = new Map<string, CatalogWord>();
    for (const word of words) {
      map.set(word.wordNormalized, word);
    }
    return map;
  }, [words]);

  // Get words for a specific grade
  const getWordsForGrade = useCallback(
    (grade: GradeLevel): CatalogWord[] => {
      return words.filter(w => w.gradeLevel === grade);
    },
    [words]
  );

  // Get words up to and including a grade
  const getWordsUpToGrade = useCallback(
    (maxGrade: GradeLevel): CatalogWord[] => {
      return words.filter(w => w.gradeLevel <= maxGrade);
    },
    [words]
  );

  // Get only system words
  const getSystemWords = useCallback((): CatalogWord[] => {
    return words.filter(w => !w.isCustom);
  }, [words]);

  // Get only custom words
  const getCustomWords = useCallback((): CatalogWord[] => {
    return words.filter(w => w.isCustom);
  }, [words]);

  // Check if a word exists
  const hasWord = useCallback(
    (word: string): boolean => {
      const normalized = word.toLowerCase().trim().replace(/[^a-z]/g, '');
      return wordMap.has(normalized);
    },
    [wordMap]
  );

  // Find a word by text
  const findWord = useCallback(
    (word: string): CatalogWord | undefined => {
      const normalized = word.toLowerCase().trim().replace(/[^a-z]/g, '');
      return wordMap.get(normalized);
    },
    [wordMap]
  );

  // Calculate counts by grade
  const countsByGrade = useMemo(() => {
    const counts: Record<GradeLevel, number> = { 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const word of words) {
      if (word.gradeLevel >= 3 && word.gradeLevel <= 6) {
        counts[word.gradeLevel as GradeLevel]++;
      }
    }
    return counts;
  }, [words]);

  return {
    words,
    isLoading,
    isFallback,
    getWordsForGrade,
    getWordsUpToGrade,
    getSystemWords,
    getCustomWords,
    hasWord,
    findWord,
    totalCount: words.length,
    countsByGrade,
  };
}

/**
 * Synchronous version for use in non-React code (like calibration word selection).
 * Returns words from WatermelonDB if available, otherwise local fallback.
 *
 * NOTE: This fetches data directly without subscriptions.
 * For React components, use useWordCatalog() instead.
 */
export async function getWordCatalogSync(): Promise<CatalogWord[]> {
  try {
    const count = await wordCatalogCollection.query().fetchCount();
    if (count === 0) {
      return getLocalFallbackWords();
    }

    const records = await wordCatalogCollection.query().fetch();
    return records.map(modelToCatalogWord);
  } catch {
    return getLocalFallbackWords();
  }
}

/**
 * Get words for a specific grade (async, for non-React code)
 */
export async function getWordsForGradeAsync(grade: GradeLevel): Promise<CatalogWord[]> {
  try {
    const count = await wordCatalogCollection.query().fetchCount();
    if (count === 0) {
      // Fallback to local
      return (GRADE_WORDS[grade] || []).map((w, i) => localWordToCatalogWord(w, grade, i));
    }

    const records = await wordCatalogCollection
      .query(Q.where('grade_level', grade))
      .fetch();

    return records.map(modelToCatalogWord);
  } catch {
    return (GRADE_WORDS[grade] || []).map((w, i) => localWordToCatalogWord(w, grade, i));
  }
}
