interface LionSpriteProps {
  isRunning: boolean;
  isCatching?: boolean;
}

export function LionSprite({ isRunning, isCatching = false }: LionSpriteProps) {
  return (
    <div className={`relative ${isCatching ? 'lion-pounce' : ''}`}>
      {/* Lion body - flipped to face right (chasing direction) */}
      <div className="w-24 h-20 relative" style={{ transform: 'scaleX(-1)' }}>

        {/* Tail - furthest back */}
        <div
          className="absolute top-6 -right-4 w-10 h-2 bg-amber-500 rounded-full origin-left z-0"
          style={{
            animation: isRunning ? 'tailWag 0.4s ease-in-out infinite' : 'none',
          }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-700 rounded-full" />
        </div>

        {/* Back legs - behind body */}
        <div className="absolute bottom-0 left-14 flex gap-2 z-10">
          <div
            className="w-3 h-8 bg-amber-500 rounded-b-lg origin-top"
            style={{
              animation: isRunning ? 'lionLegBack 0.25s ease-in-out infinite' : 'none',
            }}
          />
          <div
            className="w-3 h-8 bg-amber-500 rounded-b-lg origin-top"
            style={{
              animation: isRunning ? 'lionLegBack 0.25s ease-in-out infinite 0.125s' : 'none',
            }}
          />
        </div>

        {/* Body - behind mane */}
        <div className="absolute top-5 left-8 w-16 h-12 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl z-20" />

        {/* Mane - behind head */}
        <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full z-30" />

        {/* Head - in front */}
        <div className="absolute top-2 left-2 w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full z-50">
          {/* Ears */}
          <div className="absolute -top-1 left-1 w-3 h-3 bg-amber-600 rounded-full" />
          <div className="absolute -top-1 right-1 w-3 h-3 bg-amber-600 rounded-full" />

          {/* Eyes */}
          <div className="absolute top-3 left-2 w-2.5 h-2.5 bg-yellow-300 rounded-full border border-amber-700">
            <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-gray-900 rounded-full" />
          </div>
          <div className="absolute top-3 right-2 w-2.5 h-2.5 bg-yellow-300 rounded-full border border-amber-700">
            <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-gray-900 rounded-full" />
          </div>

          {/* Nose */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-3 h-2 bg-amber-800 rounded-full" />

          {/* Mouth - open when catching */}
          <div
            className={`absolute top-8 left-1/2 -translate-x-1/2 bg-red-600 rounded-b-lg transition-all ${
              isCatching ? 'w-4 h-3' : 'w-2 h-1'
            }`}
          >
            {isCatching && (
              <>
                <div className="absolute -top-0.5 left-0.5 w-1 h-1 bg-white rotate-45" />
                <div className="absolute -top-0.5 right-0.5 w-1 h-1 bg-white -rotate-45" />
              </>
            )}
          </div>
        </div>

        {/* Front legs - in front of body */}
        <div className="absolute bottom-0 left-6 flex gap-2 z-40">
          <div
            className="w-3 h-8 bg-amber-400 rounded-b-lg origin-top"
            style={{
              animation: isRunning ? 'lionLegFront 0.25s ease-in-out infinite' : 'none',
            }}
          />
          <div
            className="w-3 h-8 bg-amber-400 rounded-b-lg origin-top"
            style={{
              animation: isRunning ? 'lionLegFront 0.25s ease-in-out infinite 0.125s' : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes tailWag {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes lionLegFront {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
        @keyframes lionLegBack {
          0%, 100% { transform: rotate(30deg); }
          50% { transform: rotate(-30deg); }
        }
      `}</style>
    </div>
  );
}
