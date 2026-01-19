interface HomeBackgroundProps {
  children?: React.ReactNode;
}

export function HomeBackground({ children }: HomeBackgroundProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100">
      {/* Animated clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Cloud 1 - large, slow */}
        <div
          className="absolute top-12 w-24 h-10 bg-white rounded-full opacity-80 cloud-drift"
          style={{ animationDuration: '45s', animationDelay: '0s' }}
        />
        <div
          className="absolute top-10 left-4 w-16 h-8 bg-white rounded-full opacity-80 cloud-drift"
          style={{ animationDuration: '45s', animationDelay: '0s' }}
        />

        {/* Cloud 2 - medium */}
        <div
          className="absolute top-20 w-20 h-8 bg-white rounded-full opacity-70 cloud-drift"
          style={{ animationDuration: '35s', animationDelay: '-10s' }}
        />

        {/* Cloud 3 - small, faster */}
        <div
          className="absolute top-8 w-14 h-6 bg-white rounded-full opacity-60 cloud-drift"
          style={{ animationDuration: '30s', animationDelay: '-20s' }}
        />

        {/* Cloud 4 - extra cloud */}
        <div
          className="absolute top-28 w-18 h-7 bg-white rounded-full opacity-65 cloud-drift"
          style={{ animationDuration: '40s', animationDelay: '-5s' }}
        />
      </div>

      {/* Sun */}
      <div className="absolute top-8 right-12 w-20 h-20 pointer-events-none">
        {/* Glow */}
        <div className="absolute inset-0 bg-yellow-200 rounded-full blur-xl opacity-60" />
        {/* Sun body */}
        <div className="absolute inset-2 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full shadow-lg">
          {/* Inner glow */}
          <div className="absolute inset-2 bg-yellow-100 rounded-full opacity-60" />
        </div>
      </div>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400">
        {/* Grass texture */}
        <div className="absolute top-0 left-0 right-0 h-3 flex justify-around items-end">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-600 rounded-t-full"
              style={{
                height: `${8 + (i % 3) * 4}px`,
                transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (5 + (i % 4) * 3)}deg)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style>{`
        @keyframes cloud-drift {
          from { transform: translateX(-150px); }
          to { transform: translateX(calc(100vw + 150px)); }
        }
        .cloud-drift {
          animation: cloud-drift linear infinite;
        }
      `}</style>
    </div>
  );
}
