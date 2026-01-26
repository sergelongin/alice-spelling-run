/**
 * Word Bank Service
 * Manages words in Supabase - CRUD operations for the word bank
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Word, WordInsert } from '@/types/database';
import type { GradeLevel } from '@/data/gradeWords';

/**
 * Normalize a word for consistent storage/lookup
 * Lowercase, trim, and remove special characters
 */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim().replace(/[^a-z]/g, '');
}

/**
 * Input for adding a new word
 */
export interface WordInput {
  word: string;
  definition: string;
  example?: string;
  gradeLevel: GradeLevel;
}

/**
 * Get all words from Supabase, optionally filtered by grade level
 */
export async function getWords(gradeLevel?: GradeLevel): Promise<Word[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[WordBank] Supabase not configured');
    return [];
  }

  let query = supabase
    .from('words')
    .select('*')
    .eq('is_active', true)
    .order('word', { ascending: true })
    .limit(2000); // Support word bank growth beyond current 639 words

  if (gradeLevel !== undefined) {
    query = query.eq('grade_level', gradeLevel);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[WordBank] Error fetching words:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all words grouped by grade level
 */
export async function getWordsByGrade(): Promise<Map<GradeLevel, Word[]>> {
  const words = await getWords();
  const grouped = new Map<GradeLevel, Word[]>();

  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    grouped.set(grade, []);
  }

  for (const word of words) {
    const gradeWords = grouped.get(word.grade_level as GradeLevel);
    if (gradeWords) {
      gradeWords.push(word);
    }
  }

  return grouped;
}

/**
 * Check if a word already exists (duplicate check)
 */
export async function checkDuplicate(word: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const normalized = normalizeWord(word);

  const { data, error } = await supabase
    .from('words')
    .select('id')
    .eq('word_normalized', normalized)
    .limit(1);

  if (error) {
    console.error('[WordBank] Error checking duplicate:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Add a new word to the word bank
 * Returns error if duplicate exists
 */
export async function addWord(
  input: WordInput
): Promise<{ success: boolean; word?: Word; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const normalized = normalizeWord(input.word);

  // Check for duplicates first
  const isDuplicate = await checkDuplicate(input.word);
  if (isDuplicate) {
    return { success: false, error: `Word "${input.word}" already exists` };
  }

  const wordData: WordInsert = {
    word: input.word.trim(),
    word_normalized: normalized,
    definition: input.definition.trim(),
    example: input.example?.trim() || null,
    grade_level: input.gradeLevel,
  };

  const { data, error } = await supabase
    .from('words')
    .insert(wordData)
    .select()
    .single();

  if (error) {
    console.error('[WordBank] Error adding word:', error);
    // Handle unique constraint violation
    if (error.code === '23505') {
      return { success: false, error: `Word "${input.word}" already exists` };
    }
    return { success: false, error: error.message };
  }

  return { success: true, word: data };
}

/**
 * Update an existing word
 */
export async function updateWord(
  wordId: string,
  updates: Partial<WordInput>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const updateData: Record<string, unknown> = {};

  if (updates.word !== undefined) {
    updateData.word = updates.word.trim();
    updateData.word_normalized = normalizeWord(updates.word);
  }
  if (updates.definition !== undefined) {
    updateData.definition = updates.definition.trim();
  }
  if (updates.example !== undefined) {
    updateData.example = updates.example?.trim() || null;
  }
  if (updates.gradeLevel !== undefined) {
    updateData.grade_level = updates.gradeLevel;
  }

  const { error } = await supabase
    .from('words')
    .update(updateData)
    .eq('id', wordId);

  if (error) {
    console.error('[WordBank] Error updating word:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Remove a word (soft delete - sets is_active to false)
 */
export async function removeWord(
  wordId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('words')
    .update({ is_active: false })
    .eq('id', wordId);

  if (error) {
    console.error('[WordBank] Error removing word:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get a single word by ID
 */
export async function getWordById(wordId: string): Promise<Word | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('id', wordId)
    .single();

  if (error) {
    console.error('[WordBank] Error fetching word:', error);
    return null;
  }

  return data;
}

/**
 * Get word count statistics
 */
export async function getWordStats(): Promise<{
  total: number;
  byGrade: Record<GradeLevel, number>;
}> {
  const words = await getWords();

  const stats = {
    total: words.length,
    byGrade: {
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    } as Record<GradeLevel, number>,
  };

  for (const word of words) {
    const grade = word.grade_level as GradeLevel;
    if (grade in stats.byGrade) {
      stats.byGrade[grade]++;
    }
  }

  return stats;
}

/**
 * Options for paginated words query
 */
export interface WordsQueryOptions {
  gradeLevel?: GradeLevel;
  page?: number;       // 0-indexed
  pageSize?: number;   // Default 50
  search?: string;     // Search by word (case-insensitive partial match)
}

/**
 * Result from paginated words query
 */
export interface WordsQueryResult {
  words: Word[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get words with pagination and optional search/filter
 * Uses server-side filtering and pagination to avoid PostgREST row limits
 */
export async function getWordsPaginated(options: WordsQueryOptions = {}): Promise<WordsQueryResult> {
  const { gradeLevel, page = 0, pageSize = 50, search } = options;

  if (!isSupabaseConfigured()) {
    console.warn('[WordBank] Supabase not configured');
    return { words: [], total: 0, page, pageSize, totalPages: 0 };
  }

  let query = supabase
    .from('words')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('word', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (gradeLevel !== undefined) {
    query = query.eq('grade_level', gradeLevel);
  }

  if (search && search.trim()) {
    query = query.ilike('word', `%${search.trim()}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('[WordBank] Error fetching paginated words:', error);
    return { words: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const total = count || 0;
  return {
    words: (data || []) as Word[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get total word count (efficient COUNT query without fetching data)
 */
export async function getWordCount(gradeLevel?: GradeLevel): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  let query = supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (gradeLevel !== undefined) {
    query = query.eq('grade_level', gradeLevel);
  }

  const { count, error } = await query;

  if (error) {
    console.error('[WordBank] Error counting words:', error);
    return 0;
  }

  return count || 0;
}
