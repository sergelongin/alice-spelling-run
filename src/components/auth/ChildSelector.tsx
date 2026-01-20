import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ChildSelectorProps {
  compact?: boolean;
}

export function ChildSelector({ compact = false }: ChildSelectorProps) {
  const { children, activeChild, setActiveChild, isParent } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render for non-parents or if no children
  if (!isParent || children.length === 0) {
    return null;
  }

  const handleSelectChild = (childId: string) => {
    setActiveChild(childId);
    setIsOpen(false);
  };

  const handleAddChild = () => {
    setIsOpen(false);
    navigate('/setup-child');
  };

  const getGradeLabel = (grade: number) => `Grade ${grade}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${
          compact
            ? 'px-2 py-1.5 text-sm'
            : 'px-3 py-2'
        } bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors`}
      >
        <User size={compact ? 14 : 16} className="text-gray-500" />
        <span className="font-medium text-gray-700 truncate max-w-[100px]">
          {activeChild?.name || 'Select child'}
        </span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {children.map((child) => (
            <button
              key={child.id}
              onClick={() => handleSelectChild(child.id)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                activeChild?.id === child.id ? 'bg-blue-50' : ''
              }`}
            >
              <div>
                <div className="font-medium text-gray-900">{child.name}</div>
                <div className="text-xs text-gray-500">{getGradeLabel(child.grade_level)}</div>
              </div>
              {activeChild?.id === child.id && (
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={handleAddChild}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-blue-600"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Add another child</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
