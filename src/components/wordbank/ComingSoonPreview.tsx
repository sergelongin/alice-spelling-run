import { Hourglass } from 'lucide-react';
import { Word } from '@/types';

interface ComingSoonPreviewProps {
  words: Word[];
  maxPreview?: number;
}

/**
 * Child-friendly preview card showing words waiting to be introduced.
 * Displays in the child's word bank view to show upcoming words in the queue.
 */
export function ComingSoonPreview({ words, maxPreview = 3 }: ComingSoonPreviewProps) {
  if (words.length === 0) return null;

  const previewWords = words.slice(0, maxPreview);
  const remainingCount = words.length - previewWords.length;

  return (
    <div className="bg-violet-50 rounded-xl p-5 shadow-sm border border-violet-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Hourglass size={18} className="text-violet-600" />
        </div>
        <h3 className="text-lg font-bold text-violet-800">Coming Soon</h3>
      </div>

      <p className="text-violet-700 text-sm mb-4">
        {words.length} new word{words.length !== 1 ? 's' : ''} waiting to join your adventure!
      </p>

      {/* Word preview badges */}
      <div className="flex flex-wrap gap-2">
        {previewWords.map(word => (
          <span
            key={word.id}
            className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium capitalize"
          >
            {word.text}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="px-3 py-1 bg-violet-200 text-violet-600 rounded-full text-sm font-medium">
            +{remainingCount} more
          </span>
        )}
      </div>

      <p className="text-violet-500 text-xs mt-3">
        Keep practicing to unlock new words!
      </p>
    </div>
  );
}
