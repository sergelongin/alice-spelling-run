import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, BarChart3, Volume2, LogOut, User, ChevronDown, Users, Settings, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SuperAdminOnly } from '@/components/auth';
import { ProfileAvatar } from '@/components/profiles';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, isSuperAdmin, isParent, hasChildren, activeChild, clearProfileSelection } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  // NOTE: This useEffect MUST run before any early return to satisfy React's Rules of Hooks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSwitchProfile = () => {
    clearProfileSelection();
    setShowUserMenu(false);
    navigate('/profiles');
  };

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'User';

  // Don't show header during gameplay - must be AFTER all hooks
  if (location.pathname === '/game') {
    return null;
  }

  return (
    <header className="bg-white/90 backdrop-blur-sm shadow-sm relative z-50">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
          >
            Alice Spelling Run
          </Link>

          <div className="flex items-center gap-2">
            {/* Main navigation */}
            {!isAdminRoute && (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Home size={20} />
                  <span className="hidden sm:inline">Home</span>
                </Link>

                <Link
                  to="/word-bank"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/word-bank')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BookOpen size={20} />
                  <span className="hidden sm:inline">Word Bank</span>
                </Link>

                <Link
                  to="/statistics"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/statistics')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 size={20} />
                  <span className="hidden sm:inline">Stats</span>
                </Link>
              </>
            )}

            {/* Admin navigation */}
            {isAdminRoute && (
              <>
                <Link
                  to="/"
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Home size={20} />
                  <span className="hidden sm:inline">Back to App</span>
                </Link>

                <Link
                  to="/admin/audio"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive('/admin/audio')
                      ? 'bg-purple-100 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Volume2 size={20} />
                  <span className="hidden sm:inline">Audio</span>
                </Link>
              </>
            )}

            {/* Super admin link to admin section */}
            <SuperAdminOnly>
              {!isAdminRoute && (
                <Link
                  to="/admin/audio"
                  className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Admin"
                >
                  <Volume2 size={20} />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
            </SuperAdminOnly>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Active child profile (for parents on non-admin routes) */}
            {!isAdminRoute && !isSuperAdmin && isParent && hasChildren && activeChild && (
              <button
                onClick={handleSwitchProfile}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Switch Profile"
              >
                <ProfileAvatar
                  name={activeChild.name}
                  gradeLevel={activeChild.grade_level}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700 truncate max-w-[80px] hidden sm:inline">
                  {activeChild.name}
                </span>
              </button>
            )}

            {/* User menu */}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <span className="hidden sm:inline text-sm font-medium truncate max-w-[100px]">
                    {displayName}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                      {isSuperAdmin && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Super Admin
                        </span>
                      )}
                    </div>
                    {/* Parent Dashboard option for parents with children */}
                    {isParent && hasChildren && (
                      <Link
                        to="/parent-dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LayoutDashboard size={16} />
                        Parent Dashboard
                      </Link>
                    )}
                    {/* Switch Profile option for parents with children */}
                    {isParent && hasChildren && (
                      <button
                        onClick={handleSwitchProfile}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Users size={16} />
                        Switch Profile
                      </button>
                    )}
                    {/* Manage Profiles option for parents with children */}
                    {isParent && hasChildren && (
                      <Link
                        to="/profiles/manage"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Settings size={16} />
                        Manage Profiles
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
