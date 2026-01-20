import type { AudioPronunciation } from './database';

export type { AudioPronunciation };

export interface AudioVoiceConfig {
  voiceId: string;
  emotion: string;
  speed: number;
}

export interface AudioCacheEntry {
  word: string;
  voiceId: string;
  blobUrl: string;
  storagePath: string;
  cachedAt: number; // timestamp
  expiresAt: number; // timestamp
}

export interface AudioGenerationStatus {
  word: string;
  status: 'pending' | 'generating' | 'uploading' | 'complete' | 'error';
  error?: string;
  progress?: number;
}

export interface BatchGenerationState {
  isGenerating: boolean;
  totalWords: number;
  completedWords: number;
  failedWords: string[];
  currentWord: string | null;
  statuses: Map<string, AudioGenerationStatus>;
}

export interface AudioStorageMetadata {
  word: string;
  wordNormalized: string;
  voiceId: string;
  emotion: string;
  speed: number;
  storagePath: string;
  fileSizeBytes?: number;
  durationMs?: number;
}

/**
 * Result from checking if audio exists in Supabase
 */
export interface AudioAvailability {
  exists: boolean;
  pronunciation?: AudioPronunciation;
  publicUrl?: string;
}

/**
 * Grade filter for admin audio page
 */
export type GradeFilter = 3 | 4 | 5 | 6 | 'all';

/**
 * Word with audio status for admin display
 */
export interface WordAudioStatus {
  word: string;
  grade: number;
  hasAudio: boolean;
  pronunciation?: AudioPronunciation;
}
