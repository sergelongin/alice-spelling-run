import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;
}

/**
 * Prominent animated streak badge that celebrates daily practice consistency.
 * Shows encouraging messaging and an animated flame icon.
 */
export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  const getMessage = () => {
    if (streak >= 7) return "You're unstoppable!";
    if (streak >= 5) return 'Amazing streak!';
    if (streak >= 3) return 'Keep it going!';
    return "Great start!";
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full shadow-sm">
      <div className="relative">
        <Flame
          className="w-6 h-6 text-orange-500 flame-animate"
          fill="currentColor"
        />
        {/* Glow effect behind flame */}
        <div className="absolute inset-0 bg-orange-400 rounded-full blur-md opacity-30 animate-pulse" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-orange-600">{streak}</span>
        <span className="text-sm text-orange-700">day streak</span>
      </div>
      <span className="text-xs text-orange-600 font-medium ml-1">{getMessage()}</span>
    </div>
  );
}
