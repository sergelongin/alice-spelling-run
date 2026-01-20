import { useMemo } from 'react';
import { BookOpen, Star, Target, Users } from 'lucide-react';
import type { ChildProfile } from '@/types/auth';
import {
  getChildWordBank,
  countActiveWords,
  countMasteredWords,
} from '@/utils/childDataReader';

interface FamilyOverviewProps {
  children: ChildProfile[];
}

/**
 * Aggregate statistics across all children
 */
export function FamilyOverview({ children }: FamilyOverviewProps) {
  const overview = useMemo(() => {
    let totalWords = 0;
    let totalMastered = 0;
    let totalCorrect = 0;
    let totalAttempts = 0;

    for (const child of children) {
      const wordBank = getChildWordBank(child.id);
      totalWords += countActiveWords(wordBank);
      totalMastered += countMasteredWords(wordBank);

      for (const word of wordBank.words) {
        totalCorrect += word.timesCorrect;
        totalAttempts += word.timesUsed;
      }
    }

    const averageAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return {
      totalWords,
      totalMastered,
      averageAccuracy,
      childCount: children.length,
    };
  }, [children]);

  const stats = [
    {
      label: 'Total Words',
      value: overview.totalWords.toLocaleString(),
      icon: BookOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Mastered',
      value: overview.totalMastered.toLocaleString(),
      icon: Star,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      label: 'Avg Accuracy',
      value: `${overview.averageAccuracy}%`,
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Children',
      value: overview.childCount.toString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-800 mb-4">Family Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
