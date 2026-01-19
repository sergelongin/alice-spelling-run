import { Timer } from 'lucide-react';

interface TimerDisplayProps {
  timeRemaining: number;
  maxTime: number;
}

export function TimerDisplay({ timeRemaining, maxTime }: TimerDisplayProps) {
  const percentage = (timeRemaining / maxTime) * 100;
  const isWarning = timeRemaining <= 10 && timeRemaining > 5;
  const isCritical = timeRemaining <= 5;

  let timerClass = 'flex items-center gap-3 px-4 py-2 rounded-lg ';
  let barColor = 'bg-green-500';
  let textColor = 'text-gray-800';

  if (isCritical) {
    timerClass += 'timer-critical bg-red-100';
    barColor = 'bg-red-500';
    textColor = 'text-red-600';
  } else if (isWarning) {
    timerClass += 'timer-warning bg-yellow-100';
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  } else {
    timerClass += 'bg-white/80';
  }

  return (
    <div className={timerClass}>
      <Timer className={textColor} size={24} />

      <div className="flex-1">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <span className={`font-bold text-xl min-w-[3ch] text-right ${textColor}`}>
        {timeRemaining}s
      </span>
    </div>
  );
}
