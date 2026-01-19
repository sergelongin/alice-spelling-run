import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Award, User } from 'lucide-react';
import { Button } from '../common';

// Mock leaderboard data - will be replaced with real API
const mockLeaderboard = [
  { rank: 1, username: 'SpellingChamp', score: 1250, wordsCorrect: 10, livesRemaining: 5 },
  { rank: 2, username: 'WordWizard', score: 1180, wordsCorrect: 10, livesRemaining: 4 },
  { rank: 3, username: 'AlphabetAce', score: 1100, wordsCorrect: 10, livesRemaining: 3 },
  { rank: 4, username: 'LetterLegend', score: 1050, wordsCorrect: 9, livesRemaining: 5 },
  { rank: 5, username: 'SpellStar', score: 980, wordsCorrect: 9, livesRemaining: 4 },
  { rank: 6, username: 'VocabVictor', score: 920, wordsCorrect: 9, livesRemaining: 3 },
  { rank: 7, username: 'GrammarGuru', score: 850, wordsCorrect: 8, livesRemaining: 5 },
  { rank: 8, username: 'WordWhiz', score: 800, wordsCorrect: 8, livesRemaining: 4 },
  { rank: 9, username: 'SpellingSensei', score: 750, wordsCorrect: 8, livesRemaining: 3 },
  { rank: 10, username: 'LetterLover', score: 700, wordsCorrect: 7, livesRemaining: 5 },
];

export function LeaderboardScreen() {
  const { challengeId } = useParams();
  const navigate = useNavigate();

  const isDaily = challengeId?.startsWith('daily');
  const challengeType = isDaily ? 'Daily' : 'Weekly';

  // Mock user rank
  const userRank = 15;
  const userScore = 620;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>;
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200';
      default:
        return 'bg-white border-gray-100';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          onClick={() => navigate('/wildlands')}
          variant="secondary"
          size="sm"
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {challengeType} Challenge Leaderboard
          </h1>
          <p className="text-sm text-gray-500">
            Challenge ID: {challengeId}
          </p>
        </div>
      </div>

      {/* User's rank card */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-800">Your Ranking</p>
              <p className="text-sm text-purple-600">Keep playing to improve!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-700">#{userRank}</p>
            <p className="text-sm text-purple-600">{userScore} pts</p>
          </div>
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="space-y-2">
        {mockLeaderboard.map((entry) => (
          <div
            key={entry.rank}
            className={`flex items-center p-4 rounded-xl border ${getRankBgColor(entry.rank)}`}
          >
            <div className="w-8 flex justify-center">
              {getRankIcon(entry.rank)}
            </div>
            <div className="flex-1 ml-3">
              <p className="font-semibold text-gray-800">{entry.username}</p>
              <p className="text-xs text-gray-500">
                {entry.wordsCorrect} words · {entry.livesRemaining} lives left
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800">{entry.score}</p>
              <p className="text-xs text-gray-500">points</p>
            </div>
          </div>
        ))}
      </div>

      {/* Load more / pagination placeholder */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500 mb-2">
          Showing top 10 of 142 participants
        </p>
        <Button variant="secondary" size="sm" disabled>
          Load More
        </Button>
      </div>

      {/* Info */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-700 mb-2">Scoring</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 100 points per word spelled correctly</li>
          <li>• 50 bonus points per life remaining</li>
          <li>• Time bonus based on completion speed</li>
        </ul>
      </div>
    </div>
  );
}
