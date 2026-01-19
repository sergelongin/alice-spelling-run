// Types for spelling hints and feedback

export type AIProvider = 'openai' | 'anthropic' | 'groq';

export interface SpellingHintRequest {
  targetWord: string;
  guess: string;
  previousAttempts: string[];
}

export interface SpellingHintResponse {
  hint: string;
  provider: AIProvider;
  cached?: boolean;
}

export interface SpellingHintState {
  hint: string | null;
  isLoading: boolean;
  error: string | null;
  attemptCount: number;
}

// Default fallback hints when API fails
export const FALLBACK_HINTS = [
  "Keep trying! You're doing great!",
  "Take your time and listen to the word again.",
  "Sound it out slowly - you've got this!",
  "You're making progress! Try again.",
  "Every attempt helps you learn. Keep going!",
];

export function getRandomFallbackHint(): string {
  return FALLBACK_HINTS[Math.floor(Math.random() * FALLBACK_HINTS.length)];
}
