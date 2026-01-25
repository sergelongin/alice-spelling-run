import { Star } from 'lucide-react';
import { Word } from '@/types';

interface RecentMasteryBadgeProps {
  word: Word | null;
}

/**
 * Celebrates the most recently mastered word.
 * Shows a single celebration item for recent wins (within last 3 days).
 */
export function RecentMasteryBadge({ word }: RecentMasteryBadgeProps) {
  if (!word) return null;

  // Calculate how recently the word was mastered
  const getTimeAgo = () => {
    const lastCorrect = word.attemptHistory?.find(a => a.wasCorrect);
    const masteryDate = lastCorrect?.timestamp || word.lastAttemptAt;
    if (!masteryDate) return 'recently';

    const now = new Date();
    const date = new Date(masteryDate);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="flex items-center gap-3 py-2 px-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-green-200/50">
      <div className="relative flex-shrink-0">
        <Star
          className="w-5 h-5 text-yellow-500 star-sparkle"
          fill="currentColor"
        />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-600">
          You mastered{' '}
          <span className="font-semibold text-green-700">
            &ldquo;{word.text}&rdquo;
          </span>{' '}
          {getTimeAgo()}!
        </span>
      </div>
    </div>
  );
}
