import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useFreshGameData } from '@/hooks/useFreshGameData';
import { LEVEL_MAP_MILESTONES } from '@/data/levelMapMilestones';
import { calculateLevelMapProgress, getProgressMessage } from '@/utils/levelMapUtils';
import { LevelMapPath } from '@/components/levelMap/LevelMapPath';
import { LevelMapCharacter } from '@/components/levelMap/LevelMapCharacter';

/**
 * Full-screen level map view for detailed inspection
 * Shows all milestones with names and progress details
 */
export function LevelMapScreen() {
  const navigate = useNavigate();
  const { learningProgress } = useFreshGameData();

  const progress = useMemo(
    () => calculateLevelMapProgress(learningProgress),
    [learningProgress]
  );

  const progressMessage = getProgressMessage(progress);

  const getNodeState = (index: number) => {
    if (index < progress.currentMilestoneIndex) return 'unlocked';
    if (index === progress.currentMilestoneIndex) return 'current';
    if (index === progress.currentMilestoneIndex + 1) return 'next';
    return 'locked';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-amber-100 to-amber-200 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-amber-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="text-center">
            <h1 className="font-bold text-gray-800">Safari Trail</h1>
            <p className="text-xs text-gray-500">{progressMessage}</p>
          </div>

          <div className="flex items-center gap-2 text-amber-600">
            <Trophy className="w-5 h-5" />
            <span className="font-bold">{progress.totalPoints}</span>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative" style={{ height: 'calc(100vh - 120px)', minHeight: '500px' }}>
        {/* Decorative background */}
        <div className="absolute inset-0">
          {/* Acacia silhouettes */}
          <div className="absolute left-[5%] top-[25%] w-16 h-20 opacity-30">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-1/2 bg-amber-800 rounded" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-green-700 rounded-t-full" />
          </div>
          <div className="absolute right-[10%] top-[40%] w-12 h-16 opacity-20">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1/2 bg-amber-800 rounded" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-green-700 rounded-t-full" />
          </div>
        </div>

        {/* The winding trail path */}
        <LevelMapPath
          currentMilestoneIndex={progress.currentMilestoneIndex}
          percentToNext={progress.percentToNextMilestone}
        />

        {/* Milestone nodes with full labels */}
        {LEVEL_MAP_MILESTONES.map((milestone, index) => (
          <MilestoneWithLabel
            key={milestone.id}
            milestone={milestone}
            state={getNodeState(index)}
            index={index}
            isComplete={index <= progress.currentMilestoneIndex}
          />
        ))}

        {/* Player character */}
        <LevelMapCharacter position={progress.characterPosition} />
      </div>

      {/* Bottom Stats Panel */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-amber-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-500">Current: </span>
              <span className="font-semibold text-amber-700">
                {progress.currentMilestone.icon} {progress.currentMilestone.name}
              </span>
            </div>

            {progress.nextMilestone && (
              <div>
                <span className="text-gray-500">Next: </span>
                <span className="font-semibold text-gray-600">
                  {progress.nextMilestone.icon} {progress.nextMilestone.name}
                </span>
                <span className="text-gray-400 text-xs ml-1">
                  ({progress.pointsToNextMilestone} pts)
                </span>
              </div>
            )}

            {progress.isGradeComplete && (
              <div className="text-emerald-600 font-semibold">
                Grade Complete!
              </div>
            )}
          </div>

          {/* Progress bar */}
          {!progress.isGradeComplete && (
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                style={{
                  width: `${(progress.currentMilestoneIndex / (LEVEL_MAP_MILESTONES.length - 1)) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MilestoneWithLabelProps {
  milestone: typeof LEVEL_MAP_MILESTONES[0];
  state: 'locked' | 'unlocked' | 'current' | 'next';
  index: number;
  isComplete: boolean;
}

function MilestoneWithLabel({ milestone, state, index, isComplete }: MilestoneWithLabelProps) {
  const { position, icon, name, threshold } = milestone;

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      {/* Node */}
      <div
        className={`
          w-12 h-12 rounded-full flex items-center justify-center
          transition-all duration-300
          ${state === 'locked' ? 'bg-gray-400/60 border-2 border-gray-500/40' : ''}
          ${state === 'unlocked' ? 'bg-emerald-500/80 border-2 border-emerald-300 shadow-lg' : ''}
          ${state === 'current' ? 'bg-amber-500 border-3 border-amber-300 shadow-xl animate-pulse-subtle ring-4 ring-amber-300/50' : ''}
          ${state === 'next' ? 'bg-amber-100/80 border-2 border-amber-400/60' : ''}
        `}
      >
        <span className="text-xl">{icon}</span>

        {/* Checkmark for completed */}
        {isComplete && index > 0 && state === 'unlocked' && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div
        className={`
          text-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap
          ${state === 'locked' ? 'bg-gray-200 text-gray-500' : ''}
          ${state === 'unlocked' ? 'bg-emerald-100 text-emerald-700' : ''}
          ${state === 'current' ? 'bg-amber-500 text-white' : ''}
          ${state === 'next' ? 'bg-amber-100 text-amber-700' : ''}
        `}
      >
        {name}
      </div>

      {/* Points threshold */}
      <div className="text-[10px] text-gray-500">
        {threshold} pts
      </div>
    </div>
  );
}
