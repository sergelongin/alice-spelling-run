import { grade3Words, grade3WordStrings } from './grade3';
import { grade4Words, grade4WordStrings } from './grade4';
import { grade5Words, grade5WordStrings } from './grade5';
import { grade6Words, grade6WordStrings } from './grade6';
import { WordDefinition } from './types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Word } from '@/types/database';
import { syncWordCatalog } from '@/db/syncWordCatalog';

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

// =============================================================================
// CUSTOM WORDS
// Functions for parent-created custom words
// =============================================================================

/**
 * Custom word data for insertion
 */
export interface CustomWordInput {
  word: string;
  definition: string;
  example?: string;
  gradeLevel: GradeLevel;
}

/**
 * Custom word with metadata (returned from Supabase)
 */
export interface CustomWord extends WordDefinition {
  id: string;
  gradeLevel: GradeLevel;
  createdAt: string;
}

/**
 * Insert a custom word into the Supabase catalog
 * The word will be marked as custom and owned by the current user
 */
export async function insertCustomWord(
  input: CustomWordInput,
  userId: string
): Promise<{ word: CustomWord | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { word: null, error: 'Supabase not configured' };
  }

  const wordNormalized = input.word.toLowerCase().trim();

  const { data, error } = await supabase
    .from('words')
    .insert({
      word: input.word.trim(),
      word_normalized: wordNormalized,
      definition: input.definition.trim(),
      example: input.example?.trim() || null,
      grade_level: input.gradeLevel,
      is_active: true,
      is_custom: true,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate word error
    if (error.code === '23505') {
      return { word: null, error: 'This word already exists in the catalog' };
    }
    return { word: null, error: error.message };
  }

  // Invalidate cache so the new word appears
  invalidateWordCache();

  // Trigger word catalog sync to update local WatermelonDB cache
  // This is non-blocking (fire and forget)
  syncWordCatalog(userId, true).catch(err => {
    console.warn('[GradeWords] Word catalog sync after insert failed:', err);
  });

  return {
    word: {
      id: data.id,
      word: data.word,
      definition: data.definition,
      example: data.example || undefined,
      gradeLevel: data.grade_level as GradeLevel,
      createdAt: data.created_at,
    },
    error: null,
  };
}

/**
 * Insert multiple custom words at once
 * Returns count of successfully inserted words
 */
export async function insertCustomWords(
  inputs: CustomWordInput[],
  userId: string
): Promise<{ count: number; errors: string[] }> {
  const results = await Promise.all(
    inputs.map(input => insertCustomWord(input, userId))
  );

  const errors: string[] = [];
  let count = 0;

  for (const result of results) {
    if (result.error) {
      errors.push(result.error);
    } else {
      count++;
    }
  }

  return { count, errors };
}

/**
 * Fetch custom words created by a specific user
 */
export async function fetchCustomWords(userId: string): Promise<CustomWord[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('created_by', userId)
    .eq('is_custom', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('[GradeWords] Error fetching custom words:', error?.message);
    return [];
  }

  return data.map(row => ({
    id: row.id,
    word: row.word,
    definition: row.definition,
    example: row.example || undefined,
    gradeLevel: row.grade_level as GradeLevel,
    createdAt: row.created_at,
  }));
}

/**
 * Delete a custom word from the catalog
 * Only the owner can delete their own custom words
 */
export async function deleteCustomWord(wordId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', wordId)
    .eq('is_custom', true);

  if (error) {
    return { error: error.message };
  }

  // Invalidate cache
  invalidateWordCache();

  return { error: null };
}

/**
 * Check if a word already exists in the catalog (system or custom)
 */
export async function wordExistsInCatalog(word: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    // Check local words
    const normalized = word.toLowerCase().trim();
    for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
      if (GRADE_WORDS[grade].some(w => w.word.toLowerCase() === normalized)) {
        return true;
      }
    }
    return false;
  }

  const { count, error } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('word_normalized', word.toLowerCase().trim())
    .eq('is_active', true);

  return !error && (count || 0) > 0;
}
