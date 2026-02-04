import { LetterFeedback } from '@/types';

export type SlotSize = 'xs' | 'sm' | 'md' | 'lg';

interface CharacterSlotProps {
  letter: string | null;
  isActive: boolean;
  feedback?: LetterFeedback;
  size?: SlotSize;
}

// Size classes for different word lengths
// xs: 28px (11+ letters), sm: 32px (9-10), md: 40px (7-8), lg: 48px (1-6)
const sizeClasses: Record<SlotSize, string> = {
  xs: 'w-7 h-8 text-base',
  sm: 'w-8 h-9 text-lg',
  md: 'w-10 h-11 text-xl',
  lg: 'w-12 h-14 text-2xl',
};

export function CharacterSlot({
  letter,
  isActive,
  feedback,
  size = 'lg',
}: CharacterSlotProps) {
  const baseClass = `${sizeClasses[size]} border-b-4 flex items-center justify-center font-bold uppercase transition-all duration-200`;

  // Determine background and border colors based on feedback or letter presence
  let bgClass = 'bg-transparent border-gray-400';

  if (feedback) {
    // Wordle-style feedback colors
    switch (feedback) {
      case 'correct':
        bgClass = 'bg-green-500 text-white border-green-600';
        break;
      case 'present':
        bgClass = 'bg-yellow-500 text-white border-yellow-600';
        break;
      case 'absent':
        bgClass = 'bg-gray-400 text-white border-gray-500';
        break;
      case 'empty':
      default:
        bgClass = 'bg-gray-100 text-gray-800 border-gray-300';
    }
  } else if (letter) {
    // Default gray background when letter is filled (no feedback)
    bgClass = 'bg-gray-200 border-gray-500 text-gray-800';
  }

  const activeClass = isActive ? 'ring-2 ring-blue-400 ring-offset-1' : '';

  return (
    <div className={`${baseClass} ${bgClass} ${activeClass}`}>
      {letter || ''}
    </div>
  );
}
