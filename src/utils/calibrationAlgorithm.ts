import { GradeLevel } from '@/data/gradeWords';
import {
  CalibrationState,
  CalibrationResult,
  GradeCalculationResult,
  GradeScore,
  CALIBRATION_CONFIG,
} from '@/types/calibration';

/**
 * Calculate whether to move up, down, or stay at current grade level
 */
export function calculateNextGrade(state: CalibrationState): GradeCalculationResult {
  const {
    currentGrade,
    correctAtCurrentGrade,
    wordsAtCurrentGrade,
    gradeHistory,
    totalWordsPresented,
  } = state;

  // Check if we've tested enough words at current grade
  if (wordsAtCurrentGrade < CALIBRATION_CONFIG.wordsPerGradeRound) {
    return {
      nextGrade: currentGrade,
      action: 'stay',
      isStable: false,
      reason: 'Need more words at current grade',
    };
  }

  // Calculate accuracy at current grade
  const accuracy = wordsAtCurrentGrade > 0 ? correctAtCurrentGrade / wordsAtCurrentGrade : 0;

  // Check for stability (same grade for 2 rounds = 6 words)
  const wordsPerRound = CALIBRATION_CONFIG.wordsPerGradeRound;
  const stabilityWords = CALIBRATION_CONFIG.stabilityRoundsRequired * wordsPerRound;
  const recentHistory = gradeHistory.slice(-stabilityWords);
  const isStable =
    recentHistory.length >= stabilityWords &&
    recentHistory.every(g => g === currentGrade);

  // Check max words limit
  if (totalWordsPresented >= CALIBRATION_CONFIG.maxTotalWords) {
    return {
      nextGrade: currentGrade,
      action: 'complete',
      isStable: true,
      reason: 'Reached maximum words',
    };
  }

  // If stable at current level, complete
  if (isStable) {
    return {
      nextGrade: currentGrade,
      action: 'complete',
      isStable: true,
      reason: 'Stable at current level',
    };
  }

  // Determine movement based on accuracy
  if (accuracy >= CALIBRATION_CONFIG.moveUpThreshold && currentGrade < 6) {
    // Perfect score - move up
    return {
      nextGrade: (currentGrade + 1) as GradeLevel,
      action: 'move_up',
      isStable: false,
      reason: `Perfect score (${Math.round(accuracy * 100)}%) - moving up`,
    };
  } else if (accuracy <= CALIBRATION_CONFIG.moveDownThreshold && currentGrade > 3) {
    // Struggling - move down
    return {
      nextGrade: (currentGrade - 1) as GradeLevel,
      action: 'move_down',
      isStable: false,
      reason: `Low score (${Math.round(accuracy * 100)}%) - moving down`,
    };
  }

  // Stay at current level for more testing
  return {
    nextGrade: currentGrade,
    action: 'stay',
    isStable: false,
    reason: `Moderate score (${Math.round(accuracy * 100)}%) - continue testing`,
  };
}

/**
 * Calculate final grade placement based on all attempts
 */
export function calculateFinalPlacement(state: CalibrationState): GradeLevel {
  const { attempts } = state;

  if (attempts.length === 0) {
    return CALIBRATION_CONFIG.startingGrade;
  }

  // Calculate scores per grade
  const gradeScores: Record<GradeLevel, GradeScore> = {
    3: { attempted: 0, correct: 0, accuracy: 0 },
    4: { attempted: 0, correct: 0, accuracy: 0 },
    5: { attempted: 0, correct: 0, accuracy: 0 },
    6: { attempted: 0, correct: 0, accuracy: 0 },
  };

  for (const attempt of attempts) {
    const grade = attempt.gradeLevel;
    gradeScores[grade].attempted++;
    if (attempt.isCorrect) {
      gradeScores[grade].correct++;
    }
  }

  // Calculate accuracy for each grade
  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    const score = gradeScores[grade];
    score.accuracy = score.attempted > 0 ? score.correct / score.attempted : 0;
  }

  // Find the highest grade where the student performed well (>= 60%)
  let recommendedGrade: GradeLevel = 3;

  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    const score = gradeScores[grade];
    // Only consider grades with at least 2 attempts
    if (score.attempted >= 2 && score.accuracy >= 0.6) {
      recommendedGrade = grade;
    }
  }

  // If they aced the highest tested grade, recommend it
  // If they struggled at lowest tested grade, still recommend it (with support)
  return recommendedGrade;
}

/**
 * Calculate confidence level of the placement
 */
export function calculateConfidence(state: CalibrationState): 'high' | 'medium' | 'low' {
  const { attempts, gradeHistory } = state;

  if (attempts.length < CALIBRATION_CONFIG.minTotalWords) {
    return 'low';
  }

  // Check for grade stability
  const uniqueGrades = new Set(gradeHistory);
  if (uniqueGrades.size === 1) {
    // Never changed grade - high confidence
    return 'high';
  }

  // Check for oscillation (going back and forth between grades)
  let oscillations = 0;
  for (let i = 2; i < gradeHistory.length; i++) {
    if (gradeHistory[i] === gradeHistory[i - 2] && gradeHistory[i] !== gradeHistory[i - 1]) {
      oscillations++;
    }
  }

  if (oscillations > 2) {
    return 'low';
  }

  if (uniqueGrades.size <= 2) {
    return 'medium';
  }

  return 'low';
}

/**
 * Build the final calibration result
 */
export function buildCalibrationResult(state: CalibrationState): CalibrationResult {
  const recommendedGrade = calculateFinalPlacement(state);
  const confidence = calculateConfidence(state);

  // Calculate grade scores
  const gradeScores: Record<GradeLevel, GradeScore> = {
    3: { attempted: 0, correct: 0, accuracy: 0 },
    4: { attempted: 0, correct: 0, accuracy: 0 },
    5: { attempted: 0, correct: 0, accuracy: 0 },
    6: { attempted: 0, correct: 0, accuracy: 0 },
  };

  for (const attempt of state.attempts) {
    const grade = attempt.gradeLevel;
    gradeScores[grade].attempted++;
    if (attempt.isCorrect) {
      gradeScores[grade].correct++;
    }
  }

  for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
    const score = gradeScores[grade];
    score.accuracy = score.attempted > 0 ? score.correct / score.attempted : 0;
  }

  return {
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
    status: 'completed',
    recommendedGrade,
    confidence,
    attempts: state.attempts,
    totalTimeMs: Date.now() - state.startTime,
    gradeScores,
  };
}

/**
 * Build a skipped calibration result
 */
export function buildSkippedResult(selectedGrade: GradeLevel): CalibrationResult {
  return {
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
    status: 'skipped',
    recommendedGrade: selectedGrade,
    confidence: 'low',
    attempts: [],
    totalTimeMs: 0,
    gradeScores: {
      3: { attempted: 0, correct: 0, accuracy: 0 },
      4: { attempted: 0, correct: 0, accuracy: 0 },
      5: { attempted: 0, correct: 0, accuracy: 0 },
      6: { attempted: 0, correct: 0, accuracy: 0 },
    },
  };
}

/**
 * Check if calibration should end
 */
export function shouldEndCalibration(state: CalibrationState): boolean {
  const { totalWordsPresented, gradeHistory } = state;

  // End if max words reached
  if (totalWordsPresented >= CALIBRATION_CONFIG.maxTotalWords) {
    return true;
  }

  // End if stable for 2 rounds (6 words at same grade)
  const wordsPerRound = CALIBRATION_CONFIG.wordsPerGradeRound;
  const stabilityWords = CALIBRATION_CONFIG.stabilityRoundsRequired * wordsPerRound;

  if (gradeHistory.length >= stabilityWords) {
    const recentHistory = gradeHistory.slice(-stabilityWords);
    const isStable = recentHistory.every(g => g === recentHistory[0]);
    if (isStable) {
      return true;
    }
  }

  // End if hit ceiling (grade 6) or floor (grade 3) and stable for 1 round
  const currentGrade = state.currentGrade;
  if (currentGrade === 3 || currentGrade === 6) {
    const recentHistory = gradeHistory.slice(-wordsPerRound);
    if (recentHistory.length >= wordsPerRound && recentHistory.every(g => g === currentGrade)) {
      return true;
    }
  }

  return false;
}
