import { GradeLevel, GRADE_WORDS } from '@/data/gradeWords';
import { CALIBRATION_CONFIG } from '@/types/calibration';

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
 * Select calibration words from a grade level
 * Criteria:
 * - Moderate length (5-8 characters preferred for assessment)
 * - Representative of grade's focus areas
 * - Not already used in this calibration session
 */
export function selectCalibrationWords(
  grade: GradeLevel,
  count: number,
  excludeWords: Set<string> = new Set()
): string[] {
  const gradeWords = GRADE_WORDS[grade] || [];

  // Filter out already-used words (use .word property from WordDefinition)
  const available = gradeWords.filter(wd => !excludeWords.has(wd.word.toLowerCase()));

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
