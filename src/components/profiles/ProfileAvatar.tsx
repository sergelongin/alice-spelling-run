interface ProfileAvatarProps {
  name: string;
  gradeLevel: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Grade-based colors for profile avatars
const GRADE_COLORS: Record<number, { bg: string; text: string }> = {
  3: { bg: 'bg-orange-500', text: 'text-white' },
  4: { bg: 'bg-purple-500', text: 'text-white' },
  5: { bg: 'bg-amber-500', text: 'text-white' },
  6: { bg: 'bg-blue-500', text: 'text-white' },
};

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

export function ProfileAvatar({ name, gradeLevel, size = 'md', className = '' }: ProfileAvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const colors = GRADE_COLORS[gradeLevel] || GRADE_COLORS[4];

  return (
    <div
      className={`
        ${SIZE_CLASSES[size]}
        ${colors.bg}
        ${colors.text}
        rounded-full
        flex items-center justify-center
        font-bold
        select-none
        ${className}
      `}
    >
      {initial}
    </div>
  );
}
