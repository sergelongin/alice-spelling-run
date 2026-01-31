import { Link } from 'react-router-dom';
import { BookOpen, Trophy, Flame } from 'lucide-react';

interface QuickStatsDashboardProps {
  totalWords: number;
  masteredWords: number;
  streak: number;
  childId?: string;
}

/**
 * Quick stats overview for parent mode.
 * Shows total words, mastered count, accuracy, and practice streak.
 */
export function QuickStatsDashboard({
  totalWords,
  masteredWords,
  streak,
  childId,
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
      link: childId ? `/parent-dashboard/child/${childId}/word-bank` : undefined,
    },
    {
      label: 'Mastered',
      value: `${masteredWords}`,
      subtext: `${masteryPercent}%`,
      icon: <Trophy className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      link: childId ? `/parent-dashboard/child/${childId}/word-bank?filter=mastered` : undefined,
    },
    {
      label: 'Streak',
      value: streak.toString(),
      subtext: 'days',
      icon: <Flame className="w-5 h-5" />,
      color: streak > 0 ? 'text-orange-600' : 'text-gray-400',
      bgColor: streak > 0 ? 'bg-orange-50' : 'bg-gray-50',
      link: undefined, // Streak doesn't link anywhere
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(stat => {
        const content = (
          <>
            <div className={`flex items-center gap-2 mb-2 ${stat.color}`}>
              {stat.icon}
              <span className="text-xs font-medium uppercase tracking-wide">{stat.label}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.subtext}</div>
          </>
        );

        if (stat.link) {
          return (
            <Link
              key={stat.label}
              to={stat.link}
              className={`${stat.bgColor} rounded-xl p-4 transition-all hover:shadow-md cursor-pointer`}
            >
              {content}
            </Link>
          );
        }

        return (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-xl p-4 transition-all`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
