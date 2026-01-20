import { Volume2, Star } from 'lucide-react';
import { Word } from '@/types';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

interface StarWordsShowcaseProps {
  words: Word[];
  variant?: 'default' | 'sidebar';
}

/**
 * Showcase of recently mastered words with celebratory star animations.
 * Tap to hear pronunciation.
 */
export function StarWordsShowcase({ words, variant = 'default' }: StarWordsShowcaseProps) {
  const { speak, isSpeaking } = useTextToSpeech();

  if (words.length === 0) {
    return null;
  }

  const handleWordClick = (word: Word) => {
    speak(word.text);
  };

  const isSidebar = variant === 'sidebar';

  return (
    <div className={`bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-sm border border-amber-100 ${isSidebar ? 'p-4' : 'p-6'}`}>
      <h3 className={`font-bold text-gray-800 flex items-center gap-2 ${isSidebar ? 'text-base mb-3' : 'text-lg mb-4'}`}>
        <Star className={`text-amber-500 fill-amber-500 ${isSidebar ? 'w-4 h-4' : 'w-5 h-5'}`} />
        {isSidebar ? 'Star Words' : 'My Star Words'}
        {!isSidebar && <span className="text-sm font-normal text-gray-500 ml-1">(recently mastered)</span>}
      </h3>

      <div className={isSidebar ? 'flex flex-col gap-2' : 'flex flex-wrap gap-3'}>
        {words.map((word, index) => (
          <button
            key={word.id}
            onClick={() => handleWordClick(word)}
            disabled={isSpeaking}
            className={`group relative bg-white rounded-full shadow-sm border border-amber-200
                     hover:shadow-md hover:border-amber-300 hover:scale-105 active:scale-100
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     ${isSidebar ? 'px-3 py-1.5 text-left' : 'px-4 py-2'}`}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            <span className={`text-gray-700 font-medium capitalize ${isSidebar ? 'text-sm' : ''}`}>{word.text}</span>

            {/* Star decoration */}
            <Star
              className={`absolute -top-1 -right-1 text-amber-400 fill-amber-400
                       animate-pulse group-hover:animate-spin ${isSidebar ? 'w-3 h-3' : 'w-4 h-4'}`}
              style={{ animationDuration: '2s' }}
            />

            {/* Speaker icon on hover */}
            <Volume2
              className={`absolute -bottom-1 -right-1 text-gray-400 opacity-0
                       group-hover:opacity-100 transition-opacity ${isSidebar ? 'w-3 h-3' : 'w-4 h-4'}`}
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

      <p className={`text-amber-600/70 flex items-center gap-1 ${isSidebar ? 'text-[10px] mt-3' : 'text-xs mt-4'}`}>
        <Volume2 size={isSidebar ? 10 : 12} />
        Tap a word to hear it
      </p>
    </div>
  );
}
