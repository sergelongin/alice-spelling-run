import { useEffect } from 'react';
import { X, Flower2, Star, Clock, Calendar, TreePalm, Trophy } from 'lucide-react';
import { GameResult } from '@/types';
import { getTrophyEmoji } from '@/utils';

interface GameSessionDialogProps {
  game: GameResult | null;
  isOpen: boolean;
  onClose: () => void;
}

// Format duration in seconds to a human-readable string
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

// Format date to a friendly string
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Component to display attempt history for a single word
function WordAttemptRow({ word, wrongAttempts }: { word: string; wrongAttempts: string[] }) {
  return (
    <div className="flex items-center gap-4 py-2">
      {/* Word label */}
      <span className="w-32 text-base font-medium text-gray-700 truncate flex-shrink-0 capitalize">{word}</span>

      {/* Attempt chips */}
      <div className="flex flex-wrap gap-2">
        {/* Wrong attempts (red chips) */}
        {wrongAttempts.map((attempt, i) => (
          <span
            key={i}
            className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-700 font-medium"
          >
            {attempt}
          </span>
        ))}
        {/* Correct (green chip) */}
        <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-700 font-medium">
          {word}
        </span>
      </div>
    </div>
  );
}

export function GameSessionDialog({ game, isOpen, onClose }: GameSessionDialogProps) {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const isMeadowGame = game.mode === 'meadow';

  // Group wrong attempts by word
  const attemptsByWord = (game.wrongAttempts || []).reduce((acc, wa) => {
    if (!acc[wa.word]) acc[wa.word] = [];
    acc[wa.word].push(wa.attempt);
    return acc;
  }, {} as Record<string, string[]>);

  // Calculate first-try success rate for star rating
  const firstTryWords = game.completedWords.filter(w => w.attempts === 1).length;
  const firstTryRate = game.completedWords.length > 0
    ? (firstTryWords / game.completedWords.length) * 100
    : 0;

  // Determine star rating (1-3 stars)
  const getStarRating = (rate: number): number => {
    if (rate >= 70) return 3;
    if (rate >= 40) return 2;
    return 1;
  };
  const starRating = getStarRating(firstTryRate);

  // Star display component
  const StarDisplay = ({ rating }: { rating: number }) => {
    const stars = [];
    for (let i = 1; i <= 3; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-8 h-8 ${
            i <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          }`}
        />
      );
    }
    return <div className="flex gap-1">{stars}</div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
          aria-label="Close"
        >
          <X size={24} className="text-gray-500" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
              isMeadowGame ? 'bg-green-100' : game.won ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isMeadowGame ? (
                <Flower2 className="w-8 h-8 text-green-500" />
              ) : game.won ? (
                game.trophy ? (
                  <span className="text-3xl">{getTrophyEmoji(game.trophy)}</span>
                ) : (
                  <Trophy className="w-8 h-8 text-green-500" />
                )
              ) : (
                <TreePalm className="w-8 h-8 text-red-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-2xl font-bold ${
                isMeadowGame || game.won ? 'text-green-700' : 'text-red-700'
              }`}>
                {isMeadowGame ? 'Practice Complete!' : game.won ? 'Victory!' : 'Game Over'}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <StarDisplay rating={starRating} />
                <span className="text-base text-gray-500">
                  {firstTryWords} of {game.completedWords.length} first try
                </span>
              </div>
            </div>
          </div>

          {/* Date and time row */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-base text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />
              <span>{formatDate(game.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-gray-400" />
              <span>{formatDuration(game.totalTime / 1000)}</span>
            </div>
            {!isMeadowGame && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Lives:</span>
                <span className="font-medium">{game.finalLives}</span>
              </div>
            )}
          </div>
        </div>

        {/* Word list with attempt timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Words {isMeadowGame ? 'Practiced' : 'Attempted'}
          </h3>
          <div className="space-y-1">
            {game.completedWords.map(word => (
              <WordAttemptRow
                key={word.word}
                word={word.word}
                wrongAttempts={attemptsByWord[word.word] || []}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
