import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, RotateCcw, Flower2, Star, Clock, Calendar, ChevronRight } from 'lucide-react';
import { Button, WordAttemptPanel } from '../common';
import { GameResult, WordAttempt } from '@/types';
import { useFreshGameData } from '@/hooks';

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
function WordAttemptRow({
  word,
  wrongAttempts,
  hasHistory,
  onClick,
  isSelected,
}: {
  word: string;
  wrongAttempts: string[];
  hasHistory: boolean;
  onClick: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg w-full text-left transition-colors ${
        isSelected
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-gray-50 border border-transparent'
      } ${hasHistory ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* Word label */}
      <span className="w-32 text-base font-medium text-gray-700 truncate flex-shrink-0 capitalize">
        {word}
      </span>

      {/* Attempt chips */}
      <div className="flex flex-wrap gap-1.5 flex-1">
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

      {/* Arrow indicator for clickable rows */}
      {hasHistory && (
        <ChevronRight
          size={18}
          className={`text-gray-400 flex-shrink-0 transition-transform ${
            isSelected ? 'rotate-90' : ''
          }`}
        />
      )}
    </button>
  );
}

export function PracticeCompleteScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result as GameResult | undefined;
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const { wordBank } = useFreshGameData();

  // Build attempts map from word bank - all historical attempts for each word
  const attemptsMap = useMemo(() => {
    const map = new Map<string, WordAttempt[]>();
    for (const word of wordBank.words) {
      if (word.attemptHistory?.length > 0) {
        map.set(word.text.toLowerCase(), word.attemptHistory);
      }
    }
    return map;
  }, [wordBank.words]);

  // Star display component (smaller stars)
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

  // Early return after all hooks
  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No practice data available</p>
          <Button onClick={() => navigate('/home')} variant="primary">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Group wrong attempts by word
  const attemptsByWord = (result.wrongAttempts || []).reduce((acc, wa) => {
    if (!acc[wa.word]) acc[wa.word] = [];
    acc[wa.word].push(wa.attempt);
    return acc;
  }, {} as Record<string, string[]>);

  // Calculate first-try success rate for star rating
  const firstTryWords = result.completedWords.filter(w => w.attempts === 1).length;
  const firstTryRate = result.completedWords.length > 0
    ? (firstTryWords / result.completedWords.length) * 100
    : 0;

  // Determine star rating (1-3 stars)
  const getStarRating = (rate: number): number => {
    if (rate >= 70) return 3;
    if (rate >= 40) return 2;
    return 1;
  };
  const starRating = getStarRating(firstTryRate);

  // Get full attempt history for selected word from attemptsMap
  const selectedWordAttempts = selectedWord
    ? attemptsMap.get(selectedWord.toLowerCase()) || []
    : [];

  // Handle word click - select word (not toggle, clicking same word keeps it selected)
  // Allow clicking any word that has attempt history in the attemptsMap
  const handleWordClick = (word: string) => {
    const hasAttempts = attemptsMap.has(word.toLowerCase()) && (attemptsMap.get(word.toLowerCase())?.length ?? 0) > 0;
    if (hasAttempts) {
      setSelectedWord(word);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8">
      {/* Header card with completion info */}
      <div className="mx-auto max-w-4xl w-full mb-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-lg mx-auto md:mx-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Flower2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-green-700">Practice Complete!</h1>
              <StarDisplay rating={starRating} />
              <p className="text-sm text-gray-500">
                {firstTryWords} of {result.completedWords.length} first try
              </p>
            </div>
          </div>

          {/* Date and time row */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={16} className="text-gray-400" />
              <span>{formatDate(result.date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-gray-400" />
              <span>{formatDuration(result.totalTime / 1000)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content area - side by side on desktop */}
      <div className="mx-auto max-w-4xl w-full flex-1 flex flex-col md:flex-row gap-6 mb-6 min-h-0">
        {/* Left: Words Practiced */}
        <div
          className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-0 transition-all duration-300 ${
            selectedWord ? 'md:w-1/2' : 'w-full max-w-lg mx-auto md:mx-0'
          }`}
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex-shrink-0">Words Practiced</h3>
          <div className="space-y-1 overflow-y-auto flex-1">
            {result.completedWords.map((word) => {
              const hasHistory = attemptsMap.has(word.word.toLowerCase()) && (attemptsMap.get(word.word.toLowerCase())?.length ?? 0) > 0;
              return (
                <WordAttemptRow
                  key={word.word}
                  word={word.word}
                  wrongAttempts={attemptsByWord[word.word] || []}
                  hasHistory={hasHistory}
                  onClick={() => handleWordClick(word.word)}
                  isSelected={selectedWord === word.word}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Attempt History (desktop - inline side-by-side) */}
        {selectedWord && (
          <div className="hidden md:block md:w-1/2 min-h-0">
            <WordAttemptPanel
              word={selectedWord}
              attempts={selectedWordAttempts}
              onClose={() => setSelectedWord(null)}
              isOpen={!!selectedWord}
              variant="inline"
              showCloseButton={false}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 justify-center">
        <Button
          onClick={() => navigate('/game', { state: { mode: 'meadow' } })}
          variant="success"
          size="lg"
          className="flex items-center gap-2"
        >
          <RotateCcw size={20} />
          Practice More
        </Button>

        <Button
          onClick={() => navigate('/home')}
          variant="secondary"
          size="lg"
          className="flex items-center gap-2"
        >
          <Home size={20} />
          Home
        </Button>
      </div>

      {/* Mobile: Bottom drawer for word attempt details */}
      {selectedWord && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedWord(null)}
          />
          {/* Drawer */}
          <div className="absolute inset-x-0 bottom-0">
            <WordAttemptPanel
              word={selectedWord}
              attempts={selectedWordAttempts}
              onClose={() => setSelectedWord(null)}
              isOpen={!!selectedWord}
              variant="drawer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
