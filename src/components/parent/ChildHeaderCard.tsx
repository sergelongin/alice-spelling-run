import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Edit2, RotateCcw, Download, Trash2, Users, Check, BarChart3, Clock, BookOpen } from 'lucide-react';
import { ProfileAvatar } from '@/components/profiles';
import type { ChildProfile } from '@/types/auth';

interface ChildHeaderCardProps {
  child: ChildProfile;
  allChildren: ChildProfile[];
  onEdit: () => void;
  onResetProgress: () => void;
  onExport: () => void;
  onDelete: () => void;
}

/**
 * Unified navigation card for child views in the parent dashboard.
 * Combines child selection, section tabs, and actions into a single bar.
 *
 * Layout:
 * - Left: Child dropdown (name + avatar, can switch children or go to Family)
 * - Middle: Progress / Word Bank tabs
 * - Right: Actions dropdown
 */
export function ChildHeaderCard({
  child,
  allChildren,
  onEdit,
  onResetProgress,
  onExport,
  onDelete,
}: ChildHeaderCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const childDropdownRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Determine which tab is active
  const isWordBankActive = location.pathname.includes('/word-bank');
  const isSessionsActive = location.pathname.includes('/sessions');
  const isProgressActive = !isWordBankActive && !isSessionsActive;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (childDropdownRef.current && !childDropdownRef.current.contains(event.target as Node)) {
        setIsChildDropdownOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFamily = () => {
    navigate('/parent-dashboard');
    setIsChildDropdownOpen(false);
  };

  const handleSelectChild = (childId: string) => {
    // Navigate to the same section for the new child
    if (isWordBankActive) {
      navigate(`/parent-dashboard/child/${childId}/word-bank`);
    } else if (isSessionsActive) {
      navigate(`/parent-dashboard/child/${childId}/sessions`);
    } else {
      navigate(`/parent-dashboard/child/${childId}`);
    }
    setIsChildDropdownOpen(false);
  };

  const handleAction = (action: () => void) => {
    setIsActionsOpen(false);
    action();
  };

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between gap-2">
        {/* Left side: Child dropdown + Tabs */}
        <div className="flex items-center gap-1 sm:gap-3 flex-1 min-w-0">
          {/* Child dropdown */}
          <div className="relative" ref={childDropdownRef}>
            <button
              onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <ProfileAvatar
                name={child.name}
                gradeLevel={child.grade_level}
                size="sm"
              />
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-800 truncate max-w-[120px]">{child.name}</div>
                <div className="text-xs text-gray-500">Grade {child.grade_level}</div>
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform flex-shrink-0 ${isChildDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isChildDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                {/* Family option */}
                <button
                  onClick={handleSelectFamily}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users size={16} className="text-purple-600" />
                  </div>
                  <span className="font-medium">Family</span>
                </button>

                {/* Divider */}
                <div className="border-t border-gray-100 my-1" />

                {/* Children */}
                {allChildren.map(c => {
                  const isActive = c.id === child.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectChild(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <ProfileAvatar
                        name={c.name}
                        gradeLevel={c.grade_level}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-gray-500">Grade {c.grade_level}</div>
                      </div>
                      {isActive && (
                        <Check size={16} className="text-purple-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/parent-dashboard/child/${child.id}`)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                isProgressActive
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 size={18} />
              <span className="text-sm font-medium hidden sm:inline">Progress</span>
            </button>
            <button
              onClick={() => navigate(`/parent-dashboard/child/${child.id}/sessions`)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                isSessionsActive
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock size={18} />
              <span className="text-sm font-medium hidden sm:inline">Sessions</span>
            </button>
            <button
              onClick={() => navigate(`/parent-dashboard/child/${child.id}/word-bank`)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                isWordBankActive
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BookOpen size={18} />
              <span className="text-sm font-medium hidden sm:inline">Word Bank</span>
            </button>
          </div>
        </div>

        {/* Right side: Actions dropdown */}
        <div className="relative flex-shrink-0" ref={actionsRef}>
          <button
            onClick={() => setIsActionsOpen(!isActionsOpen)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-sm font-medium hidden sm:inline">Actions</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${isActionsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isActionsOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => handleAction(onEdit)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Edit2 size={16} className="text-gray-400" />
                <span className="text-sm">Edit Profile</span>
              </button>
              <button
                onClick={() => handleAction(onResetProgress)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <RotateCcw size={16} />
                <span className="text-sm">Reset Progress</span>
              </button>
              <button
                onClick={() => handleAction(onExport)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download size={16} className="text-gray-400" />
                <span className="text-sm">Export CSV</span>
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={16} />
                <span className="text-sm">Delete Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
