import { LetterFeedback } from '@/types';

interface CharacterSlotProps {
  letter: string | null;
  isActive: boolean;
  feedback?: LetterFeedback;
}

export function CharacterSlot({
  letter,
  isActive,
  feedback,
}: CharacterSlotProps) {
  const baseClass = 'w-12 h-14 border-b-4 flex items-center justify-center text-2xl font-bold uppercase transition-all duration-200';

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
