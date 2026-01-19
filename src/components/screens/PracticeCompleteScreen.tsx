import { useLocation, useNavigate } from 'react-router-dom';
import { Home, RotateCcw, Flower2, CheckCircle, Target } from 'lucide-react';
import { Button } from '../common';
import { GameResult } from '@/types';

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

  const accuracy = result.wordsAttempted > 0
    ? Math.round((result.wordsCorrect / result.wordsAttempted) * 100)
    : 0;

  // Find most challenging words (most attempts)
  const challengingWords = [...result.completedWords]
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 3)
    .filter(w => w.attempts > 1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Peaceful header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4">
          <Flower2 className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-4xl font-bold text-green-700 mb-2">
          Practice Complete!
        </h1>
        <p className="text-xl text-gray-600">
          Great job practicing your spelling
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 max-w-md w-full mb-8">
        <div className="bg-white rounded-xl p-6 text-center shadow-md border border-green-100">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <div className="text-3xl font-bold text-green-600">
            {result.wordsCorrect}
          </div>
          <div className="text-sm text-gray-600">Words Spelled</div>
        </div>

        <div className="bg-white rounded-xl p-6 text-center shadow-md border border-blue-100">
          <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <div className="text-3xl font-bold text-blue-600">
            {accuracy}%
          </div>
          <div className="text-sm text-gray-600">Accuracy</div>
        </div>
      </div>

      {/* Words practiced */}
      <div className="bg-white rounded-xl p-6 max-w-md w-full mb-8 shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Words Practiced
        </h2>
        <div className="flex flex-wrap gap-2">
          {result.completedWords.map((word, index) => (
            <span
              key={index}
              className={`px-3 py-1 rounded-full text-sm ${
                word.attempts === 1
                  ? 'bg-green-100 text-green-700'
                  : word.attempts <= 3
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {word.word}
              {word.attempts > 1 && (
                <span className="ml-1 text-xs opacity-70">({word.attempts})</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Challenging words feedback */}
      {challengingWords.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-6 max-w-md w-full mb-8 border border-amber-200">
          <h2 className="text-lg font-semibold text-amber-800 mb-3">
            Keep Practicing These
          </h2>
          <p className="text-sm text-amber-700 mb-3">
            These words took a few tries - great job sticking with them!
          </p>
          <div className="flex flex-wrap gap-2">
            {challengingWords.map((word, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-amber-100 rounded-full text-amber-800 font-medium"
              >
                {word.word}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* Encouragement */}
      <p className="text-center text-gray-500 text-sm mt-8 max-w-md">
        Remember: Practice makes perfect! Every word you practice helps build your spelling skills.
      </p>
    </div>
  );
}
