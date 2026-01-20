import { useMemo } from 'react';
import { AlertTriangle, Clock, BookX } from 'lucide-react';
import type { ChildProfile } from '@/types/auth';
import type { AttentionItem } from '@/types/parent';
import {
  getChildWordBank,
  getLastActivityDate,
  getDaysSinceActivity,
  getStrugglingWordsList,
} from '@/utils/childDataReader';

interface AttentionNeededListProps {
  children: ChildProfile[];
}

/**
 * List of issues that need parent attention across all children
 */
export function AttentionNeededList({ children }: AttentionNeededListProps) {
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];

    for (const child of children) {
      const wordBank = getChildWordBank(child.id);
      const lastActivity = getLastActivityDate(wordBank);
      const daysSince = getDaysSinceActivity(lastActivity);
      const strugglingWords = getStrugglingWordsList(wordBank);

      // Check for inactivity
      if (daysSince !== null && daysSince >= 3) {
        items.push({
          type: 'inactivity',
          childId: child.id,
          childName: child.name,
          message: `${child.name} hasn't practiced in ${daysSince} day${daysSince === 1 ? '' : 's'}`,
          severity: daysSince >= 7 ? 'alert' : 'warning',
        });
      }

      // Check for struggling words
      if (strugglingWords.length >= 3) {
        const wordList = strugglingWords.slice(0, 3).map(w => `"${w}"`).join(', ');
        const moreCount = strugglingWords.length - 3;
        items.push({
          type: 'struggling-words',
          childId: child.id,
          childName: child.name,
          message: `${child.name} is struggling with ${wordList}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          severity: strugglingWords.length >= 5 ? 'alert' : 'warning',
        });
      }
    }

    // Sort by severity (alerts first)
    items.sort((a, b) => {
      if (a.severity === 'alert' && b.severity !== 'alert') return -1;
      if (a.severity !== 'alert' && b.severity === 'alert') return 1;
      return 0;
    });

    return items;
  }, [children]);

  if (attentionItems.length === 0) {
    return (
      <div className="bg-green-50 rounded-xl p-5 border border-green-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-xl">🌟</span>
          </div>
          <div>
            <h3 className="font-semibold text-green-800">All Good!</h3>
            <p className="text-sm text-green-600">Everyone is on track with their learning.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" />
        Needs Attention
      </h2>

      <div className="space-y-3">
        {attentionItems.map((item, index) => (
          <div
            key={`${item.childId}-${item.type}-${index}`}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              item.severity === 'alert' ? 'bg-red-50' : 'bg-amber-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.severity === 'alert' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              {item.type === 'inactivity' ? (
                <Clock size={16} className={item.severity === 'alert' ? 'text-red-600' : 'text-amber-600'} />
              ) : (
                <BookX size={16} className={item.severity === 'alert' ? 'text-red-600' : 'text-amber-600'} />
              )}
            </div>
            <p className={`text-sm ${item.severity === 'alert' ? 'text-red-700' : 'text-amber-700'}`}>
              {item.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
