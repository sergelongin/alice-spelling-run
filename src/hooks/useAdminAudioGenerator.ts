/**
 * Hook for admin audio generation
 * Generates audio via Cartesia and uploads to Supabase storage
 */

import { useState, useCallback, useRef } from 'react';
import {
  uploadSegmentAudio,
  normalizeWord,
  getStoragePath,
} from '@/services/audioStorage';
import type {
  AudioGenerationStatus,
  BatchGenerationState,
  AudioSegmentMetadata,
  AudioSegmentType,
} from '@/types/audio';
import type { WordDefinition } from '@/data/gradeWords';

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

/**
 * Key format for segment status: `${word}:${segmentType}`
 */
function getSegmentStatusKey(word: string, segmentType: AudioSegmentType): string {
  return `${word}:${segmentType}`;
}

/**
 * Get concurrency limit from environment (1-20, default 3 for Pro plan)
 */
function getConcurrencyLimit(): number {
  const limit = parseInt(import.meta.env.VITE_AUDIO_GENERATION_CONCURRENCY || '3');
  return Math.min(20, Math.max(1, limit));
}

/**
 * Process tasks concurrently with controlled pool size
 */
async function processConcurrently<T, R>(
  tasks: T[],
  concurrency: number,
  processor: (task: T, index: number) => Promise<R>,
  shouldCancel: () => boolean
): Promise<R[]> {
  const results: R[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < tasks.length; i++) {
    if (shouldCancel()) break;

    const promise = (async () => {
      results[i] = await processor(tasks[i], i);
    })();

    executing.add(promise);
    promise.finally(() => executing.delete(promise));

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Exponential backoff delay for retries (max 5 seconds)
 */
function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 5000);
}

/**
 * Override settings for audio generation
 */
export interface AudioGenerationOverrides {
  volume?: number;
  emotion?: string;
  speed?: number;
}

interface UseAdminAudioGeneratorReturn {
  /**
   * Generate audio for a single word (legacy - word segment only)
   */
  generateWord: (word: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Generate audio for a specific segment
   */
  generateSegment: (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    overrides?: AudioGenerationOverrides
  ) => Promise<{ success: boolean; error?: string }>;
  /**
   * Generate all segments for a word definition
   */
  generateAllSegments: (
    wordDef: WordDefinition
  ) => Promise<{ success: boolean; errors?: string[] }>;
  /**
   * Generate audio for multiple words (batch)
   */
  generateBatch: (words: string[]) => Promise<void>;
  /**
   * Generate all segments for multiple word definitions (batch)
   */
  generateBatchSegments: (wordDefs: WordDefinition[]) => Promise<void>;
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
  /**
   * Get status for a specific segment
   */
  getSegmentStatus: (
    word: string,
    segmentType: AudioSegmentType
  ) => AudioGenerationStatus | undefined;
  /**
   * Generate audio preview (in-memory, no upload)
   * Returns blob for playback, can be saved later with uploadPreviewedAudio
   */
  generatePreview: (
    text: string,
    overrides?: AudioGenerationOverrides
  ) => Promise<{ blob: Blob } | { error: string }>;
  /**
   * Upload a previously generated preview blob to storage
   */
  uploadPreviewedAudio: (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    blob: Blob,
    overrides?: AudioGenerationOverrides
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useAdminAudioGenerator(): UseAdminAudioGeneratorReturn {
  const [batchState, setBatchState] = useState<BatchGenerationState>(initialBatchState);
  const cancelRef = useRef(false);

  /**
   * Generate audio via Cartesia API
   */
  const generateCartesiaAudio = async (
    text: string,
    overrides?: AudioGenerationOverrides
  ): Promise<Blob> => {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Cartesia API key not configured');
    }

    const volume = overrides?.volume ?? 1.0;
    const speed = overrides?.speed ?? getSpeed();
    const emotion = overrides?.emotion ?? getEmotion();

    const response = await fetch(CARTESIA_BYTES_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Cartesia-Version': CARTESIA_VERSION,
      },
      body: JSON.stringify({
        transcript: text,
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
          volume,
          speed,
          emotion,
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
   * Internal segment generation logic (without retry)
   * Note: 'generating' status should be set by caller before calling this function
   */
  const generateSegmentInternal = async (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    overrides?: AudioGenerationOverrides
  ): Promise<void> => {
    const voiceId = getVoiceId();
    const emotion = overrides?.emotion ?? getEmotion();
    const speed = overrides?.speed ?? getSpeed();
    const volume = overrides?.volume ?? 1.0;
    const statusKey = getSegmentStatusKey(word, segmentType);

    // Generate audio via Cartesia
    console.log(`[AdminAudio] Generating ${segmentType} audio for:`, word, { volume, emotion, speed });
    const audioBlob = await generateCartesiaAudio(textContent, overrides);

    // Update status to uploading
    setBatchState((prev) => ({
      ...prev,
      statuses: new Map(prev.statuses).set(statusKey, { word: statusKey, status: 'uploading' }),
    }));

    // Upload to Supabase
    const metadata: AudioSegmentMetadata = {
      word,
      wordNormalized: normalizeWord(word),
      segmentType,
      textContent,
      voiceId,
      emotion,
      speed,
      volume,
      storagePath: getStoragePath(word, voiceId, segmentType),
      fileSizeBytes: audioBlob.size,
    };

    const result = await uploadSegmentAudio(metadata, audioBlob);

    if (!result.success) {
      setBatchState((prev) => ({
        ...prev,
        statuses: new Map(prev.statuses).set(statusKey, {
          word: statusKey,
          status: 'error',
          error: result.error,
        }),
      }));
      throw new Error(result.error);
    }

    // Success
    setBatchState((prev) => ({
      ...prev,
      completedWords: prev.completedWords + 1,
      statuses: new Map(prev.statuses).set(statusKey, { word: statusKey, status: 'complete' }),
    }));

    console.log(`[AdminAudio] Successfully generated and uploaded ${segmentType} for:`, word);
  };

  /**
   * Generate and upload audio for a specific segment (with retry logic)
   */
  const generateSegment = useCallback(
    async (
      word: string,
      segmentType: AudioSegmentType,
      textContent: string,
      overrides?: AudioGenerationOverrides
    ): Promise<{ success: boolean; error?: string }> => {
      const maxRetries = 3;
      const statusKey = getSegmentStatusKey(word, segmentType);

      // Set 'generating' status once before retry loop (fix for status showing multiple times)
      setBatchState((prev) => ({
        ...prev,
        currentWord: `${word} (${segmentType})`,
        statuses: new Map(prev.statuses).set(statusKey, { word: statusKey, status: 'generating' }),
      }));

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await generateSegmentInternal(word, segmentType, textContent, overrides);
          return { success: true };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isRateLimit =
            errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');

          if (isRateLimit && attempt < maxRetries) {
            const delay = backoffDelay(attempt);
            console.warn(
              `[AdminAudio] Rate limited, retry ${attempt}/${maxRetries} after ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (attempt === maxRetries) {
            console.error(`[AdminAudio] Error generating ${segmentType} audio for`, word, ':', err);
            setBatchState((prev) => ({
              ...prev,
              failedWords: [...prev.failedWords, statusKey],
              statuses: new Map(prev.statuses).set(statusKey, {
                word: statusKey,
                status: 'error',
                error: errorMessage,
              }),
            }));
            return { success: false, error: errorMessage };
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return { success: false, error: 'Max retries exceeded' };
    },
    []
  );

  /**
   * Generate and upload audio for a single word (legacy - word segment only)
   */
  const generateWord = useCallback(
    async (word: string): Promise<{ success: boolean; error?: string }> => {
      return generateSegment(word, 'word', word);
    },
    [generateSegment]
  );

  /**
   * Generate all segments for a word definition
   */
  const generateAllSegments = useCallback(
    async (wordDef: WordDefinition): Promise<{ success: boolean; errors?: string[] }> => {
      const errors: string[] = [];

      // Generate word segment
      const wordResult = await generateSegment(wordDef.word, 'word', wordDef.word);
      if (!wordResult.success && wordResult.error) {
        errors.push(`word: ${wordResult.error}`);
      }

      // Small delay between segments
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Generate definition segment
      const definitionText = `${wordDef.word}: ${wordDef.definition}`;
      const defResult = await generateSegment(wordDef.word, 'definition', definitionText);
      if (!defResult.success && defResult.error) {
        errors.push(`definition: ${defResult.error}`);
      }

      // Generate sentence segment if example exists
      if (wordDef.example) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const sentenceResult = await generateSegment(wordDef.word, 'sentence', wordDef.example);
        if (!sentenceResult.success && sentenceResult.error) {
          errors.push(`sentence: ${sentenceResult.error}`);
        }
      }

      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
    [generateSegment]
  );

  /**
   * Generate audio for multiple words (word segment only)
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
   * Generate all segments for multiple word definitions (batch with concurrency)
   */
  const generateBatchSegments = useCallback(
    async (wordDefs: WordDefinition[]): Promise<void> => {
      if (wordDefs.length === 0) return;

      cancelRef.current = false;

      // Build flat list of all segment tasks
      interface SegmentTask {
        word: string;
        segmentType: AudioSegmentType;
        textContent: string;
      }

      const tasks: SegmentTask[] = [];
      for (const def of wordDefs) {
        tasks.push({
          word: def.word,
          segmentType: 'word',
          textContent: def.word,
        });
        tasks.push({
          word: def.word,
          segmentType: 'definition',
          textContent: `${def.word}: ${def.definition}`,
        });
        if (def.example) {
          tasks.push({
            word: def.word,
            segmentType: 'sentence',
            textContent: def.example,
          });
        }
      }

      // Initialize status map
      const initialStatuses = new Map<string, AudioGenerationStatus>();
      for (const task of tasks) {
        const key = getSegmentStatusKey(task.word, task.segmentType);
        initialStatuses.set(key, { word: key, status: 'pending' });
      }

      setBatchState({
        isGenerating: true,
        totalWords: tasks.length,
        completedWords: 0,
        failedWords: [],
        currentWord: null,
        statuses: initialStatuses,
      });

      const concurrency = getConcurrencyLimit();
      console.log(
        `[AdminAudio] Starting batch: ${tasks.length} segments, concurrency: ${concurrency}`
      );

      // Process segments in parallel with concurrency limit
      await processConcurrently(
        tasks,
        concurrency,
        async (task) => {
          if (cancelRef.current) return { success: false };

          const result = await generateSegment(task.word, task.segmentType, task.textContent);

          // Small delay to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 100));

          return result;
        },
        () => cancelRef.current
      );

      setBatchState((prev) => ({
        ...prev,
        isGenerating: false,
        currentWord: null,
      }));

      console.log('[AdminAudio] Batch segment generation complete');
    },
    [generateSegment]
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
   * Get status for a specific word (legacy - word segment only)
   */
  const getWordStatus = useCallback(
    (word: string): AudioGenerationStatus | undefined => {
      // Try both legacy key and segment key
      return (
        batchState.statuses.get(word) ||
        batchState.statuses.get(getSegmentStatusKey(word, 'word'))
      );
    },
    [batchState.statuses]
  );

  /**
   * Get status for a specific segment
   */
  const getSegmentStatus = useCallback(
    (word: string, segmentType: AudioSegmentType): AudioGenerationStatus | undefined => {
      return batchState.statuses.get(getSegmentStatusKey(word, segmentType));
    },
    [batchState.statuses]
  );

  /**
   * Generate audio preview (in-memory, no upload)
   * Returns blob for playback, user can save later with uploadPreviewedAudio
   */
  const generatePreview = useCallback(
    async (
      text: string,
      overrides?: AudioGenerationOverrides
    ): Promise<{ blob: Blob } | { error: string }> => {
      try {
        const blob = await generateCartesiaAudio(text, overrides);
        return { blob };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[AdminAudio] Preview generation error:', errorMessage);
        return { error: errorMessage };
      }
    },
    []
  );

  /**
   * Upload a previously generated preview blob to storage
   */
  const uploadPreviewedAudio = useCallback(
    async (
      word: string,
      segmentType: AudioSegmentType,
      textContent: string,
      blob: Blob,
      overrides?: AudioGenerationOverrides
    ): Promise<{ success: boolean; error?: string }> => {
      const voiceId = getVoiceId();
      const emotion = overrides?.emotion ?? getEmotion();
      const speed = overrides?.speed ?? getSpeed();
      const volume = overrides?.volume ?? 1.0;
      const statusKey = getSegmentStatusKey(word, segmentType);

      // Set status to uploading
      setBatchState((prev) => ({
        ...prev,
        currentWord: `${word} (${segmentType})`,
        statuses: new Map(prev.statuses).set(statusKey, { word: statusKey, status: 'uploading' }),
      }));

      try {
        const metadata: AudioSegmentMetadata = {
          word,
          wordNormalized: normalizeWord(word),
          segmentType,
          textContent,
          voiceId,
          emotion,
          speed,
          volume,
          storagePath: getStoragePath(word, voiceId, segmentType),
          fileSizeBytes: blob.size,
        };

        const result = await uploadSegmentAudio(metadata, blob);

        if (!result.success) {
          setBatchState((prev) => ({
            ...prev,
            statuses: new Map(prev.statuses).set(statusKey, {
              word: statusKey,
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
          statuses: new Map(prev.statuses).set(statusKey, { word: statusKey, status: 'complete' }),
        }));

        console.log(`[AdminAudio] Successfully uploaded previewed ${segmentType} for:`, word);
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[AdminAudio] Error uploading preview:', errorMessage);
        setBatchState((prev) => ({
          ...prev,
          statuses: new Map(prev.statuses).set(statusKey, {
            word: statusKey,
            status: 'error',
            error: errorMessage,
          }),
        }));
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  return {
    generateWord,
    generateSegment,
    generateAllSegments,
    generateBatch,
    generateBatchSegments,
    cancelGeneration,
    batchState,
    getWordStatus,
    getSegmentStatus,
    generatePreview,
    uploadPreviewedAudio,
  };
}
