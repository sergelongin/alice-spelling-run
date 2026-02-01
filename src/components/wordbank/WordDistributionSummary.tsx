import { Word } from '@/types';
import { getWordState, WordState } from '@/utils/wordSelection';
import { Clock } from 'lucide-react';

interface WordDistributionSummaryProps {
  words: Word[];
  childName?: string;
}

interface StateCount {
  state: WordState | 'archived';
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

/**
 * Summary card showing word distribution across learning states.
 * Displays a segmented bar with counts for each state.
 * Shows a special callout when there are waiting words.
 */
export function WordDistributionSummary({ words, childName }: WordDistributionSummaryProps) {
  // Count words by state
  const counts: Record<WordState | 'archived', number> = {
    available: 0,
    learning: 0,
    review: 0,
    mastered: 0,
    archived: 0,
  };

  words.forEach(word => {
    if (word.isActive === false) {
      counts.archived++;
    } else {
      counts[getWordState(word)]++;
    }
  });

  // Active word count (excludes archived)
  const activeTotal = counts.available + counts.learning + counts.review + counts.mastered;

  if (activeTotal === 0) {
    return null;
  }

  const states: StateCount[] = [
    { state: 'learning', label: 'Learning', count: counts.learning, color: 'bg-orange-400', bgColor: 'bg-orange-100' },
    { state: 'review', label: 'Reviewing', count: counts.review, color: 'bg-blue-400', bgColor: 'bg-blue-100' },
    { state: 'mastered', label: 'Mastered', count: counts.mastered, color: 'bg-green-400', bgColor: 'bg-green-100' },
    { state: 'available', label: 'Waiting', count: counts.available, color: 'bg-violet-400', bgColor: 'bg-violet-100' },
  ];

  // Filter out states with 0 count for the bar
  const nonEmptyStates = states.filter(s => s.count > 0);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-800 mb-4">Word Distribution</h3>

      {/* Segmented progress bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 mb-4">
        {nonEmptyStates.map(state => (
          <div
            key={state.state}
            className={`${state.color} transition-all`}
            style={{ width: `${(state.count / activeTotal) * 100}%` }}
            title={`${state.label}: ${state.count}`}
          />
        ))}
      </div>

      {/* Legend with counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {states.map(state => (
          <div
            key={state.state}
            className={`flex items-center gap-2 p-2 rounded-lg ${state.count > 0 ? state.bgColor : 'bg-gray-50'}`}
          >
            <div className={`w-3 h-3 rounded-full ${state.count > 0 ? state.color : 'bg-gray-200'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${state.count > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                {state.label}
              </div>
              <div className={`text-lg font-bold ${state.count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                {state.count}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Waiting words callout */}
      {counts.available > 0 && (
        <div className="mt-4 p-3 bg-violet-50 rounded-lg flex items-start gap-3">
          <Clock size={18} className="text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-violet-700">
            <span className="font-medium">{counts.available} word{counts.available !== 1 ? 's' : ''} in queue</span>
            {' '}&mdash; introduced gradually as {childName || 'the child'} masters current words.
          </div>
        </div>
      )}

      {/* Archived note */}
      {counts.archived > 0 && (
        <div className="mt-3 text-xs text-gray-400">
          {counts.archived} archived word{counts.archived !== 1 ? 's' : ''} not shown above
        </div>
      )}
    </div>
  );
}
