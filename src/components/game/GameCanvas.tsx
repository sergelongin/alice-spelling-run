import { PlayerSprite } from './PlayerSprite';
import { LionSprite } from './LionSprite';

interface GameCanvasProps {
  timeRemaining: number;
  maxTime: number;
  isRunning: boolean;
  gameOver?: boolean;
}

export function GameCanvas({
  timeRemaining,
  maxTime,
  isRunning,
  gameOver = false,
}: GameCanvasProps) {
  // Calculate lion position based on time
  // At maxTime (30s): lion starts FAR away (at 5% from left)
  // At 0s: lion catches up to player (at ~65% from left, player is at 70%)
  // The lion moves from left to right as time decreases
  const timeElapsed = maxTime - timeRemaining;
  const progress = timeElapsed / maxTime; // 0 at start, 1 at end

  // Lion starts at 5% and moves to 65% (close to player at 70%)
  const lionLeftPosition = 5 + progress * 60;

  // For display: how far the lion is from catching the player (percentage)
  const lionDistanceFromPlayer = Math.round((timeRemaining / maxTime) * 100);

  return (
    <div className="relative h-48 overflow-hidden rounded-lg game-canvas">
      {/* Sky gradient is in the background */}

      {/* Clouds */}
      <div className="absolute top-4 left-0 w-full">
        <div
          className="absolute w-16 h-6 bg-white rounded-full opacity-80"
          style={{
            animation: isRunning
              ? 'cloudMove 20s linear infinite'
              : 'none',
            left: '10%',
          }}
        />
        <div
          className="absolute w-20 h-8 bg-white rounded-full opacity-70"
          style={{
            animation: isRunning
              ? 'cloudMove 25s linear infinite 5s'
              : 'none',
            left: '50%',
          }}
        />
        <div
          className="absolute w-12 h-5 bg-white rounded-full opacity-60"
          style={{
            animation: isRunning
              ? 'cloudMove 18s linear infinite 10s'
              : 'none',
            left: '80%',
          }}
        />
      </div>

      {/* Sun */}
      <div className="absolute top-4 right-8 w-12 h-12 bg-yellow-300 rounded-full shadow-lg shadow-yellow-200">
        <div className="absolute inset-1 bg-yellow-200 rounded-full" />
      </div>

      {/* Ground */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-700 to-green-500 ${
          isRunning ? 'ground-scroll' : ''
        }`}
        style={{
          backgroundImage: isRunning
            ? 'repeating-linear-gradient(90deg, #228B22 0px, #228B22 20px, #1E7B1E 20px, #1E7B1E 40px)'
            : undefined,
        }}
      >
        {/* Grass tufts */}
        <div className="absolute top-0 left-0 w-full h-2 flex justify-around">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 h-2 bg-green-400 rounded-t-full"
              style={{ transform: `rotate(${(i % 2 === 0 ? 1 : -1) * 10}deg)` }}
            />
          ))}
        </div>
      </div>

      {/* Player - fixed position on the right side */}
      <div
        className="absolute bottom-16 transition-transform"
        style={{ left: '70%' }}
      >
        <PlayerSprite isRunning={isRunning} />
      </div>

      {/* Lion - position based on timer */}
      <div
        className="absolute bottom-14 transition-all duration-1000 ease-linear"
        style={{
          left: `${lionLeftPosition}%`,
        }}
      >
        <LionSprite isRunning={isRunning} isCatching={gameOver} />
      </div>

      {/* Distance indicator */}
      {!gameOver && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          Lion is {lionDistanceFromPlayer}% away
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
          <div className="text-white text-2xl font-bold animate-bounce">
            Oh no! The lion caught you!
          </div>
        </div>
      )}

      <style>{`
        @keyframes cloudMove {
          from { transform: translateX(100vw); }
          to { transform: translateX(-100px); }
        }
      `}</style>
    </div>
  );
}
