import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Achievement } from '@/types/achievements';

interface NextBadgeTeaserProps {
  nextAchievement: Achievement | null;
}

/**
 * Shows progress toward the next unearned achievement.
 * Tappable to view all achievements.
 */
export function NextBadgeTeaser({ nextAchievement }: NextBadgeTeaserProps) {
  const navigate = useNavigate();

  if (!nextAchievement) return null;

  const progressPercent = Math.round((nextAchievement.progress || 0) * 100);

  return (
    <button
      onClick={() => navigate('/word-bank', { state: { tab: 'achievements' } })}
      className="w-full bg-white/70 backdrop-blur rounded-xl p-3 shadow-sm
                 hover:bg-white/90 transition-all active:scale-[0.99]
                 flex items-center gap-3"
    >
      {/* Badge icon */}
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-amber-100 to-yellow-200 rounded-lg flex items-center justify-center text-2xl">
        {nextAchievement.icon}
      </div>

      {/* Progress info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 truncate">
            Next: {nextAchievement.name}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {nextAchievement.progressText || `${progressPercent}%`}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}
