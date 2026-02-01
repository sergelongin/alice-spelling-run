import { useEffect, useRef } from 'react';
import { X, Volume2, Check, XCircle, Flower2, Zap, Rocket, Trophy } from 'lucide-react';
import { analyzeError, getPatternName } from '@/utils/errorPatternAnalysis';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { WordAttempt, GameModeId } from '@/types';

type PanelVariant = 'overlay' | 'inline' | 'drawer';

interface WordAttemptPanelProps {
  word: string;
  attempts: WordAttempt[];
  onClose: () => void;
  isOpen: boolean;
  /** Display variant: overlay (default), inline (no animation/close), drawer (mobile bottom sheet) */
  variant?: PanelVariant;
  /** Show close button (default: true for overlay/drawer, false for inline) */
  showCloseButton?: boolean;
}

// Get icon for game mode
const getModeIcon = (mode: GameModeId) => {
  switch (mode) {
    case 'meadow':
      return <Flower2 size={14} className="text-green-500" />;
    case 'savannah':
      return <Zap size={14} className="text-orange-500" />;
    case 'savannah-quick':
      return <Rocket size={14} className="text-blue-500" />;
    case 'wildlands':
      return <Trophy size={14} className="text-purple-500" />;
    default:
      return <Zap size={14} className="text-gray-500" />;
  }
};

// Get mode label
const getModeLabel = (mode: GameModeId): string => {
  switch (mode) {
    case 'meadow':
      return 'Meadow';
    case 'savannah':
      return 'Full Run';
    case 'savannah-quick':
      return 'Quick Play';
    case 'wildlands':
      return 'Wildlands';
    default:
      return mode;
  }
};

// Format duration in ms to a human-readable string
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

// Format date to a friendly string
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Panel showing detailed attempt history for a word.
 * Supports three display variants:
 * - overlay: Slide-in panel from right (default, for dialogs)
 * - inline: Static panel without animation (for side-by-side layouts)
 * - drawer: Bottom sheet with drag handle (for mobile)
 */
export function WordAttemptPanel({
  word,
  attempts,
  onClose,
  isOpen,
  variant = 'overlay',
  showCloseButton,
}: WordAttemptPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { speak, isSupported } = useTextToSpeech();

  // Determine if close button should show based on variant
  const shouldShowCloseButton = showCloseButton ?? (variant !== 'inline');

  // Handle click outside to close (only for overlay variant)
  useEffect(() => {
    if (!isOpen || variant !== 'overlay') return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, variant]);

  // Handle ESC key to close (for overlay and drawer)
  useEffect(() => {
    if (!isOpen || variant === 'inline') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, variant]);

  if (!isOpen) return null;

  // Limit to last 20 attempts (most recent first - attempts are typically stored newest first)
  const displayedAttempts = attempts.slice(0, 20);
  const hiddenCount = attempts.length - 20;

  // Analyze error patterns for each wrong attempt
  const attemptsWithAnalysis = displayedAttempts.map((attempt) => {
    if (attempt.wasCorrect) {
      return { ...attempt, patterns: [] };
    }
    const patterns = analyzeError(attempt.typedText, word);
    return { ...attempt, patterns };
  });

  // Count unique error patterns across all attempts
  const allPatterns = attemptsWithAnalysis
    .flatMap((a) => a.patterns)
    .filter((p, i, arr) => arr.indexOf(p) === i);

  // Build class names based on variant
  const getContainerClasses = () => {
    const baseClasses = 'bg-white overflow-y-auto';
    switch (variant) {
      case 'inline':
        return `${baseClasses} h-full rounded-xl border border-gray-200`;
      case 'drawer':
        return `${baseClasses} rounded-t-2xl shadow-lg slide-up-drawer max-h-[70vh]`;
      case 'overlay':
      default:
        return `${baseClasses} border-l border-gray-200 shadow-lg h-full slide-in-right`;
    }
  };

  const getContainerStyle = () => {
    switch (variant) {
      case 'inline':
        return {};
      case 'drawer':
        return {};
      case 'overlay':
      default:
        return { minWidth: '280px', maxWidth: '320px' };
    }
  };

  return (
    <div
      ref={panelRef}
      className={getContainerClasses()}
      style={getContainerStyle()}
    >
      {/* Drag handle for drawer variant */}
      {variant === 'drawer' && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className={`sticky top-0 bg-white border-b border-gray-100 p-4 ${variant === 'drawer' ? 'pt-2' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800 capitalize">{word}</h3>
            {isSupported && (
              <button
                onClick={() => speak(word)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={`Pronounce ${word}`}
              >
                <Volume2 size={18} className="text-gray-500" />
              </button>
            )}
          </div>
          {shouldShowCloseButton && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close panel"
            >
              <X size={20} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Attempt History */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Attempt History</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {attemptsWithAnalysis.map((attempt) => (
            <div
              key={attempt.id}
              className={`p-3 rounded-lg ${
                attempt.wasCorrect
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {attempt.wasCorrect ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                  <span className={`font-medium ${attempt.wasCorrect ? 'text-green-700' : 'text-red-700'}`}>
                    {attempt.wasCorrect ? 'Correct' : `"${attempt.typedText}"`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  {attempt.timeMs && (
                    <span className="text-xs">{formatDuration(attempt.timeMs)}</span>
                  )}
                  <span className="flex items-center gap-1" title={getModeLabel(attempt.mode)}>
                    {getModeIcon(attempt.mode)}
                  </span>
                  <span className="text-xs">{formatDate(attempt.timestamp)}</span>
                </div>
              </div>

              {/* Error analysis for wrong attempts */}
              {!attempt.wasCorrect && attempt.patterns.length > 0 && (
                <div className="mt-2 pl-6">
                  <div className="flex flex-wrap gap-1.5">
                    {attempt.patterns.map((pattern) => (
                      <span
                        key={pattern}
                        className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700"
                      >
                        {getPatternName(pattern)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Show diff for wrong attempts */}
              {!attempt.wasCorrect && (
                <div className="mt-2 pl-6 text-xs text-gray-500">
                  {getDiffDescription(attempt.typedText, word)}
                </div>
              )}
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              +{hiddenCount} more attempts
            </p>
          )}
        </div>

        {/* Pattern Summary */}
        {allPatterns.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Common Patterns</h4>
            <div className="flex flex-wrap gap-2">
              {allPatterns.map((pattern) => (
                <span
                  key={pattern}
                  className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-700"
                >
                  {getPatternName(pattern)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Generate a human-readable description of the difference between attempt and correct word
 */
function getDiffDescription(attempt: string, correct: string): string {
  const attemptLower = attempt.toLowerCase();
  const correctLower = correct.toLowerCase();

  if (attemptLower.length < correctLower.length) {
    const diff = correctLower.length - attemptLower.length;
    return `Missing ${diff} letter${diff > 1 ? 's' : ''}`;
  }

  if (attemptLower.length > correctLower.length) {
    const diff = attemptLower.length - correctLower.length;
    return `${diff} extra letter${diff > 1 ? 's' : ''}`;
  }

  // Same length - count different characters
  let diffs = 0;
  for (let i = 0; i < correctLower.length; i++) {
    if (attemptLower[i] !== correctLower[i]) {
      diffs++;
    }
  }

  if (diffs === 1) {
    return '1 letter different';
  }
  return `${diffs} letters different`;
}
