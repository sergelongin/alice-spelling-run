import { useState, useEffect } from 'react';
import { BookOpen, Star, Target, Users } from 'lucide-react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import type { WordProgress } from '@/db/models';
import type { ChildProfile } from '@/types/auth';

interface FamilyOverviewProps {
  children: ChildProfile[];
}

interface FamilyStats {
  totalWords: number;
  totalMastered: number;
  averageAccuracy: number;
  childCount: number;
}

/**
 * Aggregate statistics across all children
 */
export function FamilyOverview({ children }: FamilyOverviewProps) {
  const [overview, setOverview] = useState<FamilyStats>({
    totalWords: 0,
    totalMastered: 0,
    averageAccuracy: 0,
    childCount: children.length,
  });

  // Subscribe to word progress for all children
  useEffect(() => {
    if (children.length === 0) {
      setOverview({
        totalWords: 0,
        totalMastered: 0,
        averageAccuracy: 0,
        childCount: 0,
      });
      return;
    }

    const childIds = children.map(c => c.id);
    const collection = database.get<WordProgress>('word_progress');

    // Query all word progress for all children
    const subscription = collection
      .query(Q.where('child_id', Q.oneOf(childIds)))
      .observe()
      .subscribe(records => {
        let totalWords = 0;
        let totalMastered = 0;
        let totalCorrect = 0;
        let totalAttempts = 0;

        for (const wp of records) {
          // Only count active words
          if (wp.isActive !== false) {
            totalWords++;
            if (wp.masteryLevel === 5) {
              totalMastered++;
            }
          }

          // Count attempts from attempt history
          const attempts = wp.attemptHistory || [];
          totalAttempts += attempts.length;
          totalCorrect += attempts.filter(a => a.wasCorrect).length;
        }

        const averageAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

        setOverview({
          totalWords,
          totalMastered,
          averageAccuracy,
          childCount: children.length,
        });
      });

    return () => subscription.unsubscribe();
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
