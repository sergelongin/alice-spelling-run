import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Flame, Pencil, Trash2 } from 'lucide-react';
import { ProfileAvatar } from '@/components/profiles';
import type { ChildProfile } from '@/types/auth';
import type { ChildStatus } from '@/types/parent';
import {
  useChildData,
  calculateAccuracy,
  countActiveWords,
  countMasteredWords,
  calculateStreak,
  getLastActivityDate,
  getDaysSinceActivity,
} from '@/hooks';

interface ChildSummaryCardProps {
  child: ChildProfile;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Summary card for a single child showing key metrics and status
 */
export function ChildSummaryCard({ child, onClick, onEdit, onDelete }: ChildSummaryCardProps) {
  const { wordBank } = useChildData(child.id);

  const summary = useMemo(() => {
    const totalWords = countActiveWords(wordBank);
    const masteredWords = countMasteredWords(wordBank);
    const accuracy = calculateAccuracy(wordBank);
    const streak = calculateStreak(wordBank);
    const lastActivityDate = getLastActivityDate(wordBank);
    const daysSinceActivity = getDaysSinceActivity(lastActivityDate);

    // Determine status
    let status: ChildStatus = 'on-track';
    if (daysSinceActivity !== null && daysSinceActivity >= 5) {
      status = 'needs-attention';
    } else if (accuracy >= 80 && streak >= 3) {
      status = 'excellent';
    } else if (accuracy < 50 || (daysSinceActivity !== null && daysSinceActivity >= 3)) {
      status = 'needs-attention';
    }

    return {
      totalWords,
      masteredWords,
      accuracy,
      streak,
      status,
      daysSinceActivity,
    };
  }, [wordBank]);

  const statusConfig = {
    excellent: {
      label: 'Excellent',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    },
    'on-track': {
      label: 'On Track',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    },
    'needs-attention': {
      label: 'Needs Attention',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
    },
  };

  const config = statusConfig[summary.status];

  // Trend indicator (placeholder - would need historical data for real trend)
  const TrendIcon = summary.accuracy >= 70 ? TrendingUp : summary.accuracy < 50 ? TrendingDown : Minus;
  const trendColor = summary.accuracy >= 70 ? 'text-green-500' : summary.accuracy < 50 ? 'text-red-500' : 'text-gray-400';

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const showActions = onEdit || onDelete;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  // Determine if we need attention badge
  const needsAttentionBadge = summary.status === 'needs-attention';
  const hasWarningBadge = summary.daysSinceActivity !== null &&
    summary.daysSinceActivity >= 3 &&
    summary.daysSinceActivity < 5 &&
    summary.status !== 'needs-attention';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group relative w-full bg-white rounded-xl p-4 shadow-sm border-2 ${config.borderColor} hover:shadow-md transition-all text-left cursor-pointer`}
    >
      {/* Attention badge - red for needs attention, amber for warning */}
      {needsAttentionBadge && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white z-20" />
      )}
      {hasWarningBadge && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white z-20" />
      )}

      {/* Hover overlay with edit/delete actions */}
      {showActions && (
        <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-10">
          {onEdit && (
            <button
              onClick={handleEdit}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              title="Edit profile"
            >
              <Pencil size={20} className="text-white" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-3 bg-white/20 hover:bg-red-500/80 rounded-full transition-colors"
              title="Delete profile"
            >
              <Trash2 size={20} className="text-white" />
            </button>
          )}
        </div>
      )}

      {/* Header with avatar and name */}
      <div className="flex items-center gap-3 mb-3">
        <ProfileAvatar
          name={child.name}
          gradeLevel={child.grade_level}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{child.name}</h3>
          <p className="text-sm text-gray-500">Grade {child.grade_level}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Accuracy</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-800">{summary.accuracy}%</span>
            <TrendIcon size={14} className={trendColor} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Streak</span>
          <div className="flex items-center gap-1">
            <Flame size={14} className={summary.streak > 0 ? 'text-orange-500' : 'text-gray-300'} />
            <span className="font-semibold text-gray-800">{summary.streak}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Mastered</span>
          <span className="font-semibold text-gray-800">
            {summary.masteredWords}/{summary.totalWords}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
        {config.label}
      </div>
    </div>
  );
}
