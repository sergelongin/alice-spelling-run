import { PlayerSprite } from '@/components/game/PlayerSprite';
import { LionSprite } from '@/components/game/LionSprite';

interface HomeCharacterSceneProps {
  mood?: 'tense' | 'ready' | 'relaxed';
  showSpeechBubble?: boolean;
  speechText?: string;
}

export function HomeCharacterScene({
  mood = 'tense',
  showSpeechBubble = false,
  speechText,
}: HomeCharacterSceneProps) {
  // Position lion based on mood
  const lionPosition = mood === 'relaxed' ? '5%' : mood === 'ready' ? '15%' : '20%';

  return (
    <div className="relative w-full h-40 mb-4">
      {/* Lion on the left - prowling */}
      <div
        className="absolute bottom-8 lion-prowl"
        style={{ left: lionPosition }}
      >
        <div className="transform scale-90">
          <LionSprite isRunning={true} isCatching={false} />
        </div>
      </div>

      {/* Alice on the right */}
      <div className="absolute bottom-8 right-[20%]">
        <div className="relative">
          <PlayerSprite isRunning={false} />

          {/* Speech bubble - positioned to the left of Alice */}
          {showSpeechBubble && speechText && (
            <div className="absolute -top-12 right-full mr-2 bg-white rounded-2xl px-4 py-2 shadow-lg border-2 border-amber-200 whitespace-nowrap animate-fade-in">
              {/* Speech bubble tail pointing right */}
              <div className="absolute top-4 -right-2 w-4 h-4 bg-white border-r-2 border-t-2 border-amber-200 transform rotate-45" />
              <p className="text-sm text-gray-700 font-medium relative z-10">
                {speechText}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes lion-prowl {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(15px); }
        }
        .lion-prowl {
          animation: lion-prowl 3s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
