import { useNavigate } from 'react-router-dom';
import { Home, Trophy, Calendar, CalendarDays, Users, Clock } from 'lucide-react';
import { Button } from '../common';
import { useGameContext } from '@/context/GameContextDB';

// Mock challenge data - will be replaced with real API
const mockDailyChallenge = {
  id: 'daily-2024-01-15',
  type: 'daily' as const,
  date: new Date().toISOString().split('T')[0],
  wordCount: 10,
  participants: 142,
  endsIn: '8 hours',
};

const mockWeeklyChallenge = {
  id: 'weekly-2024-w03',
  type: 'weekly' as const,
  date: 'Week 3, 2024',
  wordCount: 15,
  participants: 523,
  endsIn: '4 days',
};

export function WildlandsHubScreen() {
  const navigate = useNavigate();
  const { wordBank } = useGameContext();

  const canPlay = wordBank.words.length >= 5;

  const handleStartChallenge = (challengeType: 'daily' | 'weekly') => {
    // TODO: Fetch actual challenge words from API
    // For now, use words from word bank
    navigate('/game', {
      state: {
        mode: 'wildlands',
        challengeType,
        challengeId: challengeType === 'daily' ? mockDailyChallenge.id : mockWeeklyChallenge.id,
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
          <Trophy className="w-10 h-10 text-purple-500" />
        </div>
        <h1 className="text-4xl font-bold text-purple-700 mb-2">
          Wildlands League
        </h1>
        <p className="text-xl text-gray-600">
          Compete with spellers around the world!
        </p>
      </div>

      {/* Challenge cards */}
      <div className="w-full max-w-lg space-y-4 mb-8">
        {/* Daily Challenge */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-800">Daily Challenge</h2>
                <p className="text-sm text-blue-600">{mockDailyChallenge.date}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-medium">
              NEW
            </span>
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm text-blue-700">
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {mockDailyChallenge.endsIn}
            </span>
            <span className="flex items-center gap-1">
              <Users size={16} />
              {mockDailyChallenge.participants} players
            </span>
            <span>{mockDailyChallenge.wordCount} words</span>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => handleStartChallenge('daily')}
              disabled={!canPlay}
              variant="primary"
              className="flex-1"
            >
              Start Challenge
            </Button>
            <Button
              onClick={() => navigate(`/leaderboard/${mockDailyChallenge.id}`)}
              variant="secondary"
            >
              Leaderboard
            </Button>
          </div>
        </div>

        {/* Weekly Challenge */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-purple-800">Weekly Challenge</h2>
                <p className="text-sm text-purple-600">{mockWeeklyChallenge.date}</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-200 text-purple-800 rounded-full text-sm font-medium">
              FEATURED
            </span>
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm text-purple-700">
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {mockWeeklyChallenge.endsIn}
            </span>
            <span className="flex items-center gap-1">
              <Users size={16} />
              {mockWeeklyChallenge.participants} players
            </span>
            <span>{mockWeeklyChallenge.wordCount} words</span>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => handleStartChallenge('weekly')}
              disabled={!canPlay}
              variant="primary"
              className="flex-1"
            >
              Start Challenge
            </Button>
            <Button
              onClick={() => navigate(`/leaderboard/${mockWeeklyChallenge.id}`)}
              variant="secondary"
            >
              Leaderboard
            </Button>
          </div>
        </div>
      </div>

      {/* Word bank warning */}
      {!canPlay && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-lg w-full mb-8">
          <p className="text-amber-800 text-sm">
            Add at least 5 words to your word bank to participate in challenges.
          </p>
          <Button
            onClick={() => navigate('/word-bank')}
            variant="secondary"
            size="sm"
            className="mt-2"
          >
            Go to Word Bank
          </Button>
        </div>
      )}

      {/* Info section */}
      <div className="bg-white/80 rounded-xl p-6 max-w-lg w-full mb-8">
        <h3 className="font-semibold text-gray-800 mb-3">How It Works</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-purple-500 font-bold">1.</span>
            Complete the challenge by spelling all words correctly
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-500 font-bold">2.</span>
            Your score is based on words correct, lives remaining, and time
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-500 font-bold">3.</span>
            Compare your ranking on the leaderboard
          </li>
        </ul>
      </div>

      {/* Back button */}
      <Button
        onClick={() => navigate('/')}
        variant="secondary"
        className="flex items-center gap-2"
      >
        <Home size={18} />
        Back to Home
      </Button>
    </div>
  );
}
