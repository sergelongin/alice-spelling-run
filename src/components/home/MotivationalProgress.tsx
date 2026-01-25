import { useNavigate } from 'react-router-dom';
import { Flame, ChevronRight } from 'lucide-react';
import { Achievement } from '@/types/achievements';

interface MotivationalProgressProps {
  streak: number;
  masteredCount: number;
  nextStreakAchievement: Achievement | null;
  nextMasteryAchievement: Achievement | null;
  allBadgesEarned: boolean;
}

/**
 * Goal-oriented progress display that shows:
 * - Streak progress toward next streak badge (if streak > 0)
 * - Mastery progress toward next word badge
 *
 * Replaces separate StreakBadge, NextBadgeTeaser, and CompactProgressBar
 * with a unified, motivational view.
 */
export function MotivationalProgress({
  streak,
  masteredCount,
  nextStreakAchievement,
  nextMasteryAchievement,
  allBadgesEarned,
}: MotivationalProgressProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/word-bank', { state: { tab: 'achievements' } });
  };

  // If all badges earned, show celebration message
  if (allBadgesEarned) {
    return (
      <button
        onClick={handleClick}
        className="w-full bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-3 shadow-sm
                   hover:from-amber-100 hover:to-yellow-100 transition-all active:scale-[0.99]
                   flex items-center justify-center gap-2"
      >
        <span className="text-xl">🏆</span>
        <span className="text-sm font-medium text-amber-700">
          Amazing! All badges unlocked!
        </span>
        <ChevronRight className="w-4 h-4 text-amber-400" />
      </button>
    );
  }

  // Extract goal info from achievements
  const streakGoal = nextStreakAchievement
    ? parseInt(nextStreakAchievement.id.split('-')[2])
    : null;

  const masteryGoal = nextMasteryAchievement
    ? parseInt(nextMasteryAchievement.id.split('-')[2])
    : null;

  return (
    <button
      onClick={handleClick}
      className="w-full bg-white/70 backdrop-blur rounded-xl p-3 shadow-sm
                 hover:bg-white/90 transition-all active:scale-[0.99]
                 flex flex-col gap-2"
    >
      {/* Streak row - only show if streak > 0 and there's a streak achievement to earn */}
      {streak > 0 && nextStreakAchievement && streakGoal && (
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Flame className="w-5 h-5 text-orange-500" fill="currentColor" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${(streak / streakGoal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
              {streak}/{streakGoal} days → {nextStreakAchievement.name}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>
      )}

      {/* Mastery row - show if there's a mastery achievement to earn */}
      {nextMasteryAchievement && masteryGoal && (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 text-lg">📚</div>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-500"
                style={{ width: `${(masteredCount / masteryGoal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
              {masteredCount}/{masteryGoal} → {nextMasteryAchievement.name}
            </span>
          </div>
          {/* Only show chevron on last row */}
          {!(streak > 0 && nextStreakAchievement) && (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          {streak > 0 && nextStreakAchievement && (
            <div className="w-4" /> // Spacer for alignment
          )}
        </div>
      )}

      {/* Fallback if no specific achievements to show but not all earned */}
      {!nextStreakAchievement && !nextMasteryAchievement && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-gray-600">View all achievements</span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      )}
    </button>
  );
}
