import { useState } from 'react';
import { Flame } from 'lucide-react';
import { Achievement } from '@/types/achievements';
import { AchievementBadges } from '@/components/wordbank/AchievementBadges';

interface QuickStatsRowProps {
  streak: number;
  achievements: Achievement[];
}

/**
 * Compact horizontal row showing streak and top badges.
 * Mastered count is displayed in CompactProgressBar instead.
 * Tapping badges opens the full achievement modal.
 */
export function QuickStatsRow({ streak, achievements }: QuickStatsRowProps) {
  const [showBadges, setShowBadges] = useState(false);

  const earnedBadges = achievements.filter(a => a.isEarned);
  const topBadges = earnedBadges.slice(0, 3);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 w-full">
        {/* Streak */}
        <div className="flex-1 flex items-center justify-center gap-1.5 bg-white/80 backdrop-blur rounded-lg py-2 px-3 shadow-sm border border-gray-100">
          <Flame size={16} className={streak > 0 ? 'text-orange-500 fill-orange-500' : 'text-gray-300'} />
          <span className={`text-lg font-bold ${streak > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {streak}
          </span>
          <span className="text-xs text-gray-500">day{streak !== 1 ? 's' : ''}</span>
        </div>

        {/* Badges */}
        {topBadges.length > 0 && (
          <button
            onClick={() => setShowBadges(true)}
            className="flex-1 flex items-center justify-center gap-1 bg-white/80 backdrop-blur rounded-lg py-2 px-3 shadow-sm border border-gray-100
                       hover:bg-white hover:shadow-md transition-all active:scale-[0.97]"
          >
            {topBadges.map(badge => (
              <span key={badge.id} className="text-lg">{badge.icon}</span>
            ))}
            {earnedBadges.length > 3 && (
              <span className="text-xs text-gray-400 ml-0.5">+{earnedBadges.length - 3}</span>
            )}
          </button>
        )}
      </div>

      {/* Full badges modal */}
      {showBadges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowBadges(false)} />
          <div className="relative max-w-sm w-full animate-[bounceIn_0.3s_ease-out]">
            <AchievementBadges achievements={achievements} />
            <button
              onClick={() => setShowBadges(false)}
              className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
