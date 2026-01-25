import { useNavigate } from 'react-router-dom';
import { Word } from '@/types';
import { categorizeWordsByState } from '@/utils/wordSelection';

interface CompactProgressBarProps {
  words: Word[];
}

/**
 * Compact horizontal progress bar showing Learning/Reviewing/Mastered word counts.
 * Tappable to navigate to the full Word Bank view.
 */
export function CompactProgressBar({ words }: CompactProgressBarProps) {
  const navigate = useNavigate();

  const activeWords = words.filter(w => w.isActive !== false);
  const { learning, review, mastered } = categorizeWordsByState(activeWords);

  const total = learning.length + review.length + mastered.length;
  if (total === 0) return null;

  const learningPercent = (learning.length / total) * 100;
  const reviewPercent = (review.length / total) * 100;
  const masteredPercent = (mastered.length / total) * 100;

  return (
    <button
      onClick={() => navigate('/word-bank')}
      className="w-full bg-white/60 backdrop-blur rounded-lg p-2
                 hover:bg-white/80 transition-all active:scale-[0.99]"
    >
      {/* Progress bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex mb-2">
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

      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-orange-600 font-medium">
          {learning.length} learning
        </span>
        <span className="text-blue-600 font-medium">
          {review.length} reviewing
        </span>
        <span className="text-green-600 font-medium">
          {mastered.length} mastered
        </span>
      </div>
    </button>
  );
}
