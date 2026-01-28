import { LevelMapMilestone } from '@/types/levelMap';
import { Lock } from 'lucide-react';

type NodeState = 'locked' | 'unlocked' | 'current' | 'next';

interface LevelMapNodeProps {
  milestone: LevelMapMilestone;
  state: NodeState;
  index: number;
  currentMilestoneIndex?: number;
}

/**
 * Get opacity for completed milestones based on how far behind they are
 * Creates a "fading into the distance" effect for passed milestones
 */
function getDistanceOpacity(index: number, currentMilestoneIndex: number): number {
  const distance = currentMilestoneIndex - index;
  if (distance <= 0) return 1;        // Current or future: full opacity
  if (distance === 1) return 0.7;     // Just passed: slightly faded
  if (distance === 2) return 0.4;     // 2 behind: more faded
  return 0.2;                          // Far behind: very faded
}

/**
 * Individual milestone node on the level map
 * Shows different visual states: locked, unlocked, current, next
 * Completed milestones fade based on distance from character
 */
export function LevelMapNode({ milestone, state, index, currentMilestoneIndex = 0 }: LevelMapNodeProps) {
  const { position, icon, name } = milestone;

  // Calculate distance-based opacity for fading completed milestones
  const distanceOpacity = getDistanceOpacity(index, currentMilestoneIndex);

  const baseClasses = 'absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300';
  const sizeClasses = 'w-10 h-10 md:w-12 md:h-12';

  const getNodeStyles = () => {
    switch (state) {
      case 'locked':
        return 'bg-gray-400/60 border-2 border-gray-500/40 text-gray-600';
      case 'unlocked':
        return 'bg-emerald-500/80 border-2 border-emerald-300 text-white shadow-lg';
      case 'current':
        return 'bg-amber-500 border-3 border-amber-300 text-white shadow-xl animate-pulse-subtle ring-4 ring-amber-300/50';
      case 'next':
        return 'bg-amber-100/80 border-2 border-amber-400/60 text-amber-700 animate-shimmer';
      default:
        return 'bg-gray-300 border-2 border-gray-400';
    }
  };

  return (
    <div
      className={`${baseClasses} ${sizeClasses} ${getNodeStyles()} rounded-full`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        opacity: distanceOpacity,
      }}
      title={name}
    >
      {state === 'locked' ? (
        <Lock className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
      ) : (
        <span className="text-lg md:text-xl">{icon}</span>
      )}

      {/* Name label (show on larger screens for current/next milestones) */}
      {(state === 'current' || state === 'next') && (
        <div
          className={`
            absolute whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full
            hidden md:block
            ${state === 'current'
              ? 'bg-amber-600 text-white -bottom-7'
              : 'bg-amber-100 text-amber-700 -bottom-7'
            }
          `}
        >
          {name}
        </div>
      )}

      {/* Checkmark for completed milestones */}
      {state === 'unlocked' && index > 0 && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
