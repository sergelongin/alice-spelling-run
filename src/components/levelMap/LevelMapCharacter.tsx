interface LevelMapCharacterProps {
  position: { x: number; y: number };
}

/**
 * Player character sprite positioned on the level map path
 * Uses the existing Alice character design aesthetic
 */
export function LevelMapCharacter({ position }: LevelMapCharacterProps) {
  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-20"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      {/* Character container with bounce animation */}
      <div className="relative animate-bounce-slow">
        {/* Glow/shadow beneath character */}
        <div className="absolute inset-0 -bottom-2 bg-amber-900/30 rounded-full blur-sm scale-75" />

        {/* Character body - simple adventurer sprite */}
        <div className="relative w-8 h-10 md:w-10 md:h-12">
          {/* Safari hat */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-3 md:w-12 md:h-4 bg-amber-100 rounded-full border-2 border-amber-300" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-4 md:w-7 md:h-5 bg-amber-200 rounded-t-full border-2 border-b-0 border-amber-300" />

          {/* Head */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 md:w-7 md:h-7 bg-amber-100 rounded-full border-2 border-amber-200">
            {/* Eyes */}
            <div className="absolute top-2 left-1 w-1.5 h-1.5 bg-gray-800 rounded-full" />
            <div className="absolute top-2 right-1 w-1.5 h-1.5 bg-gray-800 rounded-full" />
            {/* Smile */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-1 border-b-2 border-gray-800 rounded-b-full" />
          </div>

          {/* Body (safari vest) */}
          <div className="absolute top-5 md:top-6 left-1/2 -translate-x-1/2 w-5 h-5 md:w-6 md:h-6 bg-amber-600 rounded-b-lg border-2 border-amber-700">
            {/* Vest details */}
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-amber-800" />
          </div>
        </div>

        {/* Direction indicator (small arrow showing where they're headed) */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-amber-500 border-y-2 border-y-transparent opacity-70" />
      </div>
    </div>
  );
}
