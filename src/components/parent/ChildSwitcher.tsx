import { ProfileAvatar } from '@/components/profiles';
import type { ChildProfile } from '@/types/auth';

interface ChildSwitcherProps {
  children: ChildProfile[];
  activeChildId: string;
  onSelectChild: (childId: string) => void;
}

/**
 * Tab-style navigation between children in the parent dashboard
 */
export function ChildSwitcher({ children, activeChildId, onSelectChild }: ChildSwitcherProps) {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      {children.map(child => {
        const isActive = child.id === activeChildId;

        return (
          <button
            key={child.id}
            onClick={() => onSelectChild(child.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-shrink-0 ${
              isActive
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <ProfileAvatar
              name={child.name}
              gradeLevel={child.grade_level}
              size="sm"
            />
            <span className="font-medium">{child.name}</span>
          </button>
        );
      })}
    </div>
  );
}
