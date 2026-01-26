import { useLocation, useNavigate } from 'react-router-dom';
import { Home, RotateCcw, Flower2, Star, Clock, Calendar } from 'lucide-react';
import { Button } from '../common';
import { GameResult } from '@/types';

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
    <div className="flex items-center gap-3 py-1.5">
      {/* Word label */}
      <span className="w-32 text-base font-medium text-gray-700 truncate flex-shrink-0 capitalize">{word}</span>

      {/* Attempt chips */}
      <div className="flex flex-wrap gap-1.5">
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

export function PracticeCompleteScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result as GameResult | undefined;

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No practice data available</p>
          <Button onClick={() => navigate('/')} variant="primary">
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header card with completion info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-lg w-full mb-6">
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

      {/* Word list with attempt timeline */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-lg w-full mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Words Practiced</h3>
        <div className="space-y-1">
          {result.completedWords.map(word => (
            <WordAttemptRow
              key={word.word}
              word={word.word}
              wrongAttempts={attemptsByWord[word.word] || []}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
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
          onClick={() => navigate('/')}
          variant="secondary"
          size="lg"
          className="flex items-center gap-2"
        >
          <Home size={20} />
          Home
        </Button>
      </div>
    </div>
  );
}
