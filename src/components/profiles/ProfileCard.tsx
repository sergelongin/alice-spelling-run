import { ProfileAvatar } from './ProfileAvatar';
import type { ChildProfile } from '@/types/auth';

interface ProfileCardProps {
  child: ChildProfile;
  onClick: () => void;
  isSelected?: boolean;
}

const GRADE_BADGE_COLORS: Record<number, string> = {
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-purple-100 text-purple-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-blue-100 text-blue-700',
};

export function ProfileCard({ child, onClick, isSelected = false }: ProfileCardProps) {
  const badgeColor = GRADE_BADGE_COLORS[child.grade_level] || GRADE_BADGE_COLORS[4];

  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col items-center gap-3 p-6
        w-36 md:w-40
        bg-gray-800/50 hover:bg-gray-700/60
        border-2 rounded-xl
        transition-all duration-200 ease-out
        hover:scale-105 hover:shadow-lg hover:shadow-white/10
        focus:outline-none focus:ring-2 focus:ring-white/50
        ${isSelected ? 'border-white ring-2 ring-white/50' : 'border-gray-700'}
        profile-card-hover
      `}
    >
      <div className="relative">
        <ProfileAvatar
          name={child.name}
          gradeLevel={child.grade_level}
          size="xl"
          className="transition-transform group-hover:scale-110"
        />
        {isSelected && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-white group-hover:text-white/90">
          {child.name}
        </h3>
        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
          Grade {child.grade_level}
        </span>
      </div>
    </button>
  );
}
