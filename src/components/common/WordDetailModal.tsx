import { useMemo } from 'react';
import {
  X,
  Clock,
  BookOpen,
  Sparkles,
  Star,
  Check,
  AlertCircle,
  Archive,
  RotateCcw,
  Play,
  Zap,
  Flower2,
  Trophy,
  Rocket,
} from 'lucide-react';
import { Word, WordAttempt, GameModeId, MASTERY_INTERVALS } from '@/types';
import { getWordState, WordState } from '@/utils/wordSelection';
import { Button } from './Button';

interface WordDetailModalProps {
  word: Word | null;
  isOpen: boolean;
  onClose: () => void;
  onForceIntroduce?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
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

// Render state badge for a word
const renderStateBadge = (state: WordState, isActive: boolean) => {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
        <Archive size={12} />
        Archived
      </span>
    );
  }

  switch (state) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          <Clock size={12} />
          Waiting
        </span>
      );
    case 'learning':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <BookOpen size={12} />
          Learning
        </span>
      );
    case 'review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Sparkles size={12} />
          Reviewing
        </span>
      );
    case 'mastered':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <Star size={12} />
          Mastered
        </span>
      );
  }
};

// Format date for display
const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format duration in ms to readable string
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
};

// Get next review info
const getNextReviewInfo = (word: Word): string => {
  const now = new Date();
  const nextReview = new Date(word.nextReviewAt);
  const diffMs = nextReview.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Due now';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays} days`;
};

// Get mastery level color
const getMasteryColor = (level: number): string => {
  if (level === 0) return 'bg-red-400';
  if (level === 1) return 'bg-orange-400';
  if (level === 2) return 'bg-yellow-400';
  if (level === 3) return 'bg-lime-400';
  if (level === 4) return 'bg-green-400';
  return 'bg-emerald-500';
};

export function WordDetailModal({
  word,
  isOpen,
  onClose,
  onForceIntroduce,
  onArchive,
  onUnarchive,
}: WordDetailModalProps) {
  // Calculate stats from attempt history
  const stats = useMemo(() => {
    if (!word) return null;

    const attempts = word.attemptHistory || [];
    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.wasCorrect).length;
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    return {
      totalAttempts,
      correctAttempts,
      accuracy,
      streak: word.correctStreak,
    };
  }, [word]);

  if (!isOpen || !word) return null;

  const state = getWordState(word);
  const isActive = word.isActive !== false;
  const isWaiting = state === 'available' && isActive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 capitalize">{word.text}</h2>
            {renderStateBadge(state, isActive)}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Definition and example */}
          {(word.definition || word.exampleSentence) && (
            <div className="mb-6 bg-gray-50 rounded-lg p-4">
              {word.definition && (
                <p className="text-gray-700 mb-2">
                  <span className="font-medium">Definition:</span> {word.definition}
                </p>
              )}
              {word.exampleSentence && (
                <p className="text-gray-600 text-sm italic">
                  "{word.exampleSentence}"
                </p>
              )}
            </div>
          )}

          {/* Mastery level visualization */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Mastery Level</span>
              <span className="text-sm text-gray-500">
                {word.masteryLevel}/5 • {MASTERY_INTERVALS[word.masteryLevel]} day review
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map(level => (
                <div
                  key={level}
                  className={`h-3 flex-1 rounded-full transition-all ${
                    level <= word.masteryLevel
                      ? getMasteryColor(level)
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{stats?.totalAttempts || 0}</div>
              <div className="text-xs text-gray-500">Total Attempts</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats?.accuracy || 0}%</div>
              <div className="text-xs text-gray-500">Accuracy</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats?.streak || 0}</div>
              <div className="text-xs text-gray-500">Streak</div>
            </div>
          </div>

          {/* Next review */}
          {isActive && state !== 'available' && (
            <div className="mb-6 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-700 font-medium">Next Review</span>
              <span className="text-sm text-blue-600">{getNextReviewInfo(word)}</span>
            </div>
          )}

          {/* Attempt History */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Attempt History</h3>
            {(!word.attemptHistory || word.attemptHistory.length === 0) ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No attempts recorded yet
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {word.attemptHistory.slice(0, 20).map((attempt: WordAttempt) => (
                  <div
                    key={attempt.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                      attempt.wasCorrect ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {attempt.wasCorrect ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <AlertCircle size={16} className="text-red-500" />
                      )}
                      <span className={attempt.wasCorrect ? 'text-green-700' : 'text-red-600'}>
                        {attempt.wasCorrect ? 'Correct' : `"${attempt.typedText}"`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      {attempt.timeMs && (
                        <span className="text-xs">{formatDuration(attempt.timeMs)}</span>
                      )}
                      <span className="flex items-center gap-1">
                        {getModeIcon(attempt.mode)}
                        <span className="text-xs hidden sm:inline">{getModeLabel(attempt.mode)}</span>
                      </span>
                      <span className="text-xs">{formatDate(attempt.timestamp)}</span>
                    </div>
                  </div>
                ))}
                {word.attemptHistory.length > 20 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    +{word.attemptHistory.length - 20} more attempts
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t bg-gray-50 flex gap-3">
          {isWaiting && onForceIntroduce && (
            <Button
              onClick={() => {
                onForceIntroduce(word.id);
                onClose();
              }}
              variant="primary"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Start Learning
            </Button>
          )}

          {isActive && onArchive && (
            <Button
              onClick={() => {
                onArchive(word.id);
                onClose();
              }}
              variant="secondary"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Archive size={18} />
              Archive
            </Button>
          )}

          {!isActive && onUnarchive && (
            <Button
              onClick={() => {
                onUnarchive(word.id);
                onClose();
              }}
              variant="primary"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Restore
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
