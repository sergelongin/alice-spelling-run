import { Heart } from 'lucide-react';

interface LivesDisplayProps {
  currentLives: number;
  maxLives: number;
  recentlyLost?: boolean;
}

export function LivesDisplay({
  currentLives,
  maxLives,
  recentlyLost = false,
}: LivesDisplayProps) {
  const hearts = [];

  for (let i = 0; i < maxLives; i++) {
    const isFilled = i < currentLives;
    const isBreaking = recentlyLost && i === currentLives;

    hearts.push(
      <Heart
        key={i}
        size={32}
        className={`transition-all duration-200 ${
          isFilled
            ? 'text-red-500 fill-red-500'
            : 'text-gray-300'
        } ${isBreaking ? 'heart-breaking' : ''}`}
      />
    );
  }

  return (
    <div className="flex items-center gap-1 bg-white/80 px-4 py-2 rounded-lg">
      {hearts}
    </div>
  );
}
