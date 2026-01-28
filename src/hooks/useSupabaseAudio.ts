/**
 * Hook for playing audio from Supabase storage
 * Checks IndexedDB cache first, then Supabase, with fallback to Cartesia
 */

import { useCallback, useRef, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { checkAudioAvailability, downloadAudio, getAudioPublicUrl } from '@/services/audioStorage';
import { getCachedAudio, setCachedAudio, invalidateCacheEntry } from '@/utils/audioCache';

// Voice ID from environment (same as Cartesia uses)
const getVoiceId = (): string => {
  return import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
};

interface UseSupabaseAudioReturn {
  /**
   * Play audio for a word from Supabase
   * Returns true if audio was found and played, false if not available
   */
  playFromSupabase: (word: string) => Promise<boolean>;
  /**
   * Check if audio is available in Supabase (without playing)
   */
  checkAvailability: (word: string) => Promise<boolean>;
  /**
   * Cancel current playback
   */
  cancel: () => void;
  /**
   * Whether audio is currently playing
   */
  isPlaying: boolean;
}

export function useSupabaseAudio(): UseSupabaseAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudioFromUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      cancel(); // Cancel any existing playback

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
        resolve();
      };

      audio.onerror = (e) => {
        setIsPlaying(false);
        audioRef.current = null;
        reject(new Error(`Audio playback failed: ${e}`));
      };

      setIsPlaying(true);
      audio.play().catch((err) => {
        setIsPlaying(false);
        audioRef.current = null;
        reject(err);
      });
    });
  }, [cancel]);

  const checkAvailability = useCallback(async (word: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const voiceId = getVoiceId();
    const availability = await checkAudioAvailability(word, voiceId);
    return availability.exists;
  }, []);

  const playFromSupabase = useCallback(async (word: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const voiceId = getVoiceId();

    try {
      // 1. Check IndexedDB cache first
      const cached = await getCachedAudio(word, voiceId);

      // 2. Always check Supabase for current version (needed for cache validation)
      const availability = await checkAudioAvailability(word, voiceId);
      if (!availability.exists || !availability.pronunciation) {
        console.log('[SupabaseAudio] No audio available in Supabase for:', word);
        return false;
      }

      // 3. Validate cache freshness if we have a cached entry
      if (cached) {
        const serverUpdatedAt = availability.updatedAt
          ? new Date(availability.updatedAt).getTime()
          : 0;

        // Check if server has newer audio (or if cached entry lacks serverUpdatedAt)
        const cachedUpdatedAt = cached.entry.serverUpdatedAt || 0;
        if (serverUpdatedAt > cachedUpdatedAt) {
          console.log('[SupabaseAudio] Server has newer audio, invalidating cache:', word);
          await invalidateCacheEntry(word, voiceId);
        } else {
          // Cache is still valid - use it
          console.log('[SupabaseAudio] Playing from cache:', word);
          await playAudioFromUrl(cached.blobUrl);
          URL.revokeObjectURL(cached.blobUrl);
          return true;
        }
      }

      // 4. Download and cache the audio
      const storagePath = availability.pronunciation.storage_path;
      const blob = await downloadAudio(storagePath);

      if (!blob) {
        console.error('[SupabaseAudio] Failed to download audio for:', word);
        return false;
      }

      // Cache the blob data with server timestamp
      const serverUpdatedAt = availability.updatedAt
        ? new Date(availability.updatedAt).getTime()
        : Date.now();
      await setCachedAudio(word, voiceId, blob, storagePath, serverUpdatedAt);

      // Create blob URL for playback
      const blobUrl = URL.createObjectURL(blob);
      console.log('[SupabaseAudio] Playing downloaded audio:', word);
      await playAudioFromUrl(blobUrl);
      URL.revokeObjectURL(blobUrl);
      return true;

    } catch (err) {
      console.error('[SupabaseAudio] Error playing audio:', err);
      return false;
    }
  }, [playAudioFromUrl]);

  return {
    playFromSupabase,
    checkAvailability,
    cancel,
    isPlaying,
  };
}

/**
 * Utility function to check if Supabase audio is available for a word
 * Can be used outside of React components
 */
export async function isSupabaseAudioAvailable(word: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const voiceId = getVoiceId();

  // Check cache first
  const cached = await getCachedAudio(word, voiceId);
  if (cached) {
    return true;
  }

  // Check Supabase
  const availability = await checkAudioAvailability(word, voiceId);
  return availability.exists;
}

/**
 * Get audio URL for a word (from cache or Supabase)
 * Useful for preloading
 */
export async function getSupabaseAudioUrl(word: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const voiceId = getVoiceId();

  // Check cache first
  const cached = await getCachedAudio(word, voiceId);
  if (cached?.blobUrl) {
    return cached.blobUrl;
  }

  // Check Supabase
  const availability = await checkAudioAvailability(word, voiceId);
  if (!availability.exists || !availability.pronunciation) {
    return null;
  }

  return getAudioPublicUrl(availability.pronunciation.storage_path);
}
