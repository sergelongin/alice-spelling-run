import { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Star, ChevronRight, ChevronLeft } from 'lucide-react';
import { Word } from '@/types';
import { categorizeWordsByState, WordState } from '@/utils/wordSelection';

const WORDS_PER_PAGE = 10;

interface ProgressJourneyProps {
  words: Word[];
  onWordClick?: (word: Word) => void;
}

interface WordProgressRowProps {
  word: Word;
  state: WordState;
  onClick?: (word: Word) => void;
}

function WordProgressRow({ word, state, onClick }: WordProgressRowProps) {
  // Use attemptHistory as the authoritative source (matches WordDetailModal)
  const attempts = (word.attemptHistory || []).length;

  // Calculate progress to next state
  let progressPercent: number;
  let progressLabel: string;

  if (state === 'learning') {
    // Learning (mastery 0-1): Need to reach mastery 2 (Reviewing)
    // Show correctStreak progress - need consistent correct answers
    progressPercent = Math.min(word.correctStreak, 2) / 2 * 100;
    progressLabel = `${word.correctStreak}/2 streak`;
  } else if (state === 'review') {
    // Reviewing (mastery 2-4): Progress toward mastery 5
    progressPercent = ((word.masteryLevel - 2) / 3) * 100;
    progressLabel = `Level ${word.masteryLevel}/5`;
  } else {
    // Mastered: Show complete
    progressPercent = 100;
    progressLabel = 'Mastered!';
  }

  const stateColors: Record<WordState, string> = {
    available: 'bg-gray-400',
    learning: 'bg-orange-400',
    review: 'bg-blue-400',
    mastered: 'bg-green-400',
  };

  return (
    <button
      onClick={() => onClick?.(word)}
      className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium capitalize text-gray-800">{word.text}</span>
        <span className="text-xs text-gray-400">{attempts} attempt{attempts !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${stateColors[state]}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-16 text-right">{progressLabel}</span>
      </div>
    </button>
  );
}

interface CategoryViewProps {
  title: string;
  words: Word[];
  state: WordState;
  onWordClick?: (word: Word) => void;
}

function CategoryView({ title, words, state, onWordClick }: CategoryViewProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(words.length / WORDS_PER_PAGE);
  const paginatedWords = words.slice(page * WORDS_PER_PAGE, (page + 1) * WORDS_PER_PAGE);

  // Reset to first page when words change (e.g., switching categories)
  useEffect(() => {
    setPage(0);
  }, [words]);

  return (
    <div className="mt-4 bg-white rounded-xl border-2 border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <h4 className="font-semibold text-gray-700">{title}</h4>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-sm text-gray-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        )}
      </div>
      <div>
        {words.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No words in this category yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedWords.map(word => (
              <WordProgressRow
                key={word.id}
                word={word}
                state={state}
                onClick={onWordClick}
              />
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
  const [expandedCategory, setExpandedCategory] = useState<WordState>('learning');

  // Only count active words
  const activeWords = words.filter(w => w.isActive !== false);
  const categorized = categorizeWordsByState(activeWords);

  // Sort each category alphabetically
  const learning = [...categorized.learning].sort((a, b) => a.text.localeCompare(b.text));
  const review = [...categorized.review].sort((a, b) => a.text.localeCompare(b.text));
  const mastered = [...categorized.mastered].sort((a, b) => a.text.localeCompare(b.text));

  const total = learning.length + review.length + mastered.length;
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-2">My Progress</h3>
        <p className="text-gray-500 text-sm">Start practicing to see your progress here!</p>
      </div>
    );
  }

  const categories = [
    {
      state: 'learning' as WordState,
      label: 'Learning',
      count: learning.length,
      words: learning,
      lightColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      icon: <BookOpen size={16} />,
    },
    {
      state: 'review' as WordState,
      label: 'Reviewing',
      count: review.length,
      words: review,
      lightColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      icon: <Sparkles size={16} />,
    },
    {
      state: 'mastered' as WordState,
      label: 'Mastered',
      count: mastered.length,
      words: mastered,
      lightColor: 'bg-green-100',
      textColor: 'text-green-600',
      icon: <Star size={16} />,
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-4">My Progress</h3>

      {/* Category buttons */}
      <div className="grid grid-cols-3 gap-3">
        {categories.map(cat => (
          <button
            key={cat.state}
            onClick={() => setExpandedCategory(cat.state)}
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
      <CategoryView
        title={categories.find(c => c.state === expandedCategory)?.label || ''}
        words={categories.find(c => c.state === expandedCategory)?.words || []}
        state={expandedCategory}
        onWordClick={onWordClick}
      />
    </div>
  );
}
