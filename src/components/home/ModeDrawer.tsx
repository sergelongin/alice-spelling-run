import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Flower2, Trophy } from 'lucide-react';
import { GameModeId } from '@/types';

interface ModeOption {
  id: GameModeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}

const MODES: ModeOption[] = [
  {
    id: 'savannah',
    name: 'Full Adventure',
    description: '20 words - The complete challenge',
    icon: <Zap size={20} />,
    color: 'amber',
    features: ['20 words', '30s timer', 'Trophies'],
  },
  {
    id: 'meadow',
    name: 'Practice Meadow',
    description: 'No timer, helpful hints',
    icon: <Flower2 size={20} />,
    color: 'green',
    features: ['No timer', 'Hints', 'Relaxed'],
  },
  {
    id: 'wildlands',
    name: 'Wildlands League',
    description: 'Daily & weekly challenges',
    icon: <Trophy size={20} />,
    color: 'purple',
    features: ['Compete', 'Daily', 'Leaderboards'],
  },
];

interface ModeDrawerProps {
  onSelectMode: (mode: GameModeId) => void;
  disabled?: boolean;
}

export function ModeDrawer({ onSelectMode, disabled = false }: ModeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const colorClasses: Record<string, { bg: string; hover: string; text: string; border: string }> = {
    amber: {
      bg: 'bg-amber-50',
      hover: 'hover:bg-amber-100',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
    green: {
      bg: 'bg-green-50',
      hover: 'hover:bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200',
    },
    purple: {
      bg: 'bg-purple-50',
      hover: 'hover:bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200',
    },
  };

  return (
    <div className="w-full max-w-md">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 py-2 transition-colors"
      >
        <span className="text-sm">More Adventures</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="mt-2 space-y-2 animate-slide-down">
          {MODES.map((mode) => {
            const colors = colorClasses[mode.color];
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                disabled={disabled}
                className={`
                  w-full p-3 rounded-xl text-left transition-all duration-200
                  ${colors.bg} ${colors.hover} ${colors.border} border
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:scale-[1.02] active:scale-[0.98]
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`${colors.text} mt-0.5`}>{mode.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{mode.name}</div>
                    <div className="text-xs text-gray-500">{mode.description}</div>
                    <div className="flex gap-2 mt-1">
                      {mode.features.map((feature, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
