import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, BarChart3, Volume2, LogOut, User, ChevronDown, Users, Settings, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProfileAvatar } from '@/components/profiles';
import { SyncStatusIndicator, SimpleSyncStatusIndicator } from '@/components/sync';
import { useGameContextOptional } from '@/context/GameContextDB';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, isSuperAdmin, isParentOrSuperAdmin, hasChildren, activeChild, clearProfileSelection } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get sync context (optional - may be null if no active child)
  const gameContext = useGameContextOptional();

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
  const isParentDashboardRoute = location.pathname.startsWith('/parent-dashboard');

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
    <header className={`bg-white/90 backdrop-blur-sm shadow-sm relative z-50 ${
      isParentDashboardRoute ? 'border-b-2 border-purple-400' : ''
    }`}>
      <div className="max-w-6xl mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          <Link
            to="/"
            className="font-bold text-gray-800 hover:text-blue-600 transition-colors"
          >
            <span className="lg:hidden text-lg">Alice</span>
            <span className="hidden lg:inline text-xl">Alice Spelling Run</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Parent Mode badge */}
            {isParentDashboardRoute && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded">
                Parent Mode
              </span>
            )}

            {/* Main navigation - only show when NOT on admin or parent dashboard routes */}
            {!isAdminRoute && !isParentDashboardRoute && (
              <>
                <Link
                  to="/"
                  title="Home"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Home size={20} />
                  <span className="hidden lg:inline">Home</span>
                </Link>

                <Link
                  to="/word-bank"
                  title="Word Bank"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/word-bank')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BookOpen size={20} />
                  <span className="hidden lg:inline">Word Bank</span>
                </Link>

                <Link
                  to="/statistics"
                  title="Statistics"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/statistics')
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 size={20} />
                  <span className="hidden lg:inline">Stats</span>
                </Link>
              </>
            )}

            {/* Admin navigation */}
            {isAdminRoute && (
              <>
                <Link
                  to="/"
                  title="Back to App"
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Home size={20} />
                  <span className="hidden lg:inline">Back to App</span>
                </Link>

                <Link
                  to="/admin/audio"
                  title="Audio"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg transition-colors ${
                    isActive('/admin/audio')
                      ? 'bg-purple-100 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Volume2 size={20} />
                  <span className="hidden lg:inline">Audio</span>
                </Link>
              </>
            )}

            {/* Sync status indicator */}
            {gameContext ? (
              <SyncStatusIndicator
                syncHealth={gameContext.syncHealth}
                syncHealthStatus={gameContext.syncHealthStatus}
                isSyncing={gameContext.isSyncing}
                onCheckHealth={gameContext.checkSyncHealth}
                onHealSync={gameContext.healSync}
              />
            ) : (
              <SimpleSyncStatusIndicator />
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Active child profile (for parents/super admins on non-admin and non-parent-dashboard routes) */}
            {!isAdminRoute && !isParentDashboardRoute && isParentOrSuperAdmin && hasChildren && activeChild && (
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
                <span className="text-sm font-medium text-gray-700 truncate max-w-[80px] hidden lg:inline">
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
                  <span className="hidden lg:inline text-sm font-medium truncate max-w-[100px]">
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
                    {/* Parent Dashboard option for parents/super admins with children */}
                    {isParentOrSuperAdmin && hasChildren && (
                      <Link
                        to="/parent-dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LayoutDashboard size={16} />
                        Parent Dashboard
                      </Link>
                    )}
                    {/* Switch Profile option for parents/super admins with children */}
                    {isParentOrSuperAdmin && hasChildren && (
                      <button
                        onClick={handleSwitchProfile}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Users size={16} />
                        Switch Profile
                      </button>
                    )}
                    {/* Manage Profiles option for parents/super admins with children - redirects to parent dashboard */}
                    {isParentOrSuperAdmin && hasChildren && (
                      <Link
                        to="/parent-dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Settings size={16} />
                        Manage Profiles
                      </Link>
                    )}
                    {/* Admin section for super admins */}
                    {isSuperAdmin && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-4 py-1">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Admin</span>
                        </div>
                        <Link
                          to="/admin/audio"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                        >
                          <Volume2 size={16} />
                          Audio Admin
                        </Link>
                      </>
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
