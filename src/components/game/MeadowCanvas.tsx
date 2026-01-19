import { PlayerSprite } from './PlayerSprite';

interface MeadowCanvasProps {
  isActive: boolean;
}

export function MeadowCanvas({ isActive }: MeadowCanvasProps) {
  return (
    <div className="relative h-48 overflow-hidden rounded-lg meadow-canvas">
      {/* Sky - soft blue gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-green-100" />

      {/* Soft clouds */}
      <div className="absolute top-4 left-0 w-full">
        <div
          className="absolute w-20 h-8 bg-white rounded-full opacity-70"
          style={{
            animation: isActive ? 'cloudDrift 40s linear infinite' : 'none',
            left: '15%',
          }}
        />
        <div
          className="absolute w-24 h-10 bg-white rounded-full opacity-60"
          style={{
            animation: isActive ? 'cloudDrift 50s linear infinite 10s' : 'none',
            left: '55%',
          }}
        />
        <div
          className="absolute w-16 h-6 bg-white rounded-full opacity-50"
          style={{
            animation: isActive ? 'cloudDrift 35s linear infinite 20s' : 'none',
            left: '80%',
          }}
        />
      </div>

      {/* Sun with soft glow */}
      <div className="absolute top-6 right-12 w-14 h-14 bg-yellow-200 rounded-full shadow-lg shadow-yellow-100">
        <div className="absolute inset-2 bg-yellow-100 rounded-full opacity-80" />
      </div>

      {/* Meadow ground - soft green gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-green-400 to-green-300">
        {/* Grass texture */}
        <div className="absolute top-0 left-0 w-full h-3 flex justify-around">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-500 rounded-t-full"
              style={{
                height: `${8 + Math.random() * 8}px`,
                transform: `rotate(${(i % 3 - 1) * 8}deg)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Flowers scattered in meadow */}
      <div className="absolute bottom-12 left-0 w-full">
        {/* Pink flowers */}
        <div className="absolute left-[10%] bottom-0">
          <Flower color="pink" />
        </div>
        <div className="absolute left-[25%] bottom-2">
          <Flower color="pink" small />
        </div>
        <div className="absolute left-[45%] bottom-1">
          <Flower color="yellow" />
        </div>
        <div className="absolute left-[60%] bottom-0">
          <Flower color="purple" />
        </div>
        <div className="absolute left-[75%] bottom-2">
          <Flower color="yellow" small />
        </div>
        <div className="absolute left-[85%] bottom-0">
          <Flower color="pink" />
        </div>
      </div>

      {/* Butterflies */}
      <div className="absolute top-20 left-[20%]">
        <Butterfly color="blue" isActive={isActive} delay={0} />
      </div>
      <div className="absolute top-16 left-[60%]">
        <Butterfly color="orange" isActive={isActive} delay={2} />
      </div>
      <div className="absolute top-24 left-[40%]">
        <Butterfly color="pink" isActive={isActive} delay={4} />
      </div>

      {/* Player - standing calmly in the middle */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
        <PlayerSprite isRunning={false} />
      </div>

      {/* Peaceful message */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/70 text-green-700 px-4 py-1 rounded-full text-sm font-medium">
        Practice at your own pace
      </div>

      <style>{`
        @keyframes cloudDrift {
          from { transform: translateX(100vw); }
          to { transform: translateX(-150px); }
        }
        @keyframes butterflyFloat {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(10px, -8px) rotate(5deg); }
          50% { transform: translate(20px, 0) rotate(0deg); }
          75% { transform: translate(10px, 8px) rotate(-5deg); }
        }
        @keyframes wingFlap {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(0.3); }
        }
      `}</style>
    </div>
  );
}

// Flower component
function Flower({ color, small = false }: { color: 'pink' | 'yellow' | 'purple'; small?: boolean }) {
  const colorMap = {
    pink: 'bg-pink-400',
    yellow: 'bg-yellow-400',
    purple: 'bg-purple-400',
  };

  const size = small ? 'w-3 h-3' : 'w-4 h-4';
  const petalSize = small ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const stemHeight = small ? 'h-4' : 'h-6';

  return (
    <div className="relative">
      {/* Stem */}
      <div className={`w-0.5 ${stemHeight} bg-green-600 mx-auto`} />
      {/* Flower head */}
      <div className={`absolute -top-1 left-1/2 -translate-x-1/2 ${size} flex items-center justify-center`}>
        {/* Petals */}
        <div className={`absolute ${petalSize} ${colorMap[color]} rounded-full -top-1`} />
        <div className={`absolute ${petalSize} ${colorMap[color]} rounded-full -bottom-1`} />
        <div className={`absolute ${petalSize} ${colorMap[color]} rounded-full -left-1`} />
        <div className={`absolute ${petalSize} ${colorMap[color]} rounded-full -right-1`} />
        {/* Center */}
        <div className="w-2 h-2 bg-yellow-300 rounded-full z-10" />
      </div>
    </div>
  );
}

// Butterfly component
function Butterfly({
  color,
  isActive,
  delay,
}: {
  color: 'blue' | 'orange' | 'pink';
  isActive: boolean;
  delay: number;
}) {
  const colorMap = {
    blue: 'bg-blue-400',
    orange: 'bg-orange-400',
    pink: 'bg-pink-400',
  };

  return (
    <div
      className="relative"
      style={{
        animation: isActive ? `butterflyFloat 4s ease-in-out infinite ${delay}s` : 'none',
      }}
    >
      {/* Left wing */}
      <div
        className={`absolute w-3 h-4 ${colorMap[color]} rounded-full -left-2 top-0 origin-right`}
        style={{
          animation: isActive ? 'wingFlap 0.3s ease-in-out infinite' : 'none',
        }}
      />
      {/* Right wing */}
      <div
        className={`absolute w-3 h-4 ${colorMap[color]} rounded-full left-0 top-0 origin-left`}
        style={{
          animation: isActive ? 'wingFlap 0.3s ease-in-out infinite' : 'none',
        }}
      />
      {/* Body */}
      <div className="absolute w-1 h-4 bg-gray-800 rounded-full left-0 top-0" />
    </div>
  );
}
