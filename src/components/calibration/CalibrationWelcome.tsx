import { Sparkles, ChevronRight } from 'lucide-react';
import { PlayerSprite } from '@/components/game/PlayerSprite';
import { LionSprite } from '@/components/game/LionSprite';

interface CalibrationWelcomeProps {
  onStart: () => void;
  onSkip: () => void;
}

export function CalibrationWelcome({ onStart, onSkip }: CalibrationWelcomeProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-screen bg-gradient-to-b from-orange-100 via-amber-50 to-sky-100">
      {/* Character scene */}
      <div className="relative w-full max-w-lg h-40 mb-8">
        {/* Lion on the left */}
        <div className="absolute left-8 bottom-0 transform scale-75">
          <LionSprite isRunning={true} isCatching={false} />
        </div>

        {/* Alice on the right */}
        <div className="absolute right-16 bottom-0">
          <PlayerSprite isRunning={false} />
        </div>

        {/* Speech bubble from Alice */}
        <div className="absolute right-4 top-0 bg-white rounded-2xl px-4 py-2 shadow-lg border-2 border-amber-200 max-w-[180px]">
          <div className="absolute -bottom-2 right-12 w-4 h-4 bg-white border-r-2 border-b-2 border-amber-200 transform rotate-45" />
          <p className="text-sm text-gray-700 font-medium relative z-10">
            Help! I need to know how well you can spell!
          </p>
        </div>
      </div>

      {/* Story introduction */}
      <div className="max-w-md text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
          <Sparkles className="text-amber-500" size={28} />
          Meet Alice!
          <Sparkles className="text-amber-500" size={28} />
        </h1>

        <div className="space-y-4 text-gray-600">
          <p className="text-lg">
            Alice loves exploring the savannah, but there's one problem...
          </p>
          <p className="text-lg font-semibold text-amber-700">
            A hungry lion is always chasing her!
          </p>
          <p className="text-lg">
            The only way Alice can escape is by <span className="font-bold text-blue-600">spelling words correctly</span>.
            Each right answer makes her run faster!
          </p>
        </div>
      </div>

      {/* Discovery message */}
      <div className="bg-white/80 backdrop-blur rounded-xl p-6 max-w-md mb-8 shadow-lg border border-amber-200">
        <p className="text-gray-700 text-center">
          Before we start, let's discover your <span className="font-bold text-purple-600">spelling superpower level</span>!
          <br />
          <span className="text-sm text-gray-500 mt-2 block">
            This quick adventure will help us pick the perfect words for you.
          </span>
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={onStart}
          className="group flex items-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Start Adventure
          <ChevronRight className="group-hover:translate-x-1 transition-transform" size={24} />
        </button>

        <button
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700 text-sm underline underline-offset-2 transition-colors"
        >
          I already know my level
        </button>
      </div>
    </div>
  );
}
