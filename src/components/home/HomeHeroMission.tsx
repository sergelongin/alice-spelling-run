import { Play, Sparkles, Trophy, Check, Plus } from 'lucide-react';

interface HomeHeroMissionProps {
  dueWordCount: number;
  canIntroduceNew: boolean;
  masteredCount: number;
  totalActiveWords: number;
  canPlay: boolean;
  wordsNeeded: number;
  onPractice: () => void;
  onAddWords: () => void;
}

/**
 * Hero mission card for the home screen.
 * Shows dynamic messaging based on user state and provides the primary CTA.
 */
export function HomeHeroMission({
  dueWordCount,
  canIntroduceNew,
  masteredCount,
  totalActiveWords,
  canPlay,
  wordsNeeded,
  onPractice,
  onAddWords,
}: HomeHeroMissionProps) {
  const getState = () => {
    if (!canPlay) {
      return {
        title: `Add ${wordsNeeded} more word${wordsNeeded !== 1 ? 's' : ''} to start!`,
        subtitle: "You're almost ready for your first adventure!",
        gradient: 'from-violet-400 via-purple-400 to-indigo-400',
        icon: <Plus className="w-7 h-7 text-white" />,
        buttonText: 'Add Words',
        onAction: onAddWords,
      };
    }

    if (dueWordCount > 0) {
      return {
        title: `${dueWordCount} word${dueWordCount === 1 ? '' : 's'} waiting for you!`,
        subtitle: dueWordCount === 1 ? "Let's master this word!" : "Let's practice and learn!",
        gradient: 'from-green-500 via-emerald-500 to-teal-500',
        icon: <Sparkles className="w-7 h-7 text-white animate-pulse" />,
        buttonText: 'Practice Now',
        onAction: onPractice,
      };
    }

    if (canIntroduceNew && totalActiveWords > masteredCount) {
      return {
        title: 'Ready for new challenges?',
        subtitle: 'Time to learn some exciting new words!',
        gradient: 'from-blue-400 via-indigo-400 to-purple-400',
        icon: <Play className="w-7 h-7 text-white" />,
        buttonText: 'Start Learning',
        onAction: onPractice,
      };
    }

    if (masteredCount === totalActiveWords && totalActiveWords > 0) {
      return {
        title: 'All words mastered!',
        subtitle: "You're a spelling champion! Add more words to keep growing.",
        gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
        icon: <Trophy className="w-7 h-7 text-white animate-bounce" />,
        buttonText: 'Add More Words',
        onAction: onAddWords,
      };
    }

    return {
      title: "You're all caught up!",
      subtitle: 'Great job! Check back later or practice again.',
      gradient: 'from-green-400 via-emerald-400 to-teal-400',
      icon: <Check className="w-7 h-7 text-white" />,
      buttonText: 'Practice Anyway',
      onAction: onPractice,
    };
  };

  const { title, subtitle, gradient, icon, buttonText, onAction } = getState();

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-5 shadow-lg w-full`}>
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute -bottom-3 -left-3 w-20 h-20 bg-white/10 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white mb-0.5">
              {title}
            </h2>
            <p className="text-white/80 text-sm">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onAction}
          className="mt-4 w-full bg-white hover:bg-gray-50 text-gray-800 font-bold py-3 px-4 rounded-xl
                     shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98]
                     flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          {buttonText}
        </button>
      </div>
    </div>
  );
}
