import { ChevronRight, Sparkles } from 'lucide-react';

interface PlayButtonProps {
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'adventure' | 'calibration' | 'secondary';
  size?: 'normal' | 'large';
}

export function PlayButton({
  label,
  sublabel,
  onClick,
  disabled = false,
  variant = 'adventure',
  size = 'large',
}: PlayButtonProps) {
  const baseStyles = `
    group flex items-center justify-center gap-3
    rounded-2xl font-bold shadow-lg
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
  `;

  const variantStyles = {
    adventure: `
      bg-gradient-to-r from-orange-500 to-amber-500
      hover:from-orange-600 hover:to-amber-600
      text-white
      hover:shadow-xl hover:scale-105 active:scale-95
      play-button-pulse
    `,
    calibration: `
      bg-gradient-to-r from-purple-500 to-indigo-500
      hover:from-purple-600 hover:to-indigo-600
      text-white
      hover:shadow-xl hover:scale-105 active:scale-95
    `,
    secondary: `
      bg-white/80 backdrop-blur
      hover:bg-white
      text-gray-700
      border-2 border-gray-200
      hover:border-gray-300 hover:scale-105 active:scale-95
    `,
  };

  const sizeStyles = {
    normal: 'px-6 py-3 text-lg',
    large: 'px-8 py-4 text-xl',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {variant === 'adventure' && (
        <Sparkles size={size === 'large' ? 24 : 20} className="opacity-80" />
      )}
      <div className="flex flex-col items-center">
        <span>{label}</span>
        {sublabel && (
          <span className="text-xs font-normal opacity-80">{sublabel}</span>
        )}
      </div>
      <ChevronRight
        size={size === 'large' ? 24 : 20}
        className="group-hover:translate-x-1 transition-transform"
      />

      <style>{`
        @keyframes play-button-pulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4); }
          50% { box-shadow: 0 4px 24px rgba(249, 115, 22, 0.6); }
        }
        .play-button-pulse:not(:disabled) {
          animation: play-button-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}
