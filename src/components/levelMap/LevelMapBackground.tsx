import { useMemo } from 'react';
import { useGameContext } from '@/context/GameContextDB';
import { LEVEL_MAP_MILESTONES } from '@/data/levelMapMilestones';
import { calculateLevelMapProgress } from '@/utils/levelMapUtils';
import { LevelMapPath } from './LevelMapPath';
import { LevelMapNode } from './LevelMapNode';
import { LevelMapCharacter } from './LevelMapCharacter';
import { LevelMapProgress } from '@/types/levelMap';

interface LevelMapBackgroundProps {
  children?: React.ReactNode;
}

/**
 * Calculate viewport transform to center on character position
 * Keeps character in the "safe zone" (bottom 40% of viewport, not under cards)
 */
function getViewportTransform(progress: LevelMapProgress) {
  const { characterPosition, percentToNextMilestone } = progress;

  // Center the view on character, offset so character appears in bottom 40%
  // The map is 100x100, we want to translate so character is at ~65% from top
  const translateX = 50 - characterPosition.x;
  const translateY = 65 - characterPosition.y; // Push character to bottom 35%

  // Dynamic zoom: closer to milestone = more zoom (creates anticipation)
  // At 0% progress: scale 0.85 (zoomed out, see more path)
  // At 100% progress: scale 1.1 (zoomed in for excitement)
  const zoomFactor = 0.85 + (percentToNextMilestone / 100) * 0.25;

  return {
    transform: `translate(${translateX}%, ${translateY}%) scale(${zoomFactor})`,
    transformOrigin: `${characterPosition.x}% ${characterPosition.y}%`,
  };
}

/**
 * Safari trail level map background that replaces HomeBackground
 * Shows progress visualization with winding path, milestones, and character
 *
 * Responsive behavior:
 * - Desktop/iPad: Full opacity, crisp details
 * - Mobile: Reduced opacity (50%), background to cards
 *
 * Auto-scrolling viewport:
 * - Viewport centers on character position (always visible)
 * - Completed milestones scroll "behind" and fade out
 * - Dynamic zoom: zoom out when far from milestone, zoom in when approaching
 */
export function LevelMapBackground({ children }: LevelMapBackgroundProps) {
  const { learningProgress } = useGameContext();

  const progress = useMemo(
    () => calculateLevelMapProgress(learningProgress),
    [learningProgress]
  );

  const viewportTransform = useMemo(
    () => getViewportTransform(progress),
    [progress]
  );

  const getNodeState = (index: number) => {
    if (index < progress.currentMilestoneIndex) return 'unlocked';
    if (index === progress.currentMilestoneIndex) return 'current';
    if (index === progress.currentMilestoneIndex + 1) return 'next';
    return 'locked';
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Safari sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-amber-100 to-amber-200" />

      {/* Map viewport container - clips the transformable content */}
      <div className="absolute inset-0 overflow-hidden opacity-100 md:opacity-100 max-md:opacity-50 transition-opacity">
        {/* Transformable map content - centers on character */}
        <div
          className="absolute inset-0 viewport-pan"
          style={viewportTransform}
        >
          {/* Decorative savannah elements */}
          <SavannahDecorations />

          {/* The winding trail path */}
          <LevelMapPath
            currentMilestoneIndex={progress.currentMilestoneIndex}
            percentToNext={progress.percentToNextMilestone}
          />

          {/* Milestone nodes */}
          {LEVEL_MAP_MILESTONES.map((milestone, index) => (
            <LevelMapNode
              key={milestone.id}
              milestone={milestone}
              state={getNodeState(index)}
              index={index}
              currentMilestoneIndex={progress.currentMilestoneIndex}
            />
          ))}

          {/* Player character */}
          <LevelMapCharacter position={progress.characterPosition} />
        </div>
      </div>

      {/* Sun (same as original HomeBackground) */}
      <div className="absolute top-6 right-8 md:top-8 md:right-12 w-16 h-16 md:w-20 md:h-20 pointer-events-none opacity-80">
        <div className="absolute inset-0 bg-yellow-200 rounded-full blur-xl opacity-60" />
        <div className="absolute inset-2 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full shadow-lg">
          <div className="absolute inset-2 bg-yellow-100 rounded-full opacity-60" />
        </div>
      </div>

      {/* Ground layer */}
      <div className="absolute bottom-0 left-0 right-0 h-20 md:h-24 bg-gradient-to-t from-amber-700 via-amber-600 to-amber-500 opacity-80" />

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Decorative savannah elements: trees, rocks, grass, watering hole
 */
function SavannahDecorations() {
  return (
    <>
      {/* Acacia trees */}
      <AcaciaTree style={{ left: '5%', top: '30%' }} size="large" />
      <AcaciaTree style={{ left: '85%', top: '45%' }} size="medium" />
      <AcaciaTree style={{ left: '15%', top: '60%' }} size="small" />
      <AcaciaTree style={{ left: '75%', top: '70%' }} size="medium" />
      <AcaciaTree style={{ left: '92%', top: '25%' }} size="small" />

      {/* Rocks */}
      <Rock style={{ left: '25%', top: '85%' }} />
      <Rock style={{ left: '70%', top: '80%' }} />
      <Rock style={{ left: '40%', top: '92%' }} />

      {/* Grass tufts */}
      <GrassTuft style={{ left: '12%', top: '75%' }} />
      <GrassTuft style={{ left: '60%', top: '65%' }} />
      <GrassTuft style={{ left: '33%', top: '55%' }} />
      <GrassTuft style={{ left: '80%', top: '55%' }} />
      <GrassTuft style={{ left: '48%', top: '45%' }} />

      {/* Watering hole */}
      <WateringHole style={{ left: '60%', top: '75%' }} />
    </>
  );
}

interface DecorationProps {
  style: React.CSSProperties;
  size?: 'small' | 'medium' | 'large';
}

function AcaciaTree({ style, size = 'medium' }: DecorationProps) {
  const sizeClasses = {
    small: 'w-8 h-12',
    medium: 'w-12 h-16',
    large: 'w-16 h-20',
  };

  return (
    <div
      className={`absolute ${sizeClasses[size]} pointer-events-none`}
      style={style}
    >
      {/* Trunk */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1/2 bg-amber-800 rounded" />
      {/* Canopy - flat-topped acacia style */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2">
        <div className="w-full h-full bg-green-700 rounded-t-full opacity-80" />
        <div className="absolute -left-1/4 top-1/4 w-[150%] h-1/2 bg-green-600 rounded-full opacity-70" />
      </div>
    </div>
  );
}

function Rock({ style }: DecorationProps) {
  return (
    <div
      className="absolute w-6 h-4 md:w-8 md:h-5 pointer-events-none"
      style={style}
    >
      <div className="w-full h-full bg-gray-500 rounded-t-lg rounded-b-sm opacity-60" />
      <div className="absolute top-0 left-1/4 w-1/2 h-1/3 bg-gray-400 rounded-t-lg opacity-40" />
    </div>
  );
}

function GrassTuft({ style }: DecorationProps) {
  return (
    <div
      className="absolute w-6 h-4 flex justify-center items-end gap-0.5 pointer-events-none"
      style={style}
    >
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-0.5 bg-green-600 rounded-t-full opacity-70"
          style={{
            height: `${60 + (i % 3) * 20}%`,
            transform: `rotate(${(i - 2) * 8}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function WateringHole({ style }: DecorationProps) {
  return (
    <div
      className="absolute w-16 h-8 md:w-20 md:h-10 pointer-events-none"
      style={style}
    >
      {/* Water */}
      <div className="w-full h-full bg-blue-400 rounded-full opacity-50" />
      {/* Reflection */}
      <div className="absolute top-1 left-1/4 w-1/2 h-1/3 bg-blue-200 rounded-full opacity-40" />
      {/* Surrounding mud/shore */}
      <div className="absolute -inset-1 bg-amber-600 rounded-full opacity-30 -z-10" />
    </div>
  );
}
