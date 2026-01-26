/**
 * Supabase Storage service for audio pronunciations
 * Handles upload, download, and metadata operations for pre-generated audio
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  AudioPronunciation,
  AudioStorageMetadata,
  AudioAvailability,
  AudioSegmentType,
  AudioSegmentMetadata,
} from '@/types/audio';

const STORAGE_BUCKET = 'pronunciations';

/**
 * Normalize a word for consistent storage/lookup
 * Lowercase, trim, and remove special characters
 */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim().replace(/[^a-z]/g, '');
}

/**
 * Generate storage path for a word's audio file
 * Format: words/{voice_id}/{word_normalized}/{segment_type}.wav
 */
export function getStoragePath(
  word: string,
  voiceId: string,
  segmentType: AudioSegmentType = 'word'
): string {
  const normalized = normalizeWord(word);
  return `words/${voiceId}/${normalized}/${segmentType}.wav`;
}

/**
 * Legacy storage path format (for backwards compatibility)
 * Format: words/{voice_id}/{word_normalized}.wav
 */
export function getLegacyStoragePath(word: string, voiceId: string): string {
  const normalized = normalizeWord(word);
  return `words/${voiceId}/${normalized}.wav`;
}

/**
 * Check if audio exists in Supabase for a given word and segment
 */
export async function checkAudioAvailability(
  word: string,
  voiceId: string,
  segmentType: AudioSegmentType = 'word'
): Promise<AudioAvailability> {
  if (!isSupabaseConfigured()) {
    return { exists: false };
  }

  const wordNormalized = normalizeWord(word);

  // Check metadata table first
  const { data: pronunciation, error } = await supabase
    .from('audio_pronunciations')
    .select('*')
    .eq('word_normalized', wordNormalized)
    .eq('voice_id', voiceId)
    .eq('segment_type', segmentType)
    .single();

  if (error || !pronunciation) {
    return { exists: false };
  }

  // Get public URL for the audio file
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(pronunciation.storage_path);

  return {
    exists: true,
    pronunciation: pronunciation as AudioPronunciation,
    publicUrl: urlData?.publicUrl,
  };
}

/**
 * Get public URL for audio file
 */
export function getAudioPublicUrl(storagePath: string): string | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * Download audio file as blob
 */
export async function downloadAudio(storagePath: string): Promise<Blob | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);

  if (error) {
    console.error('[AudioStorage] Download error:', error);
    return null;
  }

  return data;
}

/**
 * Upload audio file to Supabase Storage and create metadata record
 * Only super_admin can upload (enforced by RLS)
 * Legacy function for backwards compatibility - uses 'word' segment type
 */
export async function uploadAudio(
  metadata: AudioStorageMetadata,
  audioBlob: Blob
): Promise<{ success: boolean; error?: string }> {
  // Convert to segment metadata format
  const segmentMetadata: AudioSegmentMetadata = {
    word: metadata.word,
    wordNormalized: metadata.wordNormalized,
    segmentType: 'word',
    textContent: metadata.word,
    voiceId: metadata.voiceId,
    emotion: metadata.emotion,
    speed: metadata.speed,
    storagePath: metadata.storagePath,
    fileSizeBytes: metadata.fileSizeBytes,
    durationMs: metadata.durationMs,
  };
  return uploadSegmentAudio(segmentMetadata, audioBlob);
}

/**
 * Upload audio segment to Supabase Storage and create metadata record
 * Supports word, definition, and sentence segments
 * Only super_admin can upload (enforced by RLS)
 */
export async function uploadSegmentAudio(
  metadata: AudioSegmentMetadata,
  audioBlob: Blob
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(metadata.storagePath, audioBlob, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (uploadError) {
      console.error('[AudioStorage] Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Create or update metadata record with segment_type
    // Use storage_path for onConflict since it's a unique constraint and is deterministically
    // derived from word/voice/segment - this avoids conflict with the composite unique constraint
    const { error: dbError } = await supabase.from('audio_pronunciations').upsert(
      {
        word: metadata.word,
        word_normalized: metadata.wordNormalized,
        voice_id: metadata.voiceId,
        emotion: metadata.emotion,
        speed: metadata.speed,
        volume: metadata.volume ?? 1.0,
        storage_path: metadata.storagePath,
        file_size_bytes: metadata.fileSizeBytes,
        duration_ms: metadata.durationMs,
        segment_type: metadata.segmentType,
        text_content: metadata.textContent,
      },
      {
        onConflict: 'storage_path',
      }
    );

    if (dbError) {
      console.error('[AudioStorage] DB error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from(STORAGE_BUCKET).remove([metadata.storagePath]);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[AudioStorage] Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Delete audio file and its metadata for a specific segment
 * Only super_admin can delete (enforced by RLS)
 */
export async function deleteAudio(
  word: string,
  voiceId: string,
  segmentType: AudioSegmentType = 'word'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const storagePath = getStoragePath(word, voiceId, segmentType);

  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      console.error('[AudioStorage] Storage delete error:', storageError);
    }

    // Delete metadata record
    const { error: dbError } = await supabase
      .from('audio_pronunciations')
      .delete()
      .eq('word_normalized', normalizeWord(word))
      .eq('voice_id', voiceId)
      .eq('segment_type', segmentType);

    if (dbError) {
      console.error('[AudioStorage] DB delete error:', dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[AudioStorage] Delete error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Delete all audio segments for a word
 */
export async function deleteAllSegments(
  word: string,
  voiceId: string
): Promise<{ success: boolean; error?: string }> {
  const segments: AudioSegmentType[] = ['word', 'definition', 'sentence'];
  const errors: string[] = [];

  for (const segment of segments) {
    const result = await deleteAudio(word, voiceId, segment);
    if (!result.success && result.error) {
      errors.push(`${segment}: ${result.error}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return { success: true };
}

/**
 * Get all audio pronunciations for a voice
 */
export async function getAudioForVoice(
  voiceId: string,
  segmentType?: AudioSegmentType
): Promise<AudioPronunciation[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  let query = supabase
    .from('audio_pronunciations')
    .select('*')
    .eq('voice_id', voiceId)
    .order('word', { ascending: true })
    .limit(5000); // Support up to ~1,667 words × 3 segments each

  if (segmentType) {
    query = query.eq('segment_type', segmentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AudioStorage] Error fetching audio:', error);
    return [];
  }

  return (data || []) as AudioPronunciation[];
}

/**
 * Get audio pronunciation records for multiple words (legacy - word segment only)
 */
export async function getAudioForWords(
  words: string[],
  voiceId: string
): Promise<Map<string, AudioPronunciation>> {
  if (!isSupabaseConfigured() || words.length === 0) {
    return new Map();
  }

  const normalizedWords = words.map(normalizeWord);

  const { data, error } = await supabase
    .from('audio_pronunciations')
    .select('*')
    .eq('voice_id', voiceId)
    .eq('segment_type', 'word')
    .in('word_normalized', normalizedWords)
    .limit(2000); // Support word bank growth beyond current 639 words

  if (error) {
    console.error('[AudioStorage] Error fetching audio:', error);
    return new Map();
  }

  const result = new Map<string, AudioPronunciation>();
  for (const pronunciation of data || []) {
    result.set(pronunciation.word_normalized, pronunciation as AudioPronunciation);
  }

  return result;
}

/**
 * Key format for segment map: `${word_normalized}:${segment_type}`
 */
export function getSegmentKey(wordNormalized: string, segmentType: AudioSegmentType): string {
  return `${wordNormalized}:${segmentType}`;
}

/**
 * Get all audio segments for multiple words
 * Returns a map keyed by `${word_normalized}:${segment_type}`
 */
export async function getAudioSegmentsForWords(
  words: string[],
  voiceId: string
): Promise<Map<string, AudioPronunciation>> {
  if (!isSupabaseConfigured() || words.length === 0) {
    return new Map();
  }

  const normalizedWords = words.map(normalizeWord);

  const { data, error } = await supabase
    .from('audio_pronunciations')
    .select('*')
    .eq('voice_id', voiceId)
    .in('word_normalized', normalizedWords)
    .limit(5000); // Support up to ~1,667 words × 3 segments each

  if (error) {
    console.error('[AudioStorage] Error fetching audio segments:', error);
    return new Map();
  }

  const result = new Map<string, AudioPronunciation>();
  for (const pronunciation of data || []) {
    const key = getSegmentKey(
      pronunciation.word_normalized,
      pronunciation.segment_type as AudioSegmentType
    );
    result.set(key, pronunciation as AudioPronunciation);
  }

  return result;
}

/**
 * Count segments for a set of words
 * Returns { word_normalized: { word: boolean, definition: boolean, sentence: boolean } }
 */
export async function getSegmentStatusForWords(
  words: string[],
  voiceId: string
): Promise<Map<string, Record<AudioSegmentType, boolean>>> {
  const segments = await getAudioSegmentsForWords(words, voiceId);
  const result = new Map<string, Record<AudioSegmentType, boolean>>();

  for (const word of words) {
    const normalized = normalizeWord(word);
    result.set(normalized, {
      word: segments.has(getSegmentKey(normalized, 'word')),
      definition: segments.has(getSegmentKey(normalized, 'definition')),
      sentence: segments.has(getSegmentKey(normalized, 'sentence')),
    });
  }

  return result;
}

/**
 * Get count of audio files for a voice
 */
export async function getAudioCount(
  voiceId: string,
  segmentType?: AudioSegmentType
): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  let query = supabase
    .from('audio_pronunciations')
    .select('*', { count: 'exact', head: true })
    .eq('voice_id', voiceId);

  if (segmentType) {
    query = query.eq('segment_type', segmentType);
  }

  const { count, error } = await query;

  if (error) {
    console.error('[AudioStorage] Error counting audio:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get segment counts for all words
 * Returns { total: number, bySegment: { word: number, definition: number, sentence: number } }
 */
export async function getSegmentCounts(voiceId: string): Promise<{
  total: number;
  bySegment: Record<AudioSegmentType, number>;
}> {
  const [wordCount, definitionCount, sentenceCount] = await Promise.all([
    getAudioCount(voiceId, 'word'),
    getAudioCount(voiceId, 'definition'),
    getAudioCount(voiceId, 'sentence'),
  ]);

  return {
    total: wordCount + definitionCount + sentenceCount,
    bySegment: {
      word: wordCount,
      definition: definitionCount,
      sentence: sentenceCount,
    },
  };
}
