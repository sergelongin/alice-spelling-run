/**
 * Hook for admin audio generation
 * Generates audio via Cartesia and uploads to Supabase storage
 */

import { useState, useCallback, useRef } from 'react';
import { uploadAudio, normalizeWord, getStoragePath } from '@/services/audioStorage';
import type { AudioGenerationStatus, BatchGenerationState, AudioStorageMetadata } from '@/types/audio';

// Cartesia configuration from environment
const CARTESIA_BYTES_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2025-04-16';
const SAMPLE_RATE = 44100;

const getApiKey = (): string => import.meta.env.VITE_CARTESIA_API_KEY || '';
const getVoiceId = (): string =>
  import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
const getEmotion = (): string => import.meta.env.VITE_CARTESIA_EMOTION || 'enthusiastic';
const getSpeed = (): number => {
  const speed = parseFloat(import.meta.env.VITE_CARTESIA_SPEED || '1.0');
  return Math.min(1.5, Math.max(0.6, speed));
};

const initialBatchState: BatchGenerationState = {
  isGenerating: false,
  totalWords: 0,
  completedWords: 0,
  failedWords: [],
  currentWord: null,
  statuses: new Map(),
};

interface UseAdminAudioGeneratorReturn {
  /**
   * Generate audio for a single word
   */
  generateWord: (word: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Generate audio for multiple words (batch)
   */
  generateBatch: (words: string[]) => Promise<void>;
  /**
   * Cancel ongoing batch generation
   */
  cancelGeneration: () => void;
  /**
   * Current batch generation state
   */
  batchState: BatchGenerationState;
  /**
   * Get status for a specific word
   */
  getWordStatus: (word: string) => AudioGenerationStatus | undefined;
}

export function useAdminAudioGenerator(): UseAdminAudioGeneratorReturn {
  const [batchState, setBatchState] = useState<BatchGenerationState>(initialBatchState);
  const cancelRef = useRef(false);

  /**
   * Generate audio via Cartesia API
   */
  const generateCartesiaAudio = async (word: string): Promise<Blob> => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Cartesia API key not configured');
    }

    const response = await fetch(CARTESIA_BYTES_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Cartesia-Version': CARTESIA_VERSION,
      },
      body: JSON.stringify({
        transcript: word,
        model_id: 'sonic-3',
        voice: {
          mode: 'id',
          id: getVoiceId(),
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: SAMPLE_RATE,
        },
        generation_config: {
          speed: getSpeed(),
          emotion: getEmotion(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cartesia API error: ${response.status} - ${errorText}`);
    }

    return response.blob();
  };

  /**
   * Generate and upload audio for a single word
   */
  const generateWord = useCallback(
    async (word: string): Promise<{ success: boolean; error?: string }> => {
      const voiceId = getVoiceId();
      const emotion = getEmotion();
      const speed = getSpeed();

      // Update status
      setBatchState((prev) => ({
        ...prev,
        currentWord: word,
        statuses: new Map(prev.statuses).set(word, { word, status: 'generating' }),
      }));

      try {
        // Generate audio via Cartesia
        console.log('[AdminAudio] Generating audio for:', word);
        const audioBlob = await generateCartesiaAudio(word);

        // Update status to uploading
        setBatchState((prev) => ({
          ...prev,
          statuses: new Map(prev.statuses).set(word, { word, status: 'uploading' }),
        }));

        // Upload to Supabase
        const metadata: AudioStorageMetadata = {
          word,
          wordNormalized: normalizeWord(word),
          voiceId,
          emotion,
          speed,
          storagePath: getStoragePath(word, voiceId),
          fileSizeBytes: audioBlob.size,
        };

        const result = await uploadAudio(metadata, audioBlob);

        if (!result.success) {
          setBatchState((prev) => ({
            ...prev,
            statuses: new Map(prev.statuses).set(word, {
              word,
              status: 'error',
              error: result.error,
            }),
          }));
          return { success: false, error: result.error };
        }

        // Success
        setBatchState((prev) => ({
          ...prev,
          completedWords: prev.completedWords + 1,
          statuses: new Map(prev.statuses).set(word, { word, status: 'complete' }),
        }));

        console.log('[AdminAudio] Successfully generated and uploaded:', word);
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[AdminAudio] Error generating audio for', word, ':', err);

        setBatchState((prev) => ({
          ...prev,
          failedWords: [...prev.failedWords, word],
          statuses: new Map(prev.statuses).set(word, {
            word,
            status: 'error',
            error: errorMessage,
          }),
        }));

        return { success: false, error: errorMessage };
      }
    },
    []
  );

  /**
   * Generate audio for multiple words
   */
  const generateBatch = useCallback(
    async (words: string[]): Promise<void> => {
      if (words.length === 0) return;

      cancelRef.current = false;

      // Initialize batch state
      const initialStatuses = new Map<string, AudioGenerationStatus>();
      for (const word of words) {
        initialStatuses.set(word, { word, status: 'pending' });
      }

      setBatchState({
        isGenerating: true,
        totalWords: words.length,
        completedWords: 0,
        failedWords: [],
        currentWord: null,
        statuses: initialStatuses,
      });

      // Process words sequentially to avoid rate limits
      for (const word of words) {
        if (cancelRef.current) {
          console.log('[AdminAudio] Batch generation cancelled');
          break;
        }

        await generateWord(word);

        // Small delay between words to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setBatchState((prev) => ({
        ...prev,
        isGenerating: false,
        currentWord: null,
      }));

      console.log('[AdminAudio] Batch generation complete');
    },
    [generateWord]
  );

  /**
   * Cancel ongoing batch generation
   */
  const cancelGeneration = useCallback(() => {
    cancelRef.current = true;
    setBatchState((prev) => ({
      ...prev,
      isGenerating: false,
      currentWord: null,
    }));
  }, []);

  /**
   * Get status for a specific word
   */
  const getWordStatus = useCallback(
    (word: string): AudioGenerationStatus | undefined => {
      return batchState.statuses.get(word);
    },
    [batchState.statuses]
  );

  return {
    generateWord,
    generateBatch,
    cancelGeneration,
    batchState,
    getWordStatus,
  };
}
