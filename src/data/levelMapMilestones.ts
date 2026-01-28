import { LevelMapMilestone } from '@/types/levelMap';

/**
 * Milestone definitions for the Level Map
 *
 * Psychology-driven progression (per Duolingo/Khan Academy research):
 * - First session: Child hits 2-3 milestones (20, 50, possibly 100 points)
 * - "Easy win-states in onboarding" - Khan Academy's principle
 * - Every correct answer moves progress - no waiting for mastery
 * - Level-ups and mastery give bonus points - rewards long-term engagement
 * - Gaps widen as habit forms: 20 → 30 → 50 → 100 → 200 → 300 → 300 → 500 → 500 → 750
 */

export const LEVEL_MAP_MILESTONES: LevelMapMilestone[] = [
  {
    id: 'base-camp',
    threshold: 0,
    name: 'Base Camp',
    icon: '🏕️',
    position: { x: 10, y: 90 }, // Bottom-left start
  },
  {
    id: 'first-steps',
    threshold: 20,
    name: 'First Steps',
    icon: '⭐',
    position: { x: 18, y: 82 },
  },
  {
    id: 'getting-started',
    threshold: 50,
    name: 'Getting Started',
    icon: '👣',
    position: { x: 30, y: 75 },
  },
  {
    id: 'on-your-way',
    threshold: 100,
    name: 'On Your Way',
    icon: '🌱',
    position: { x: 42, y: 68 },
  },
  {
    id: 'explorer',
    threshold: 200,
    name: 'Explorer',
    icon: '🌿',
    position: { x: 55, y: 60 },
  },
  {
    id: 'trailblazer',
    threshold: 400,
    name: 'Trailblazer',
    icon: '🦎',
    position: { x: 45, y: 50 },
  },
  {
    id: 'pathfinder',
    threshold: 700,
    name: 'Pathfinder',
    icon: '🌴',
    position: { x: 35, y: 42 },
  },
  {
    id: 'halfway-hero',
    threshold: 1000,
    name: 'Halfway Hero',
    icon: '🦁',
    position: { x: 50, y: 35 },
  },
  {
    id: 'journey-champion',
    threshold: 1500,
    name: 'Journey Champion',
    icon: '💧',
    position: { x: 65, y: 28 },
  },
  {
    id: 'century-club',
    threshold: 2000,
    name: 'Century Club',
    icon: '🏔️',
    position: { x: 75, y: 22 },
  },
  {
    id: 'almost-there',
    threshold: 2750,
    name: 'Almost There',
    icon: '🦅',
    position: { x: 85, y: 15 },
  },
  {
    id: 'grade-master',
    threshold: 3500,
    name: 'Grade Master',
    icon: '🏁',
    position: { x: 90, y: 8 }, // Top-right finish
  },
];

/**
 * Get the milestone index for a given point total
 */
export function getMilestoneIndexForPoints(points: number): number {
  let index = 0;
  for (let i = LEVEL_MAP_MILESTONES.length - 1; i >= 0; i--) {
    if (points >= LEVEL_MAP_MILESTONES[i].threshold) {
      index = i;
      break;
    }
  }
  return index;
}

/**
 * Get the next milestone after a given point total, or null if at max
 */
export function getNextMilestone(points: number): LevelMapMilestone | null {
  const currentIndex = getMilestoneIndexForPoints(points);
  if (currentIndex >= LEVEL_MAP_MILESTONES.length - 1) {
    return null;
  }
  return LEVEL_MAP_MILESTONES[currentIndex + 1];
}
