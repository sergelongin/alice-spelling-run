import { Star, Volume2 } from 'lucide-react';
import { Word } from '@/types';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface CompactStarWordsProps {
  words: Word[];
}

/**
 * Compact horizontal scroll of recently mastered words.
 * Shows on home screen only when there are recently mastered words.
 * Tap to hear pronunciation.
 */
export function CompactStarWords({ words }: CompactStarWordsProps) {
  const { speak, isSpeaking } = useTextToSpeech();

  if (words.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Star size={14} className="text-amber-500 fill-amber-500" />
        <span className="text-xs font-semibold text-gray-600">Recently Mastered</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {words.map(word => (
          <button
            key={word.id}
            onClick={() => speak(word.text)}
            disabled={isSpeaking}
            className="group relative flex-shrink-0 px-3 py-1.5 bg-gradient-to-br from-amber-50 to-yellow-50
                       rounded-full border border-amber-200 shadow-sm
                       hover:shadow-md hover:border-amber-300 hover:scale-105
                       active:scale-100 transition-all disabled:opacity-50"
          >
            <span className="text-sm font-medium text-gray-700 capitalize">{word.text}</span>
            <Star
              size={10}
              className="absolute -top-0.5 -right-0.5 text-amber-400 fill-amber-400 animate-pulse"
              style={{ animationDuration: '2s' }}
            />
            <Volume2
              size={10}
              className="absolute -bottom-0.5 -right-0.5 text-gray-400 opacity-0
                       group-hover:opacity-100 transition-opacity"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
