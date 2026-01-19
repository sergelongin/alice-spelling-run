import { GradeLevel } from '@/data/gradeWords';

// Calibration status
export type CalibrationStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

// Individual word attempt during calibration
export interface CalibrationAttempt {
  word: string;
  gradeLevel: GradeLevel;
  isCorrect: boolean;
  responseTimeMs: number;
  attemptCount: number; // How many tries before correct/giving up
}

// Grade-level performance breakdown
export interface GradeScore {
  attempted: number;
  correct: number;
  accuracy: number;
}

// Final calibration result (persisted)
export interface CalibrationResult {
  id: string;
  completedAt: string;
  status: 'completed' | 'skipped';
  recommendedGrade: GradeLevel;
  confidence: 'high' | 'medium' | 'low';
  attempts: CalibrationAttempt[];
  totalTimeMs: number;
  gradeScores: Record<GradeLevel, GradeScore>;
}

// Active calibration state during assessment
export interface CalibrationState {
  status: CalibrationStatus;
  phase: 'welcome' | 'playing' | 'results';
  currentGrade: GradeLevel;
  wordsAtCurrentGrade: number;
  correctAtCurrentGrade: number;
  totalWordsPresented: number;
  attempts: CalibrationAttempt[];
  currentWord: string;
  currentWordIndex: number;
  wordsForSession: string[];
  usedWords: Set<string>;
  startTime: number;
  wordStartTime: number;
  gradeHistory: GradeLevel[];
  currentAttemptCount: number;
  result: CalibrationResult | null;
}

// Calibration configuration constants
export const CALIBRATION_CONFIG = {
  startingGrade: 4 as GradeLevel,
  wordsPerGradeRound: 3,
  maxTotalWords: 15,
  minTotalWords: 9, // At least 3 rounds
  stabilityRoundsRequired: 2,
  moveUpThreshold: 1.0, // 100% (3/3) to move up
  moveDownThreshold: 0.34, // <34% (0-1/3) to move down
  preferredWordLength: { min: 5, max: 8 }, // Moderate length for assessment
} as const;

// Grade movement action
export type GradeMovement = 'move_up' | 'move_down' | 'stay' | 'complete';

// Result of grade calculation
export interface GradeCalculationResult {
  nextGrade: GradeLevel;
  action: GradeMovement;
  isStable: boolean;
  reason: string;
}

// Stored calibration data (localStorage)
export interface StoredCalibration {
  lastResult: CalibrationResult | null;
  hasCompletedCalibration: boolean;
  calibrationHistory: CalibrationResult[];
}

// Default stored calibration
export const DEFAULT_STORED_CALIBRATION: StoredCalibration = {
  lastResult: null,
  hasCompletedCalibration: false,
  calibrationHistory: [],
};
