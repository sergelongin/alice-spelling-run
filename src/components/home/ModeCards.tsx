import { Zap } from 'lucide-react';
import { GameModeId } from '@/types';

interface ModeCardsProps {
  onSelectMode: (mode: GameModeId) => void;
  disabled?: boolean;
}

const MODES = [
  {
    id: 'savannah' as GameModeId,
    name: 'Chase Mode',
    subtitle: 'Race the lion!',
    icon: <Zap size={24} className="text-white" />,
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
  },
];

/**
 * Secondary mode selection card (Chase Mode only).
 * Kid-friendly design with gradient background and decorative elements.
 */
export function ModeCards({ onSelectMode, disabled = false }: ModeCardsProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {MODES.map(mode => (
        <button
          key={mode.id}
          onClick={() => onSelectMode(mode.id)}
          disabled={disabled}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${mode.gradient} p-4 shadow-md w-full
                     transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
        >
          {/* Decorative circles */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full" />
          <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-white/10 rounded-full" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              {mode.icon}
            </div>
            <div className="text-left">
              <div className="font-bold text-white drop-shadow-sm">{mode.name}</div>
              <div className="text-sm text-white/80 drop-shadow-sm">{mode.subtitle}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
