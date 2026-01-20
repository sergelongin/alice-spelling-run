/**
 * Supabase Storage service for audio pronunciations
 * Handles upload, download, and metadata operations for pre-generated audio
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AudioPronunciation, AudioStorageMetadata, AudioAvailability } from '@/types/audio';

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
 * Format: words/{voice_id}/{word_normalized}.wav
 */
export function getStoragePath(word: string, voiceId: string): string {
  const normalized = normalizeWord(word);
  return `words/${voiceId}/${normalized}.wav`;
}

/**
 * Check if audio exists in Supabase for a given word
 */
export async function checkAudioAvailability(
  word: string,
  voiceId: string
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
 */
export async function uploadAudio(
  metadata: AudioStorageMetadata,
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

    // Create or update metadata record
    const { error: dbError } = await supabase.from('audio_pronunciations').upsert(
      {
        word: metadata.word,
        word_normalized: metadata.wordNormalized,
        voice_id: metadata.voiceId,
        emotion: metadata.emotion,
        speed: metadata.speed,
        storage_path: metadata.storagePath,
        file_size_bytes: metadata.fileSizeBytes,
        duration_ms: metadata.durationMs,
      },
      {
        onConflict: 'word_normalized,voice_id,emotion,speed',
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
 * Delete audio file and its metadata
 * Only super_admin can delete (enforced by RLS)
 */
export async function deleteAudio(
  word: string,
  voiceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const storagePath = getStoragePath(word, voiceId);

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
      .eq('voice_id', voiceId);

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
 * Get all audio pronunciations for a voice
 */
export async function getAudioForVoice(voiceId: string): Promise<AudioPronunciation[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('audio_pronunciations')
    .select('*')
    .eq('voice_id', voiceId)
    .order('word', { ascending: true });

  if (error) {
    console.error('[AudioStorage] Error fetching audio:', error);
    return [];
  }

  return (data || []) as AudioPronunciation[];
}

/**
 * Get audio pronunciation records for multiple words
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
    .in('word_normalized', normalizedWords);

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
 * Get count of audio files for a voice
 */
export async function getAudioCount(voiceId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  const { count, error } = await supabase
    .from('audio_pronunciations')
    .select('*', { count: 'exact', head: true })
    .eq('voice_id', voiceId);

  if (error) {
    console.error('[AudioStorage] Error counting audio:', error);
    return 0;
  }

  return count || 0;
}
