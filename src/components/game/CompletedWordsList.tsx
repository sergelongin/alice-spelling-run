import { Check } from 'lucide-react';
import { CompletedWord } from '@/types';

interface CompletedWordsListProps {
  words: CompletedWord[];
  currentWordNumber: number;
  totalWords: number;
}

export function CompletedWordsList({
  words,
  currentWordNumber,
  totalWords,
}: CompletedWordsListProps) {
  return (
    <div className="bg-white/90 rounded-lg p-4 min-w-[180px]">
      <h3 className="font-bold text-gray-800 mb-3 text-center">
        Progress: {currentWordNumber}/{totalWords}
      </h3>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {words.length === 0 ? (
          <p className="text-gray-400 text-sm text-center italic">
            No words completed yet
          </p>
        ) : (
          words.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-2 py-1 bg-green-50 rounded border border-green-200"
            >
              <Check size={16} className="text-green-500 flex-shrink-0" />
              <span className="text-green-800 font-medium capitalize">
                {word.word}
              </span>
              {word.attempts > 1 && (
                <span className="text-xs text-gray-400 ml-auto">
                  ({word.attempts} tries)
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
