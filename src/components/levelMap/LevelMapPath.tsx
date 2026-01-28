import { LEVEL_MAP_MILESTONES } from '@/data/levelMapMilestones';

interface LevelMapPathProps {
  currentMilestoneIndex: number;
  percentToNext: number;
}

/**
 * SVG winding path for the level map
 * Path goes from bottom-left to top-right with curves
 */
export function LevelMapPath({ currentMilestoneIndex, percentToNext }: LevelMapPathProps) {
  // Generate path points from milestone positions
  const milestones = LEVEL_MAP_MILESTONES;

  // Create a smooth path through all milestones
  const pathD = createPathThroughPoints(milestones.map(m => m.position));

  // Calculate how much of the path should be "walked" (filled)
  // This is approximate based on milestone index
  const totalSegments = milestones.length - 1;
  const walkedSegments = currentMilestoneIndex + (percentToNext / 100);
  const walkedPercentage = Math.min(100, (walkedSegments / totalSegments) * 100);

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ pointerEvents: 'none' }}
    >
      {/* Main path (unwalkd - dusty trail) */}
      <path
        d={pathD}
        fill="none"
        stroke="#d4a574"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />

      {/* Walked path (golden/highlighted) */}
      <path
        d={pathD}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1000"
        strokeDashoffset={1000 - (walkedPercentage * 10)}
        className="transition-all duration-700"
      />

      {/* Path border for depth */}
      <path
        d={pathD}
        fill="none"
        stroke="#8b6914"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        style={{ zIndex: -1 }}
      />
    </svg>
  );
}

/**
 * Create a smooth SVG path through a series of points
 */
function createPathThroughPoints(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Use quadratic bezier curves for smooth path
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;

    // Add some variation to make it look like a winding trail
    const controlOffset = (i % 2 === 0 ? 1 : -1) * 8;

    d += ` Q ${midX + controlOffset} ${midY} ${curr.x} ${curr.y}`;
  }

  return d;
}
