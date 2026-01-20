import { useState } from 'react';
import { Achievement } from '@/types/achievements';

interface AchievementBadgesProps {
  achievements: Achievement[];
  variant?: 'default' | 'compact';
}

interface BadgeModalProps {
  achievement: Achievement;
  onClose: () => void;
}

function BadgeModal({ achievement, onClose }: BadgeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center
                      animate-[bounceIn_0.3s_ease-out]">
        <div className={`text-6xl mb-4 ${achievement.isEarned ? 'animate-bounce' : 'grayscale opacity-40'}`}>
          {achievement.icon}
        </div>
        <h3 className={`text-xl font-bold mb-2 ${achievement.isEarned ? 'text-gray-800' : 'text-gray-400'}`}>
          {achievement.name}
        </h3>
        <p className={`text-sm mb-4 ${achievement.isEarned ? 'text-gray-600' : 'text-gray-400'}`}>
          {achievement.description}
        </p>

        {achievement.isEarned ? (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium inline-block">
            Earned!
          </div>
        ) : achievement.progressText ? (
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
                style={{ width: `${(achievement.progress || 0) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{achievement.progressText}</p>
          </div>
        ) : (
          <div className="bg-gray-100 text-gray-500 px-4 py-2 rounded-full text-sm font-medium inline-block">
            Not yet earned
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 text-gray-400 hover:text-gray-600 text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * Display achievement badges with earned/unearned states.
 * Earned badges glow, unearned are grayed out.
 * Shows highest tier of each achievement type.
 */
export function AchievementBadges({ achievements, variant = 'default' }: AchievementBadgesProps) {
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Group achievements by base type and show highest tier earned (or next tier to earn)
  const displayAchievements = getDisplayAchievements(achievements);

  if (displayAchievements.length === 0) {
    return null;
  }

  const isCompact = variant === 'compact';

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${isCompact ? 'p-4' : 'p-6'}`}>
        <h3 className={`font-bold text-gray-800 flex items-center gap-2 ${isCompact ? 'text-base mb-3' : 'text-lg mb-4'}`}>
          <span>🏆</span>
          My Achievements
        </h3>

        <div className={isCompact
          ? 'grid grid-cols-3 gap-2'
          : 'flex flex-wrap gap-4 justify-start'
        }>
          {displayAchievements.map(achievement => (
            <button
              key={achievement.id}
              onClick={() => setSelectedAchievement(achievement)}
              className={`group relative flex flex-col items-center rounded-xl transition-all
                        hover:scale-110 hover:shadow-lg active:scale-100
                        ${isCompact ? 'p-2' : 'p-3'}
                        ${achievement.isEarned
                          ? 'bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm'
                          : 'bg-gray-50 opacity-50 hover:opacity-75'}`}
            >
              <span className={`transition-transform group-hover:scale-110
                              ${isCompact ? 'text-2xl mb-0.5' : 'text-3xl mb-1'}
                              ${achievement.isEarned ? 'drop-shadow-lg' : 'grayscale'}`}>
                {achievement.icon}
              </span>
              <span className={`font-medium text-center leading-tight
                              ${isCompact ? 'text-[10px] max-w-[60px]' : 'text-xs max-w-[70px]'}
                              ${achievement.isEarned ? 'text-gray-700' : 'text-gray-400'}`}>
                {achievement.name}
              </span>

              {/* Glow effect for earned badges */}
              {achievement.isEarned && (
                <div className="absolute inset-0 rounded-xl bg-amber-400/20 blur-xl -z-10
                              opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Badge detail modal */}
      {selectedAchievement && (
        <BadgeModal
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </>
  );
}

/**
 * Get achievements to display, showing the highest earned tier
 * or the next tier to work towards for each achievement type.
 */
function getDisplayAchievements(achievements: Achievement[]): Achievement[] {
  // Group by base achievement type (without tier number)
  const groups = new Map<string, Achievement[]>();

  for (const achievement of achievements) {
    // Extract base type (e.g., "streak-master" from "streak-master-3")
    const baseParts = achievement.id.split('-');
    const baseType = baseParts.slice(0, -1).join('-');

    // Check if this has a tier (ends with a number)
    const hasTier = /\d+$/.test(achievement.id);

    if (hasTier) {
      const existing = groups.get(baseType) || [];
      existing.push(achievement);
      groups.set(baseType, existing);
    } else {
      // Non-tiered achievements go in their own group
      groups.set(achievement.id, [achievement]);
    }
  }

  // For each group, pick the best achievement to display
  const display: Achievement[] = [];

  for (const [, group] of groups) {
    if (group.length === 1) {
      // Non-tiered achievement
      display.push(group[0]);
    } else {
      // Tiered achievement - sort by tier
      const sorted = [...group].sort((a, b) => (b.tier || 0) - (a.tier || 0));

      // Find highest earned tier
      const highestEarned = sorted.find(a => a.isEarned);

      if (highestEarned) {
        // Show highest earned
        display.push(highestEarned);
        // Note: Could show next tier as preview by uncommenting below:
        // const nextTier = sorted.find(a => !a.isEarned && (a.tier || 0) > (highestEarned.tier || 0));
        // if (nextTier) display.push(nextTier);
      } else {
        // No tiers earned yet - show lowest tier (easiest to earn)
        const lowestTier = sorted[sorted.length - 1];
        display.push(lowestTier);
      }
    }
  }

  // Sort: earned first, then by name
  return display.sort((a, b) => {
    if (a.isEarned !== b.isEarned) return a.isEarned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
