import { useState } from 'react';
import { BookOpen, Sparkles, Star, ChevronRight } from 'lucide-react';
import { Word } from '@/types';
import { categorizeWordsByState, WordState } from '@/utils/wordSelection';

interface ProgressJourneyProps {
  words: Word[];
  onWordClick?: (word: Word) => void;
}

interface CategoryViewProps {
  title: string;
  words: Word[];
  state: WordState;
  onWordClick?: (word: Word) => void;
  onClose: () => void;
}

function CategoryView({ title, words, state, onWordClick, onClose }: CategoryViewProps) {
  const getStateColor = () => {
    switch (state) {
      case 'learning':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'review':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'mastered':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="mt-4 bg-white rounded-xl border-2 border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h4 className="font-semibold text-gray-700">{title}</h4>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
      <div className="p-4 max-h-48 overflow-y-auto">
        {words.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-2">No words in this category yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {words.map(word => (
              <button
                key={word.id}
                onClick={() => onWordClick?.(word)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border
                          transition-all hover:scale-105 hover:shadow-md capitalize
                          ${getStateColor()}`}
              >
                {word.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Visual progress journey showing words moving through Learning -> Reviewing -> Mastered.
 * Interactive: tap each section to see words in that state.
 */
export function ProgressJourney({ words, onWordClick }: ProgressJourneyProps) {
  const [expandedCategory, setExpandedCategory] = useState<WordState | null>(null);

  // Only count active words
  const activeWords = words.filter(w => w.isActive !== false);
  const { learning, review, mastered } = categorizeWordsByState(activeWords);

  const total = learning.length + review.length + mastered.length;
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-2">My Progress</h3>
        <p className="text-gray-500 text-sm">Start practicing to see your progress here!</p>
      </div>
    );
  }

  const learningPercent = total > 0 ? (learning.length / total) * 100 : 0;
  const reviewPercent = total > 0 ? (review.length / total) * 100 : 0;
  const masteredPercent = total > 0 ? (mastered.length / total) * 100 : 0;

  // Calculate runner position (percentage from left)
  // Runner moves from learning -> review -> mastered
  const runnerPosition = (reviewPercent / 2) + masteredPercent;

  const categories = [
    {
      state: 'learning' as WordState,
      label: 'Learning',
      count: learning.length,
      words: learning,
      color: 'bg-orange-400',
      lightColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      icon: <BookOpen size={16} />,
    },
    {
      state: 'review' as WordState,
      label: 'Reviewing',
      count: review.length,
      words: review,
      color: 'bg-blue-400',
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      icon: <Sparkles size={16} />,
    },
    {
      state: 'mastered' as WordState,
      label: 'Mastered',
      count: mastered.length,
      words: mastered,
      color: 'bg-green-400',
      lightColor: 'bg-green-100',
      textColor: 'text-green-600',
      icon: <Star size={16} />,
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-4">My Progress</h3>

      {/* Progress bar */}
      <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="flex h-full">
          {learning.length > 0 && (
            <div
              className="bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
              style={{ width: `${learningPercent}%` }}
            />
          )}
          {review.length > 0 && (
            <div
              className="bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-500"
              style={{ width: `${reviewPercent}%` }}
            />
          )}
          {mastered.length > 0 && (
            <div
              className="bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
              style={{ width: `${masteredPercent}%` }}
            />
          )}
        </div>

        {/* Runner indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg
                     border-2 border-gray-200 transition-all duration-500 flex items-center justify-center"
          style={{ left: `calc(${Math.min(95, Math.max(5, 100 - runnerPosition))}% - 12px)` }}
        >
          <span className="text-xs">🏃</span>
        </div>
      </div>

      {/* Category buttons */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {categories.map(cat => (
          <button
            key={cat.state}
            onClick={() => setExpandedCategory(expandedCategory === cat.state ? null : cat.state)}
            className={`relative p-3 rounded-xl transition-all ${cat.lightColor}
                       hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                       ${expandedCategory === cat.state ? 'ring-2 ring-offset-2 ring-gray-300' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={cat.textColor}>{cat.icon}</span>
              <span className={`text-xs font-medium ${cat.textColor}`}>{cat.label}</span>
            </div>
            <div className={`text-2xl font-bold ${cat.textColor}`}>{cat.count}</div>
            <div className="text-xs text-gray-400">word{cat.count !== 1 ? 's' : ''}</div>

            {/* Expand indicator */}
            <ChevronRight
              size={14}
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-300
                        transition-transform ${expandedCategory === cat.state ? 'rotate-90' : ''}`}
            />
          </button>
        ))}
      </div>

      {/* Expanded category view */}
      {expandedCategory && (
        <CategoryView
          title={categories.find(c => c.state === expandedCategory)?.label || ''}
          words={categories.find(c => c.state === expandedCategory)?.words || []}
          state={expandedCategory}
          onWordClick={onWordClick}
          onClose={() => setExpandedCategory(null)}
        />
      )}
    </div>
  );
}
