import { GradeLevel, GRADE_WORDS } from '@/data/gradeWords';
import { CALIBRATION_CONFIG } from '@/types/calibration';
import { getWordsForGradeAsync } from '@/hooks/useWordCatalog';

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Select calibration words from a grade level (synchronous version using local files)
 * Used as fallback when async version is not available.
 */
export function selectCalibrationWords(
  grade: GradeLevel,
  count: number,
  excludeWords: Set<string> = new Set()
): string[] {
  const gradeWords = GRADE_WORDS[grade] || [];
  return selectWordsFromList(gradeWords.map(w => ({ word: w.word })), count, excludeWords);
}

/**
 * Select calibration words from a word list
 * Internal helper used by both sync and async versions.
 */
function selectWordsFromList(
  words: Array<{ word: string }>,
  count: number,
  excludeWords: Set<string>
): string[] {
  // Filter out already-used words
  const available = words.filter(wd => !excludeWords.has(wd.word.toLowerCase()));

  if (available.length === 0) {
    return [];
  }

  const { min, max } = CALIBRATION_CONFIG.preferredWordLength;

  // Prefer words of moderate length (5-8 chars) for assessment
  const preferredLength = available.filter(wd => wd.word.length >= min && wd.word.length <= max);

  // Use preferred length words if we have enough, otherwise use all available
  const source = preferredLength.length >= count ? preferredLength : available;

  // Random selection from filtered pool, return just the word strings
  return shuffleArray(source).slice(0, count).map(wd => wd.word);
}

/**
 * Select calibration words from a grade level (async version using local catalog)
 * Falls back to local files if catalog is empty.
 */
export async function selectCalibrationWordsAsync(
  grade: GradeLevel,
  count: number,
  excludeWords: Set<string> = new Set()
): Promise<string[]> {
  const words = await getWordsForGradeAsync(grade);
  return selectWordsFromList(words, count, excludeWords);
}

/**
 * Initialize calibration session with words from starting grade
 */
export function initializeCalibrationWords(
  startingGrade: GradeLevel = CALIBRATION_CONFIG.startingGrade
): { words: string[]; usedWords: Set<string> } {
  const words = selectCalibrationWords(
    startingGrade,
    CALIBRATION_CONFIG.wordsPerGradeRound
  );

  const usedWords = new Set(words.map(w => w.toLowerCase()));

  return { words, usedWords };
}

/**
 * Initialize calibration session with words from starting grade (async version)
 */
export async function initializeCalibrationWordsAsync(
  startingGrade: GradeLevel = CALIBRATION_CONFIG.startingGrade
): Promise<{ words: string[]; usedWords: Set<string> }> {
  const words = await selectCalibrationWordsAsync(
    startingGrade,
    CALIBRATION_CONFIG.wordsPerGradeRound
  );

  const usedWords = new Set(words.map(w => w.toLowerCase()));

  return { words, usedWords };
}

/**
 * Get next batch of words for calibration after grade change
 */
export function getNextCalibrationWords(
  grade: GradeLevel,
  usedWords: Set<string>
): string[] {
  return selectCalibrationWords(
    grade,
    CALIBRATION_CONFIG.wordsPerGradeRound,
    usedWords
  );
}

/**
 * Get next batch of words for calibration after grade change (async version)
 */
export async function getNextCalibrationWordsAsync(
  grade: GradeLevel,
  usedWords: Set<string>
): Promise<string[]> {
  return selectCalibrationWordsAsync(
    grade,
    CALIBRATION_CONFIG.wordsPerGradeRound,
    usedWords
  );
}

/**
 * Check if we have enough words remaining for a grade
 */
export function hasEnoughWordsForGrade(
  grade: GradeLevel,
  usedWords: Set<string>,
  minRequired: number = CALIBRATION_CONFIG.wordsPerGradeRound
): boolean {
  const gradeWords = GRADE_WORDS[grade] || [];
  const availableCount = gradeWords.filter(wd => !usedWords.has(wd.word.toLowerCase())).length;
  return availableCount >= minRequired;
}

/**
 * Check if we have enough words remaining for a grade (async version)
 */
export async function hasEnoughWordsForGradeAsync(
  grade: GradeLevel,
  usedWords: Set<string>,
  minRequired: number = CALIBRATION_CONFIG.wordsPerGradeRound
): Promise<boolean> {
  const words = await getWordsForGradeAsync(grade);
  const availableCount = words.filter(w => !usedWords.has(w.word.toLowerCase())).length;
  return availableCount >= minRequired;
}
