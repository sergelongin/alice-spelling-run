interface PlayerSpriteProps {
  isRunning: boolean;
}

export function PlayerSprite({ isRunning }: PlayerSpriteProps) {
  // Using CSS placeholder animation until real sprites are added
  return (
    <div className="relative">
      {/* Character body */}
      <div
        className={`w-16 h-20 relative ${isRunning ? '' : ''}`}
        style={{ transform: 'scaleX(-1)' }} // Face right (away from lion)
      >
        {/* Head */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 border-2 border-amber-400">
          {/* Hair */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-6 bg-gradient-to-b from-amber-600 to-amber-700 rounded-t-full" />
          {/* Face */}
          <div className="absolute top-3 left-2 w-1.5 h-1.5 bg-gray-800 rounded-full" />
          <div className="absolute top-3 right-2 w-1.5 h-1.5 bg-gray-800 rounded-full" />
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2 h-1 bg-pink-400 rounded-full" />
        </div>

        {/* Body */}
        <div className="absolute top-9 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-b from-blue-400 to-blue-500 rounded-lg border border-blue-600" />

        {/* Legs - animated when running */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1">
          <div
            className={`w-2.5 h-6 bg-gray-700 rounded-full origin-top ${
              isRunning ? 'animate-[leg-left_0.3s_ease-in-out_infinite]' : ''
            }`}
            style={{
              animation: isRunning
                ? 'legLeft 0.3s ease-in-out infinite'
                : 'none',
            }}
          />
          <div
            className={`w-2.5 h-6 bg-gray-700 rounded-full origin-top ${
              isRunning ? 'animate-[leg-right_0.3s_ease-in-out_infinite_0.15s]' : ''
            }`}
            style={{
              animation: isRunning
                ? 'legRight 0.3s ease-in-out infinite 0.15s'
                : 'none',
            }}
          />
        </div>

        {/* Arms - animated when running */}
        <div className="absolute top-10 left-0 w-2 h-5 bg-amber-200 rounded-full origin-top"
          style={{
            animation: isRunning
              ? 'armSwing 0.3s ease-in-out infinite'
              : 'none',
            transform: 'rotate(-20deg)',
          }}
        />
        <div className="absolute top-10 right-0 w-2 h-5 bg-amber-200 rounded-full origin-top"
          style={{
            animation: isRunning
              ? 'armSwing 0.3s ease-in-out infinite 0.15s'
              : 'none',
            transform: 'rotate(20deg)',
          }}
        />
      </div>

      {/* Running dust effect */}
      {isRunning && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-amber-200/60 rounded-full animate-ping" style={{ animationDuration: '0.5s' }} />
            <div className="w-1.5 h-1.5 bg-amber-200/40 rounded-full animate-ping" style={{ animationDuration: '0.7s', animationDelay: '0.1s' }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes legLeft {
          0%, 100% { transform: rotate(-25deg); }
          50% { transform: rotate(25deg); }
        }
        @keyframes legRight {
          0%, 100% { transform: rotate(25deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes armSwing {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
      `}</style>
    </div>
  );
}
