import { Flower2, Zap, Trophy, Lock, LucideIcon } from 'lucide-react';
import { GameModeConfig, ModeStatistics } from '@/types';

interface ModeSelectionCardProps {
  mode: GameModeConfig;
  onClick: () => void;
  disabled?: boolean;
  locked?: boolean;
  stats?: ModeStatistics;
}

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  Flower2,
  Zap,
  Trophy,
};

// Theme colors for each mode
const themeColors: Record<string, { bg: string; border: string; accent: string; hover: string }> = {
  meadow: {
    bg: 'bg-gradient-to-br from-green-50 to-emerald-100',
    border: 'border-green-300',
    accent: 'text-green-600',
    hover: 'hover:border-green-400 hover:shadow-green-200',
  },
  savannah: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-100',
    border: 'border-amber-300',
    accent: 'text-amber-600',
    hover: 'hover:border-amber-400 hover:shadow-amber-200',
  },
  wildlands: {
    bg: 'bg-gradient-to-br from-purple-50 to-indigo-100',
    border: 'border-purple-300',
    accent: 'text-purple-600',
    hover: 'hover:border-purple-400 hover:shadow-purple-200',
  },
};

export function ModeSelectionCard({
  mode,
  onClick,
  disabled = false,
  locked = false,
  stats,
}: ModeSelectionCardProps) {
  const IconComponent = iconMap[mode.icon] || Zap;
  const colors = themeColors[mode.theme] || themeColors.savannah;

  const isClickable = !disabled && !locked;

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={disabled || locked}
      className={`
        relative w-full p-6 rounded-xl border-2 transition-all duration-200
        ${colors.bg} ${colors.border}
        ${isClickable ? `${colors.hover} hover:shadow-lg cursor-pointer` : 'opacity-60 cursor-not-allowed'}
        text-left
      `}
    >
      {/* Lock overlay for locked modes */}
      {locked && (
        <div className="absolute inset-0 bg-gray-900/20 rounded-xl flex items-center justify-center">
          <div className="bg-white/90 rounded-full p-3">
            <Lock size={24} className="text-gray-500" />
          </div>
        </div>
      )}

      {/* Header with icon and name */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors.accent} bg-white/50`}>
          <IconComponent size={28} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">{mode.name}</h3>
          <p className="text-sm text-gray-600">{mode.description}</p>
        </div>
      </div>

      {/* Mode features */}
      <div className="flex flex-wrap gap-2 mb-3">
        {mode.hasTimer ? (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            {mode.timePerWord}s timer
          </span>
        ) : (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            No timer
          </span>
        )}
        {mode.hasLives ? (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            {mode.initialLives} lives
          </span>
        ) : (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            Unlimited tries
          </span>
        )}
        {mode.feedbackStyle === 'wordle' && (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            Wordle hints
          </span>
        )}
        {mode.awardsTrophies && (
          <span className="px-2 py-1 bg-white/60 rounded-full text-xs text-gray-700">
            Trophies
          </span>
        )}
      </div>

      {/* Stats preview if available */}
      {stats && stats.totalGamesPlayed > 0 && (
        <div className="pt-3 border-t border-gray-200/50">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Games: {stats.totalGamesPlayed}</span>
            <span>Wins: {stats.totalWins}</span>
            {stats.streakBest > 0 && <span>Best streak: {stats.streakBest}</span>}
          </div>
        </div>
      )}

      {/* Play indicator */}
      {isClickable && (
        <div className={`absolute top-4 right-4 ${colors.accent}`}>
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
