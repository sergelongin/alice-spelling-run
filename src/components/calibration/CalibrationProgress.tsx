import { Map, Star } from 'lucide-react';

interface CalibrationProgressProps {
  progress: number; // 0-100
  wordsCompleted: number;
  maxWords: number;
}

export function CalibrationProgress({
  progress,
  wordsCompleted,
  maxWords,
}: CalibrationProgressProps) {
  // Create territory markers based on progress
  const territories = [
    { position: 0, label: 'Start', unlocked: true },
    { position: 25, label: 'Forest', unlocked: progress >= 25 },
    { position: 50, label: 'River', unlocked: progress >= 50 },
    { position: 75, label: 'Mountain', unlocked: progress >= 75 },
    { position: 100, label: 'Castle', unlocked: progress >= 100 },
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-amber-700">
          <Map size={18} />
          <span className="text-sm font-medium">Your Journey</span>
        </div>
        <span className="text-sm text-gray-500">
          {wordsCompleted} / {maxWords} words
        </span>
      </div>

      {/* Progress track */}
      <div className="relative h-16">
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full">
          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        {/* Territory markers */}
        {territories.map((territory) => (
          <div
            key={territory.position}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${territory.position}%` }}
          >
            {/* Marker */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                territory.unlocked
                  ? 'bg-amber-500 text-white scale-110'
                  : 'bg-gray-300 text-gray-500'
              }`}
            >
              {territory.unlocked ? (
                <Star size={14} className="fill-current" />
              ) : (
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
              )}
            </div>

            {/* Label */}
            <span
              className={`absolute -bottom-6 text-xs whitespace-nowrap transition-colors ${
                territory.unlocked ? 'text-amber-700 font-medium' : 'text-gray-400'
              }`}
            >
              {territory.label}
            </span>
          </div>
        ))}

        {/* Current position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out"
          style={{ left: `${Math.min(100, progress)}%` }}
        >
          <div className="w-4 h-4 bg-orange-600 rounded-full border-2 border-white shadow-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
