import {
  LearningProgress,
  LevelMapProgress,
  PointEvent,
  PointReason,
  POINT_VALUES,
  createInitialLearningProgress,
} from '@/types/levelMap';
import {
  LEVEL_MAP_MILESTONES,
  getMilestoneIndexForPoints,
} from '@/data/levelMapMilestones';

/**
 * Calculate the complete level map progress state from learning progress
 */
export function calculateLevelMapProgress(
  learningProgress: LearningProgress | undefined
): LevelMapProgress {
  const totalPoints = learningProgress?.totalPoints ?? 0;
  const currentIndex = getMilestoneIndexForPoints(totalPoints);
  const currentMilestone = LEVEL_MAP_MILESTONES[currentIndex];
  const nextMilestone = LEVEL_MAP_MILESTONES[currentIndex + 1] ?? null;

  const isGradeComplete = currentIndex >= LEVEL_MAP_MILESTONES.length - 1;

  // Calculate points to next milestone
  const pointsToNextMilestone = nextMilestone
    ? nextMilestone.threshold - totalPoints
    : 0;

  // Calculate percentage progress between current and next milestone
  let percentToNextMilestone = 100;
  if (nextMilestone) {
    const segmentSize = nextMilestone.threshold - currentMilestone.threshold;
    const progressInSegment = totalPoints - currentMilestone.threshold;
    percentToNextMilestone = Math.min(100, (progressInSegment / segmentSize) * 100);
  }

  // Interpolate character position between milestones
  const characterPosition = interpolatePosition(
    currentMilestone.position,
    nextMilestone?.position ?? currentMilestone.position,
    percentToNextMilestone / 100
  );

  return {
    totalPoints,
    currentMilestoneIndex: currentIndex,
    currentMilestone,
    nextMilestone,
    pointsToNextMilestone,
    percentToNextMilestone,
    characterPosition,
    isGradeComplete,
  };
}

/**
 * Linearly interpolate between two positions
 */
function interpolatePosition(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/**
 * Create a point event
 */
export function createPointEvent(
  reason: PointReason,
  wordId?: string,
  wordText?: string
): PointEvent {
  return {
    points: POINT_VALUES[reason],
    reason,
    timestamp: new Date().toISOString(),
    wordId,
    wordText,
  };
}

/**
 * Add points to learning progress
 */
export function addPointsToProgress(
  progress: LearningProgress | undefined,
  events: PointEvent[]
): LearningProgress {
  const current = progress ?? createInitialLearningProgress();
  const totalNewPoints = events.reduce((sum, e) => sum + e.points, 0);

  return {
    totalPoints: current.totalPoints + totalNewPoints,
    pointsHistory: [...events, ...current.pointsHistory].slice(0, 20),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate points earned in a game session
 * Returns array of point events for the session
 */
export function calculateSessionPoints(
  completedWords: { word: string; attempts: number }[],
  levelUps: { wordText: string; oldLevel: number; newLevel: number }[],
  newMasteries: { wordText: string }[]
): PointEvent[] {
  const events: PointEvent[] = [];

  // Points for correct spellings
  for (const completed of completedWords) {
    const isFirstTry = completed.attempts === 1;
    events.push(
      createPointEvent(
        isFirstTry ? 'correct' : 'retry',
        undefined,
        completed.word
      )
    );
  }

  // Bonus points for level-ups
  for (const levelUp of levelUps) {
    events.push(
      createPointEvent('level_up', undefined, levelUp.wordText)
    );
  }

  // Bonus points for reaching mastery
  for (const mastery of newMasteries) {
    events.push(
      createPointEvent('mastery', undefined, mastery.wordText)
    );
  }

  return events;
}

/**
 * Get a user-friendly message about progress to next milestone
 */
export function getProgressMessage(progress: LevelMapProgress): string {
  if (progress.isGradeComplete) {
    return `You're a ${progress.currentMilestone.name}! Amazing work!`;
  }

  const { pointsToNextMilestone, nextMilestone } = progress;
  if (!nextMilestone) {
    return 'Keep practicing!';
  }

  if (pointsToNextMilestone <= 10) {
    return `Almost at ${nextMilestone.name}!`;
  }

  if (pointsToNextMilestone <= 30) {
    return `So close to ${nextMilestone.name}!`;
  }

  return `${pointsToNextMilestone} points to ${nextMilestone.name}`;
}

/**
 * Check if a milestone was just unlocked
 */
export function checkNewMilestone(
  oldPoints: number,
  newPoints: number
): { unlocked: boolean; milestone: typeof LEVEL_MAP_MILESTONES[0] | null } {
  const oldIndex = getMilestoneIndexForPoints(oldPoints);
  const newIndex = getMilestoneIndexForPoints(newPoints);

  if (newIndex > oldIndex) {
    return {
      unlocked: true,
      milestone: LEVEL_MAP_MILESTONES[newIndex],
    };
  }

  return { unlocked: false, milestone: null };
}
