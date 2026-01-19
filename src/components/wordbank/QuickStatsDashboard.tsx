import { BookOpen, Trophy, Target, Flame } from 'lucide-react';

interface QuickStatsDashboardProps {
  totalWords: number;
  masteredWords: number;
  accuracy: number;
  streak: number;
}

/**
 * Quick stats overview for parent mode.
 * Shows total words, mastered count, accuracy, and practice streak.
 */
export function QuickStatsDashboard({
  totalWords,
  masteredWords,
  accuracy,
  streak,
}: QuickStatsDashboardProps) {
  const masteryPercent = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;

  const stats = [
    {
      label: 'Total Words',
      value: totalWords.toString(),
      subtext: 'in word bank',
      icon: <BookOpen className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Mastered',
      value: `${masteredWords}`,
      subtext: `${masteryPercent}%`,
      icon: <Trophy className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Accuracy',
      value: `${accuracy}%`,
      subtext: 'overall',
      icon: <Target className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Streak',
      value: streak.toString(),
      subtext: 'days',
      icon: <Flame className="w-5 h-5" />,
      color: streak > 0 ? 'text-orange-600' : 'text-gray-400',
      bgColor: streak > 0 ? 'bg-orange-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`${stat.bgColor} rounded-xl p-4 transition-all hover:shadow-md`}
        >
          <div className={`flex items-center gap-2 mb-2 ${stat.color}`}>
            {stat.icon}
            <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
          </div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-gray-500">{stat.subtext}</div>
        </div>
      ))}
    </div>
  );
}
