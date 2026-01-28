import { ErrorPattern } from '@/types';

/**
 * Error Pattern Analysis Module
 *
 * Analyzes spelling mistakes to categorize them by common error types.
 * This helps kids understand WHY they made mistakes, not just that they did.
 *
 * Based on research showing pattern-based instruction is more effective
 * than memorizing individual words.
 */

// Common vowel combinations that get swapped
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Common silent letter combinations
const SILENT_PATTERNS: Record<string, string[]> = {
  'k': ['kn'],      // knife, know, knight
  'w': ['wr'],      // write, wrong, wrist
  'g': ['gn'],      // gnome, gnat, sign
  'b': ['mb', 'bt'], // thumb, doubt, subtle
  'h': ['gh', 'rh'], // ghost, rhythm
  'p': ['ps'],      // psalm, psychology
  't': ['tch'],     // watch, catch (t is silent in tch)
};

// Common phonetic substitutions (sounds right, spelled wrong)
const PHONETIC_PAIRS: [string, string][] = [
  ['f', 'ph'],      // enuff → enough
  ['f', 'gh'],      // coff → cough
  ['k', 'c'],       // kut → cut
  ['k', 'ck'],      // bak → back
  ['s', 'c'],       // ise → ice
  ['z', 's'],       // haz → has
  ['j', 'g'],       // jiant → giant
  ['sh', 'ti'],     // nashun → nation
  ['sh', 'ci'],     // speshul → special
];

// Common prefix mistakes
const PREFIXES = ['un', 'dis', 'mis', 're', 'pre', 'non', 'over', 'under'];

/**
 * Analyze a spelling mistake and return detected error patterns
 */
export function analyzeError(attempt: string, correct: string): ErrorPattern[] {
  const patterns: ErrorPattern[] = [];
  const attemptLower = attempt.toLowerCase();
  const correctLower = correct.toLowerCase();

  // Skip if they're the same (not an error)
  if (attemptLower === correctLower) return [];

  // Check for each pattern type
  if (hasVowelSwap(attemptLower, correctLower)) {
    patterns.push('vowel-swap');
  }

  if (hasDoubleLetterError(attemptLower, correctLower)) {
    patterns.push('double-letter');
  }

  if (hasSilentLetterError(attemptLower, correctLower)) {
    patterns.push('silent-letter');
  }

  if (hasPhoneticError(attemptLower, correctLower)) {
    patterns.push('phonetic');
  }

  if (hasSuffixError(attemptLower, correctLower)) {
    patterns.push('suffix');
  }

  if (hasPrefixError(attemptLower, correctLower)) {
    patterns.push('prefix');
  }

  if (hasMissingLetter(attemptLower, correctLower)) {
    patterns.push('missing-letter');
  }

  if (hasExtraLetter(attemptLower, correctLower)) {
    patterns.push('extra-letter');
  }

  if (hasTransposition(attemptLower, correctLower)) {
    patterns.push('transposition');
  }

  return patterns;
}

/**
 * Check if swapping two adjacent vowels would fix the mistake
 * Example: "recieve" → "receive" (swapped i and e)
 */
function hasVowelSwap(attempt: string, correct: string): boolean {
  if (attempt.length !== correct.length) return false;

  let differences = 0;
  const swapPositions: number[] = [];

  for (let i = 0; i < correct.length; i++) {
    if (attempt[i] !== correct[i]) {
      differences++;
      swapPositions.push(i);
    }
  }

  // Check if exactly 2 adjacent positions differ and are vowels swapped
  if (differences === 2 && swapPositions.length === 2) {
    const [pos1, pos2] = swapPositions;
    if (Math.abs(pos1 - pos2) <= 2) { // Adjacent or near-adjacent
      const bothVowels = VOWELS.includes(attempt[pos1]) &&
                        VOWELS.includes(attempt[pos2]) &&
                        VOWELS.includes(correct[pos1]) &&
                        VOWELS.includes(correct[pos2]);
      if (bothVowels && attempt[pos1] === correct[pos2] && attempt[pos2] === correct[pos1]) {
        return true;
      }
    }
  }

  // Also check common ie/ei pattern
  if (attempt.includes('ie') && correct.includes('ei')) return true;
  if (attempt.includes('ei') && correct.includes('ie')) return true;

  return false;
}

/**
 * Check for double letter errors
 * Example: "begining" → "beginning" (missing double n)
 * Example: "occured" → "occurred" (missing double r)
 */
function hasDoubleLetterError(attempt: string, correct: string): boolean {
  // Find double letters in correct word
  const correctDoubles: string[] = [];
  for (let i = 0; i < correct.length - 1; i++) {
    if (correct[i] === correct[i + 1] && /[a-z]/.test(correct[i])) {
      correctDoubles.push(correct[i]);
    }
  }

  // Find double letters in attempt
  const attemptDoubles: string[] = [];
  for (let i = 0; i < attempt.length - 1; i++) {
    if (attempt[i] === attempt[i + 1] && /[a-z]/.test(attempt[i])) {
      attemptDoubles.push(attempt[i]);
    }
  }

  // Check if they differ in double letters
  if (correctDoubles.length !== attemptDoubles.length) return true;

  // Check if same letter should be doubled
  for (const letter of correctDoubles) {
    if (!attemptDoubles.includes(letter)) return true;
  }

  return false;
}

/**
 * Check for silent letter errors
 * Example: "nife" → "knife" (missing silent k)
 * Example: "rong" → "wrong" (missing silent w)
 */
function hasSilentLetterError(attempt: string, correct: string): boolean {
  // Check if correct word has a silent letter pattern that's missing from attempt
  for (const [silent, patterns] of Object.entries(SILENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (correct.includes(pattern)) {
        // Check if attempt is missing the silent part
        const withoutSilent = pattern.replace(silent, '');
        if (attempt.includes(withoutSilent) && !attempt.includes(pattern)) {
          return true;
        }
      }
    }
  }

  // Check for common silent e at end
  if (correct.endsWith('e') && !attempt.endsWith('e') &&
      attempt.length === correct.length - 1) {
    return true;
  }

  return false;
}

/**
 * Check for phonetic spelling errors
 * Example: "enuff" → "enough" (sounds right but spelled wrong)
 */
function hasPhoneticError(attempt: string, correct: string): boolean {
  for (const [phoneticSpelling, correctSpelling] of PHONETIC_PAIRS) {
    // Check if attempt uses phonetic version where correct uses standard
    if (attempt.includes(phoneticSpelling) && correct.includes(correctSpelling)) {
      const fixed = attempt.replace(phoneticSpelling, correctSpelling);
      if (fixed === correct || levenshteinDistance(fixed, correct) < levenshteinDistance(attempt, correct)) {
        return true;
      }
    }
    // Check reverse too
    if (attempt.includes(correctSpelling) && correct.includes(phoneticSpelling)) {
      const fixed = attempt.replace(correctSpelling, phoneticSpelling);
      if (fixed === correct || levenshteinDistance(fixed, correct) < levenshteinDistance(attempt, correct)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for suffix-related errors
 * Example: "hapyness" → "happiness" (y→i rule)
 * Example: "runing" → "running" (doubling rule)
 */
function hasSuffixError(attempt: string, correct: string): boolean {
  const commonSuffixes = ['ing', 'ed', 'er', 'est', 'ly', 'ness', 'ful', 'less', 'ment', 'tion', 'sion'];

  for (const suffix of commonSuffixes) {
    if (correct.endsWith(suffix) && attempt.endsWith(suffix)) {
      const correctBase = correct.slice(0, -suffix.length);
      const attemptBase = attempt.slice(0, -suffix.length);

      // Check for y→i transformation
      if (attemptBase.endsWith('y') && correctBase.endsWith('i')) {
        return true;
      }

      // Check for missing doubled consonant
      if (correctBase.length > attemptBase.length) {
        const lastCorrect = correctBase.slice(-2);
        if (lastCorrect[0] === lastCorrect[1]) {
          return true; // Missing double consonant before suffix
        }
      }

      // Check for missing dropped e
      if (attemptBase.endsWith('e') && !correctBase.endsWith('e')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check for prefix-related errors
 * Example: "unessary" → "unnecessary" (missing n in un-)
 */
function hasPrefixError(attempt: string, correct: string): boolean {
  for (const prefix of PREFIXES) {
    if (correct.startsWith(prefix)) {
      // Check if attempt is missing part of the prefix
      for (let i = 1; i < prefix.length; i++) {
        const partialPrefix = prefix.slice(0, i);
        if (attempt.startsWith(partialPrefix) && !attempt.startsWith(prefix)) {
          return true;
        }
      }

      // Check for double letter at prefix boundary (unnecessary has nn)
      const afterPrefix = correct[prefix.length];
      if (prefix.endsWith(afterPrefix)) {
        // prefix ends with same letter that follows it
        if (!attempt.includes(prefix[prefix.length - 1] + afterPrefix)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if attempt is missing a letter
 * Example: "diferent" → "different"
 */
function hasMissingLetter(attempt: string, correct: string): boolean {
  if (attempt.length !== correct.length - 1) return false;

  // Check if removing one letter from correct equals attempt
  for (let i = 0; i < correct.length; i++) {
    const withoutChar = correct.slice(0, i) + correct.slice(i + 1);
    if (withoutChar === attempt) return true;
  }

  return false;
}

/**
 * Check if attempt has an extra letter
 * Example: "tomorroww" → "tomorrow"
 */
function hasExtraLetter(attempt: string, correct: string): boolean {
  if (attempt.length !== correct.length + 1) return false;

  // Check if removing one letter from attempt equals correct
  for (let i = 0; i < attempt.length; i++) {
    const withoutChar = attempt.slice(0, i) + attempt.slice(i + 1);
    if (withoutChar === correct) return true;
  }

  return false;
}

/**
 * Check for letter transposition
 * Example: "freind" → "friend" (swapped i and e)
 * Example: "teh" → "the"
 */
function hasTransposition(attempt: string, correct: string): boolean {
  if (attempt.length !== correct.length) return false;

  // Count differences
  const diffs: number[] = [];
  for (let i = 0; i < correct.length; i++) {
    if (attempt[i] !== correct[i]) {
      diffs.push(i);
    }
  }

  // Exactly 2 adjacent differences that are swapped
  if (diffs.length === 2 && diffs[1] - diffs[0] === 1) {
    const [i, j] = diffs;
    if (attempt[i] === correct[j] && attempt[j] === correct[i]) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Get a human-readable description of an error pattern
 */
export function getPatternDescription(pattern: ErrorPattern): string {
  const descriptions: Record<ErrorPattern, string> = {
    'vowel-swap': 'Vowels in wrong order (like "ie" vs "ei")',
    'double-letter': 'Missing or extra double letters',
    'silent-letter': 'Missing silent letters (like the "k" in "knife")',
    'phonetic': 'Spelled how it sounds, but not correct',
    'suffix': 'Word ending rules (-ing, -ed, -ness)',
    'prefix': 'Word beginning rules (un-, dis-, re-)',
    'missing-letter': 'Left out a letter',
    'extra-letter': 'Added an extra letter',
    'transposition': 'Letters in wrong order',
  };

  return descriptions[pattern];
}

/**
 * Get a friendly name for an error pattern
 */
export function getPatternName(pattern: ErrorPattern): string {
  const names: Record<ErrorPattern, string> = {
    'vowel-swap': 'Vowel Order',
    'double-letter': 'Double Letters',
    'silent-letter': 'Silent Letters',
    'phonetic': 'Sound vs Spelling',
    'suffix': 'Word Endings',
    'prefix': 'Word Beginnings',
    'missing-letter': 'Missing Letters',
    'extra-letter': 'Extra Letters',
    'transposition': 'Swapped Letters',
  };

  return names[pattern];
}

/**
 * Get an encouraging hint for a pattern they're working on
 */
export function getPatternHint(pattern: ErrorPattern, word: string): string {
  const hints: Record<ErrorPattern, string> = {
    'vowel-swap': `Remember: "I before E, except after C" - but there are exceptions! Check the vowels in "${word}".`,
    'double-letter': `This word has a tricky double letter. Say it slowly and listen for where the sound holds longer.`,
    'silent-letter': `"${word}" has a sneaky silent letter! Some letters hide but are important for spelling.`,
    'phonetic': `This word doesn't spell the way it sounds. English borrowed it from another language!`,
    'suffix': `When adding an ending to "${word}", remember the base word might change its spelling.`,
    'prefix': `Watch where the prefix connects to the rest of the word - sometimes letters double up!`,
    'missing-letter': `Take another look - "${word}" has all its letters. Check each one carefully.`,
    'extra-letter': `Hmm, there might be one too many letters. Say the word slowly and count the sounds.`,
    'transposition': `The letters are almost right, but two got switched around. Check the order!`,
  };

  return hints[pattern];
}
