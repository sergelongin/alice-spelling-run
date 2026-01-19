import { Volume2, Star } from 'lucide-react';
import { Word } from '@/types';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface StarWordsShowcaseProps {
  words: Word[];
}

/**
 * Showcase of recently mastered words with celebratory star animations.
 * Tap to hear pronunciation.
 */
export function StarWordsShowcase({ words }: StarWordsShowcaseProps) {
  const { speak, isSpeaking } = useTextToSpeech();

  if (words.length === 0) {
    return null;
  }

  const handleWordClick = (word: Word) => {
    speak(word.text);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 shadow-sm border border-amber-100">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
        My Star Words
        <span className="text-sm font-normal text-gray-500 ml-1">(recently mastered)</span>
      </h3>

      <div className="flex flex-wrap gap-3">
        {words.map((word, index) => (
          <button
            key={word.id}
            onClick={() => handleWordClick(word)}
            disabled={isSpeaking}
            className="group relative px-4 py-2 bg-white rounded-full shadow-sm border border-amber-200
                     hover:shadow-md hover:border-amber-300 hover:scale-105 active:scale-100
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <span className="text-gray-700 font-medium capitalize">{word.text}</span>

            {/* Star decoration */}
            <Star
              className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 fill-amber-400
                       animate-pulse group-hover:animate-spin"
              style={{ animationDuration: '2s' }}
            />

            {/* Speaker icon on hover */}
            <Volume2
              className="absolute -bottom-1 -right-1 w-4 h-4 text-gray-400 opacity-0
                       group-hover:opacity-100 transition-opacity"
            />

            {/* Sparkle effects on hover */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
              <div className="absolute top-0 left-1/4 w-1 h-1 bg-amber-400 rounded-full opacity-0
                            group-hover:opacity-100 group-hover:animate-ping" />
              <div className="absolute bottom-1 right-1/4 w-1 h-1 bg-amber-300 rounded-full opacity-0
                            group-hover:opacity-100 group-hover:animate-ping"
                   style={{ animationDelay: '150ms' }} />
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-amber-600/70 mt-4 flex items-center gap-1">
        <Volume2 size={12} />
        Tap a word to hear it
      </p>
    </div>
  );
}
