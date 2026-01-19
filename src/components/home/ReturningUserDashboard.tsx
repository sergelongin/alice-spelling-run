import { Flame, Trophy, Star, Zap } from 'lucide-react';

interface ReturningUserDashboardProps {
  streak: number;
  totalWins: number;
  wordsLearned: number;
  gamesPlayed: number;
}

export function ReturningUserDashboard({
  streak,
  totalWins,
  wordsLearned,
  gamesPlayed,
}: ReturningUserDashboardProps) {
  // Show different content based on how much they've played
  const isNewish = gamesPlayed < 5;

  if (isNewish) {
    return (
      <div className="bg-white/80 backdrop-blur rounded-xl p-4 max-w-md w-full shadow-md border border-amber-100">
        <p className="text-center text-gray-600">
          <span className="font-semibold text-amber-700">Keep going!</span>
          <br />
          <span className="text-sm">Every adventure helps Alice get stronger.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur rounded-xl p-4 max-w-md w-full shadow-md border border-amber-100">
      <h3 className="text-sm font-semibold text-gray-500 mb-3 text-center">
        Your Journey So Far
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {/* Streak */}
        <div className="text-center">
          <div className={`flex items-center justify-center gap-1 ${streak > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            <Flame size={16} className={streak > 0 ? 'fill-orange-500' : ''} />
            <span className="text-xl font-bold">{streak}</span>
          </div>
          <div className="text-xs text-gray-500">Streak</div>
        </div>

        {/* Wins */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600">
            <Trophy size={16} />
            <span className="text-xl font-bold">{totalWins}</span>
          </div>
          <div className="text-xs text-gray-500">Escapes</div>
        </div>

        {/* Words Learned */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600">
            <Star size={16} className="fill-blue-600" />
            <span className="text-xl font-bold">{wordsLearned}</span>
          </div>
          <div className="text-xs text-gray-500">Words</div>
        </div>

        {/* Games Played */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600">
            <Zap size={16} />
            <span className="text-xl font-bold">{gamesPlayed}</span>
          </div>
          <div className="text-xs text-gray-500">Games</div>
        </div>
      </div>

      {/* Motivational message */}
      {streak >= 3 && (
        <div className="mt-3 text-center">
          <span className="text-xs text-orange-600 font-medium">
            {streak >= 7 ? '🔥 On fire! Keep the streak going!' : '✨ Great streak! Keep it up!'}
          </span>
        </div>
      )}
    </div>
  );
}
