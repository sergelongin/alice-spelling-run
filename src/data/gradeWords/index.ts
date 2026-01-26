import { grade3Words, grade3WordStrings } from './grade3';
import { grade4Words, grade4WordStrings } from './grade4';
import { grade5Words, grade5WordStrings } from './grade5';
import { grade6Words, grade6WordStrings } from './grade6';
import { WordDefinition } from './types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Word } from '@/types/database';

export { grade3Words, grade4Words, grade5Words, grade6Words };
export { grade3WordStrings, grade4WordStrings, grade5WordStrings, grade6WordStrings };
export type { WordDefinition } from './types';

// Grade level type
export type GradeLevel = 3 | 4 | 5 | 6;

// Grade level metadata
export interface GradeLevelInfo {
  grade: GradeLevel;
  name: string;
  ageRange: string;
  description: string;
  wordCount: number;
  words: WordDefinition[];
}

// Map of grade levels to their word lists (with definitions)
export const GRADE_WORDS: Record<GradeLevel, WordDefinition[]> = {
  3: grade3Words,
  4: grade4Words,
  5: grade5Words,
  6: grade6Words,
};

// Map of grade levels to just word strings (for backwards compatibility)
export const GRADE_WORD_STRINGS: Record<GradeLevel, string[]> = {
  3: grade3WordStrings,
  4: grade4WordStrings,
  5: grade5WordStrings,
  6: grade6WordStrings,
};

// Grade level information
export const GRADE_INFO: GradeLevelInfo[] = [
  {
    grade: 3,
    name: 'Grade 3',
    ageRange: '8-9 years',
    description: 'High-frequency words, vowel patterns, compound words',
    wordCount: grade3Words.length,
    words: grade3Words,
  },
  {
    grade: 4,
    name: 'Grade 4',
    ageRange: '9-10 years',
    description: 'Silent letters, prefixes, suffixes, homophones',
    wordCount: grade4Words.length,
    words: grade4Words,
  },
  {
    grade: 5,
    name: 'Grade 5',
    ageRange: '10-11 years',
    description: 'Greek/Latin roots, advanced affixes, academic vocabulary',
    wordCount: grade5Words.length,
    words: grade5Words,
  },
  {
    grade: 6,
    name: 'Grade 6',
    ageRange: '11-12 years',
    description: 'Advanced vocabulary, scientific terms, challenging words',
    wordCount: grade6Words.length,
    words: grade6Words,
  },
];

// Get words for a specific grade (with definitions)
export function getWordsForGrade(grade: GradeLevel): WordDefinition[] {
  return GRADE_WORDS[grade] || [];
}

// Get word strings for a specific grade (just the word text)
export function getWordStringsForGrade(grade: GradeLevel): string[] {
  return GRADE_WORD_STRINGS[grade] || [];
}

// Get words for multiple grades (cumulative, with definitions)
export function getWordsUpToGrade(maxGrade: GradeLevel): WordDefinition[] {
  const words: WordDefinition[] = [];
  for (let g = 3; g <= maxGrade; g++) {
    words.push(...(GRADE_WORDS[g as GradeLevel] || []));
  }
  return words;
}

// Get total word count across all grades
export function getTotalWordCount(): number {
  return GRADE_INFO.reduce((sum, info) => sum + info.wordCount, 0);
}

// Suggest grade level based on accuracy
export function suggestGradeLevel(
  accuracy: number,
  currentGrade: GradeLevel
): GradeLevel {
  // If accuracy is very high (>90%), suggest moving up
  if (accuracy > 0.9 && currentGrade < 6) {
    return (currentGrade + 1) as GradeLevel;
  }
  // If accuracy is low (<60%), suggest moving down
  if (accuracy < 0.6 && currentGrade > 3) {
    return (currentGrade - 1) as GradeLevel;
  }
  // Otherwise stay at current level
  return currentGrade;
}

// Get grade level display info
export function getGradeInfo(grade: GradeLevel): GradeLevelInfo | undefined {
  return GRADE_INFO.find(info => info.grade === grade);
}

// =============================================================================
// SUPABASE INTEGRATION
// Async functions to fetch words from Supabase with fallback to local files
// =============================================================================

// Cache for Supabase words
let cachedSupabaseWords: Map<GradeLevel, WordDefinition[]> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Convert Supabase Word row to WordDefinition
 */
function toWordDefinition(word: Word): WordDefinition {
  return {
    word: word.word,
    definition: word.definition,
    example: word.example || undefined,
  };
}

/**
 * Group words by grade level
 */
function groupByGrade(words: Word[]): Map<GradeLevel, WordDefinition[]> {
  const grouped = new Map<GradeLevel, WordDefinition[]>();

  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    grouped.set(grade, []);
  }

  for (const word of words) {
    const gradeWords = grouped.get(word.grade_level as GradeLevel);
    if (gradeWords) {
      gradeWords.push(toWordDefinition(word));
    }
  }

  return grouped;
}

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cachedSupabaseWords || !cacheTimestamp) return false;
  return Date.now() - cacheTimestamp < CACHE_TTL;
}

/**
 * Fetch all words from Supabase and cache them
 */
async function fetchAndCacheWords(): Promise<Map<GradeLevel, WordDefinition[]>> {
  if (!isSupabaseConfigured()) {
    // Return local words as Map
    return new Map<GradeLevel, WordDefinition[]>([
      [3, grade3Words],
      [4, grade4Words],
      [5, grade5Words],
      [6, grade6Words],
    ]);
  }

  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('is_active', true)
    .order('word', { ascending: true });

  if (error || !data || data.length === 0) {
    console.warn('[GradeWords] Supabase fetch failed or empty, using local files:', error?.message);
    // Return local words as fallback
    return new Map<GradeLevel, WordDefinition[]>([
      [3, grade3Words],
      [4, grade4Words],
      [5, grade5Words],
      [6, grade6Words],
    ]);
  }

  // Cache the results
  cachedSupabaseWords = groupByGrade(data as Word[]);
  cacheTimestamp = Date.now();

  return cachedSupabaseWords;
}

/**
 * Invalidate the word cache (call after adding/removing words)
 */
export function invalidateWordCache(): void {
  cachedSupabaseWords = null;
  cacheTimestamp = null;
}

/**
 * Fetch words for a specific grade from Supabase
 * Falls back to local files if Supabase is unavailable
 */
export async function fetchWordsForGrade(grade: GradeLevel): Promise<WordDefinition[]> {
  // Use cache if valid
  if (isCacheValid() && cachedSupabaseWords) {
    return cachedSupabaseWords.get(grade) || [];
  }

  // Fetch and cache all words
  const wordsByGrade = await fetchAndCacheWords();
  return wordsByGrade.get(grade) || [];
}

/**
 * Fetch words for multiple grades from Supabase
 */
export async function fetchWordsUpToGrade(maxGrade: GradeLevel): Promise<WordDefinition[]> {
  // Use cache if valid
  if (!isCacheValid() || !cachedSupabaseWords) {
    await fetchAndCacheWords();
  }

  const words: WordDefinition[] = [];
  for (let g = 3; g <= maxGrade; g++) {
    const gradeWords = cachedSupabaseWords?.get(g as GradeLevel) || [];
    words.push(...gradeWords);
  }
  return words;
}

/**
 * Check if Supabase words are available
 */
export async function hasSupabaseWords(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { count, error } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return !error && (count || 0) > 0;
  } catch {
    return false;
  }
}
