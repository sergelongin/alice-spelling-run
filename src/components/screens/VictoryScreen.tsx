import { useNavigate, useLocation } from 'react-router-dom';
import { Home, RotateCcw, Trophy, BarChart3 } from 'lucide-react';
import ConfettiExplosion from 'react-confetti-explosion';
import { Button } from '../common';
import { GameResult, GameModeId } from '@/types';
import { getTrophyDisplayName, getTrophyEmoji, getTrophyColor } from '@/utils';

export function VictoryScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.result as GameResult | undefined;
  const mode = (result?.mode || 'savannah') as GameModeId;
  const isWildlands = mode === 'wildlands';
  const challengeId = result?.challengeId;

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No game result found</p>
          <Button onClick={() => navigate('/home')} variant="primary">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const trophy = result.trophy!;
  const trophyColor = getTrophyColor(trophy);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Confetti */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2">
        <ConfettiExplosion
          force={0.8}
          duration={4000}
          particleCount={150}
          width={1600}
        />
      </div>

      {/* Trophy */}
      <div className="mb-8 relative">
        <div
          className="w-48 h-48 rounded-full flex items-center justify-center trophy-shine"
          style={{
            background: `radial-gradient(circle, ${trophyColor}40 0%, ${trophyColor}20 70%, transparent 100%)`,
          }}
        >
          <span className="text-8xl">{getTrophyEmoji(trophy)}</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-gray-800 mb-2">
        Congratulations!
      </h1>
      <p className="text-2xl text-gray-600 mb-8">
        {isWildlands ? 'Challenge Complete!' : 'You escaped the lion!'}
      </p>

      {/* Trophy name */}
      <div
        className="px-6 py-3 rounded-full text-xl font-bold mb-8"
        style={{
          backgroundColor: `${trophyColor}30`,
          color: trophy === 'platinum' ? '#666' : trophyColor,
          border: `2px solid ${trophyColor}`,
        }}
      >
        <Trophy className="inline mr-2" size={24} />
        {getTrophyDisplayName(trophy)}
      </div>

      {/* Stats */}
      <div className="bg-white/90 rounded-xl p-6 mb-8 shadow-lg">
        <div className={`grid ${isWildlands && result.score ? 'grid-cols-4' : 'grid-cols-3'} gap-8 text-center`}>
          {isWildlands && result.score && (
            <div>
              <div className="text-3xl font-bold text-purple-500">
                {result.score}
              </div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          )}

          <div>
            <div className="text-3xl font-bold text-green-500">
              {result.wordsCorrect}
            </div>
            <div className="text-sm text-gray-600">Words Spelled</div>
          </div>

          <div>
            <div className="text-3xl font-bold text-red-500">
              {result.finalLives}
            </div>
            <div className="text-sm text-gray-600">Lives Remaining</div>
          </div>

          <div>
            <div className="text-3xl font-bold text-blue-500">
              {Math.round(
                (result.wordsCorrect / result.wordsAttempted) * 100
              )}%
            </div>
            <div className="text-sm text-gray-600">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Words completed */}
      {result.completedWords.length > 0 && (
        <div className="bg-white/80 rounded-lg p-4 mb-8 max-w-md w-full">
          <h3 className="font-bold text-gray-700 mb-2 text-center">
            Words You Spelled
          </h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {result.completedWords.map((cw, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm capitalize"
              >
                {cw.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        {isWildlands && challengeId && (
          <Button
            onClick={() => navigate(`/leaderboard/${challengeId}`)}
            variant="primary"
            size="lg"
            className="flex items-center gap-2"
          >
            <BarChart3 size={24} />
            View Leaderboard
          </Button>
        )}

        <Button
          onClick={() => {
            if (isWildlands) {
              navigate('/wildlands');
            } else {
              navigate('/game', { state: { mode } });
            }
          }}
          variant="success"
          size="lg"
          className="flex items-center gap-2"
        >
          <RotateCcw size={24} />
          {isWildlands ? 'More Challenges' : 'Play Again'}
        </Button>

        <Button
          onClick={() => navigate('/home')}
          variant="secondary"
          size="lg"
          className="flex items-center gap-2"
        >
          <Home size={24} />
          Home
        </Button>
      </div>
    </div>
  );
}
