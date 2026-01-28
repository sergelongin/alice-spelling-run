/**
 * Level Map Types
 * Progress visualization for the safari trail map
 */

// Point event reasons
export type PointReason = 'correct' | 'retry' | 'level_up' | 'mastery';

// A single point-earning event
export interface PointEvent {
  points: number;
  reason: PointReason;
  timestamp: string;
  wordId?: string;
  wordText?: string;
}

// Learning progress tracking (persisted)
export interface LearningProgress {
  totalPoints: number;
  pointsHistory: PointEvent[]; // Recent events for animations (keep last 20)
  lastUpdated: string;
}

// Default initial learning progress
export const createInitialLearningProgress = (): LearningProgress => ({
  totalPoints: 0,
  pointsHistory: [],
  lastUpdated: new Date().toISOString(),
});

// Milestone definition
export interface LevelMapMilestone {
  id: string;
  threshold: number; // Points required to unlock
  name: string;
  icon: string;
  position: { x: number; y: number }; // % position on map path
}

// Computed progress state
export interface LevelMapProgress {
  totalPoints: number;
  currentMilestoneIndex: number;
  currentMilestone: LevelMapMilestone;
  nextMilestone: LevelMapMilestone | null;
  pointsToNextMilestone: number;
  percentToNextMilestone: number;
  characterPosition: { x: number; y: number }; // Interpolated position
  isGradeComplete: boolean;
}

// Point values for different actions
export const POINT_VALUES = {
  correct: 10,      // Correct spelling (first try)
  retry: 5,         // Correct spelling (after retry)
  level_up: 15,     // Level up (0→1, 1→2, etc.)
  mastery: 50,      // Reach mastery (level 5)
} as const;
