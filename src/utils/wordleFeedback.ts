import { LetterFeedback, LetterFeedbackResult } from '@/types';

/**
 * Compute Wordle-style feedback for a guess against a target word.
 *
 * Rules (matching official Wordle logic):
 * 1. First pass: Mark exact matches as 'correct' (green)
 * 2. Second pass: For non-exact matches, check if letter exists elsewhere
 *    - 'present' (yellow) if letter is in target but wrong position
 *    - 'absent' (gray) if letter is not in target
 * 3. Handle duplicate letters correctly: only mark as many 'present' as
 *    there are remaining unmatched letters in target
 */
export function computeWordleFeedback(
  guess: string,
  target: string
): LetterFeedbackResult[] {
  const guessLower = guess.toLowerCase();
  const targetLower = target.toLowerCase();

  const results: LetterFeedbackResult[] = [];
  const targetLetterCounts = new Map<string, number>();

  // Count letters in target
  for (const letter of targetLower) {
    targetLetterCounts.set(letter, (targetLetterCounts.get(letter) || 0) + 1);
  }

  // First pass: find exact matches (correct position)
  const exactMatches = new Set<number>();
  for (let i = 0; i < guessLower.length; i++) {
    const guessLetter = guessLower[i];
    if (i < targetLower.length && guessLetter === targetLower[i]) {
      exactMatches.add(i);
      // Reduce available count for this letter
      targetLetterCounts.set(guessLetter, (targetLetterCounts.get(guessLetter) || 1) - 1);
    }
  }

  // Second pass: determine feedback for each letter
  for (let i = 0; i < guessLower.length; i++) {
    const guessLetter = guessLower[i];

    if (exactMatches.has(i)) {
      // Exact match
      results.push({ letter: guess[i], feedback: 'correct' });
    } else {
      // Check if letter exists elsewhere in target (with remaining count)
      const remainingCount = targetLetterCounts.get(guessLetter) || 0;
      if (remainingCount > 0) {
        results.push({ letter: guess[i], feedback: 'present' });
        targetLetterCounts.set(guessLetter, remainingCount - 1);
      } else {
        results.push({ letter: guess[i], feedback: 'absent' });
      }
    }
  }

  return results;
}

/**
 * Get CSS classes for a letter feedback state
 */
export function getFeedbackColorClasses(feedback: LetterFeedback): string {
  switch (feedback) {
    case 'correct':
      return 'bg-green-500 text-white border-green-600';
    case 'present':
      return 'bg-yellow-500 text-white border-yellow-600';
    case 'absent':
      return 'bg-gray-400 text-white border-gray-500';
    case 'empty':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Check if all letters in a guess are correct
 */
export function isGuessCorrect(feedback: LetterFeedbackResult[]): boolean {
  return feedback.every(f => f.feedback === 'correct');
}

/**
 * Get indices of incorrect letters (for backward compatibility with simple feedback)
 */
export function getIncorrectIndices(guess: string, target: string): number[] {
  const incorrect: number[] = [];
  const guessLower = guess.toLowerCase();
  const targetLower = target.toLowerCase();

  for (let i = 0; i < guessLower.length && i < targetLower.length; i++) {
    if (guessLower[i] !== targetLower[i]) {
      incorrect.push(i);
    }
  }

  return incorrect;
}
