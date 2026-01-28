import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Flame, BarChart3, TrendingUp, Star, Zap } from 'lucide-react';
import { Button } from '../common';
import { GameResult, GameModeId, getStatsModeId } from '@/types';
import { useGameContext } from '@/context/GameContextDB';
import { findSessionWins, type SessionWin } from '@/utils/sessionSummary';

export function GameOverScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { statistics } = useGameContext();
  const result = location.state?.result as GameResult | undefined;
  const mode = (result?.mode || 'savannah') as GameModeId;
  const statsModeId = getStatsModeId(mode);
  const isWildlands = mode === 'wildlands';
  const challengeId = result?.challengeId;

  // Get session wins (positive things to celebrate)
  const sessionWins = result
    ? findSessionWins(result, statistics, statistics.modeStats[statsModeId]?.gameHistory || [])
    : [];

  // Get icon for session win type
  const getWinIcon = (type: SessionWin['type']) => {
    switch (type) {
      case 'first-time': return <Star className="text-yellow-500" size={20} />;
      case 'streak': return <Flame className="text-orange-500" size={20} />;
      case 'improvement': return <TrendingUp className="text-green-500" size={20} />;
      case 'milestone': return <Zap className="text-purple-500" size={20} />;
      case 'consistency': return <Star className="text-blue-500" size={20} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-amber-100 to-orange-100">
      {/* Race Results Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Race Results
        </h1>
        <p className="text-lg text-gray-600">
          Great effort! Here's how you did:
        </p>
      </div>

      {/* Main Stats Card */}
      <div className="bg-white/90 rounded-xl p-6 mb-6 shadow-lg max-w-md w-full text-center">
        {result && (
          <>
            <div className="text-6xl font-bold text-orange-500 mb-2">
              {result.wordsCorrect}
            </div>
            <div className="text-lg text-gray-600 mb-4">
              {result.wordsCorrect === 1 ? 'word' : 'words'} spelled correctly!
            </div>

            <div className="grid grid-cols-2 gap-4 text-center border-t pt-4">
              <div>
                <div className="text-2xl font-bold text-blue-500">
                  {result.wordsAttempted}
                </div>
                <div className="text-sm text-gray-600">Words Attempted</div>
              </div>

              <div>
                <div className="text-2xl font-bold text-green-500">
                  {result.wordsAttempted > 0
                    ? Math.round((result.wordsCorrect / result.wordsAttempted) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Today's Wins - Always show something positive */}
      {sessionWins.length > 0 && (
        <div className="bg-white/80 rounded-xl p-4 mb-6 max-w-md w-full">
          <h3 className="font-bold text-gray-700 mb-3 text-center">
            Today's Wins
          </h3>
          <div className="space-y-2">
            {sessionWins.map((win, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg px-4 py-2"
              >
                {getWinIcon(win.type)}
                <span className="text-gray-700">{win.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Words completed (if any) */}
      {result && result.completedWords.length > 0 && (
        <div className="bg-white/80 rounded-lg p-4 mb-6 max-w-md w-full">
          <h3 className="font-bold text-gray-700 mb-2 text-center">
            Words You Mastered
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
            variant="secondary"
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
          variant="primary"
          size="lg"
          className="flex items-center gap-2"
        >
          <Flame size={24} />
          Beat Your Record?
        </Button>

        <Button
          onClick={() => navigate('/')}
          variant="secondary"
          size="lg"
          className="flex items-center gap-2"
        >
          <Home size={24} />
          Home
        </Button>
      </div>

      {/* Encouraging message */}
      <div className="mt-6 text-center text-gray-600 text-sm max-w-md">
        <p>
          {result && result.wordsCorrect > 0
            ? `You're making progress! Each word you spell correctly builds your spelling skills.`
            : `Every attempt is practice. Try again and watch your skills grow!`}
        </p>
      </div>
    </div>
  );
}
