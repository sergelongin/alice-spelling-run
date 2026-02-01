import { Leaf, Sparkles, Trophy, Check } from 'lucide-react';
import { Button } from '../common';

interface TodaysMissionCardProps {
  dueWordCount: number;
  canIntroduceNew: boolean;
  masteredCount: number;
  totalActiveWords: number;
  onChillPractice: () => void;
  onChaseMode: () => void;
  className?: string;
}

/**
 * Large, colorful card showing today's practice mission with dynamic messaging.
 * Shows two CTA buttons: Chill Practice and Run and Win Trophies.
 */
export function TodaysMissionCard({
  dueWordCount,
  canIntroduceNew,
  masteredCount,
  totalActiveWords,
  onChillPractice,
  onChaseMode,
  className = '',
}: TodaysMissionCardProps) {
  const getMessageAndStyle = () => {
    if (dueWordCount > 0) {
      return {
        title: `${dueWordCount} word${dueWordCount === 1 ? ' is' : 's are'} waiting for you!`,
        subtitle: dueWordCount === 1 ? "Let's master this word!" : "Let's practice and learn!",
        gradient: 'from-amber-400 via-orange-400 to-rose-400',
        icon: <Sparkles className="w-8 h-8 text-white animate-pulse" />,
        showButtons: true,
      };
    }

    if (canIntroduceNew && totalActiveWords > masteredCount) {
      return {
        title: 'Ready for new challenges?',
        subtitle: 'Time to learn some exciting new words!',
        gradient: 'from-blue-400 via-indigo-400 to-purple-400',
        icon: <Sparkles className="w-8 h-8 text-white" />,
        showButtons: true,
      };
    }

    if (masteredCount === totalActiveWords && totalActiveWords > 0) {
      return {
        title: 'Amazing! All words mastered!',
        subtitle: 'You\'re a spelling champion! Add more words to keep growing.',
        gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
        icon: <Trophy className="w-8 h-8 text-white animate-bounce" />,
        showButtons: false,
      };
    }

    return {
      title: "You're all caught up!",
      subtitle: 'Great job! Check back later for more practice.',
      gradient: 'from-green-400 via-emerald-400 to-teal-400',
      icon: <Check className="w-8 h-8 text-white" />,
      showButtons: totalActiveWords > 0,
    };
  };

  const { title, subtitle, gradient, icon, showButtons } = getMessageAndStyle();

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-6 shadow-lg flex flex-col ${className}`}>
      {/* Decorative circles */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-1">
              Today's Mission
            </h2>
            <h3 className="text-xl font-bold text-white mb-1">
              {title}
            </h3>
            <p className="text-white/80 text-sm">
              {subtitle}
            </p>
          </div>
        </div>

        {showButtons && (
          <div className="mt-5 flex flex-col gap-3">
            <Button
              onClick={onChillPractice}
              variant="secondary"
              className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-3 shadow-lg
                       transform transition-all hover:scale-[1.02] active:scale-[0.98]
                       flex items-center justify-center gap-2"
            >
              <Leaf className="w-5 h-5 text-green-600" />
              Chill Practice
            </Button>
            <Button
              onClick={onChaseMode}
              variant="secondary"
              className="w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-3 shadow-lg
                       transform transition-all hover:scale-[1.02] active:scale-[0.98]
                       flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5 text-amber-500" />
              Run for Trophies
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
