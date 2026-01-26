import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * If specified, only users with these roles can access the route
   */
  allowedRoles?: UserRole[];
  /**
   * If true, parents must have at least one child to access
   * Defaults to false
   */
  requireChild?: boolean;
  /**
   * If true, requires an active child profile to be selected this session (Netflix-style)
   * Redirects to /profiles if no profile selected
   * Defaults to false
   */
  requireProfileSelection?: boolean;
  /**
   * If true, skips the profile selection requirement (for profile management screens)
   * Defaults to false
   */
  skipProfileRequirement?: boolean;
  /**
   * Where to redirect if not authenticated
   * Defaults to '/login'
   */
  redirectTo?: string;
}

/**
 * Route guard component that protects routes based on auth state and roles.
 *
 * Uses optimistic loading: if we have cached auth data, renders immediately
 * while background validation occurs. Only shows loading spinner when we have
 * no cached data and are doing the initial auth check.
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  requireChild = false,
  requireProfileSelection = false,
  skipProfileRequirement = false,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, profile, isLoading, isSuperAdmin, needsChildSetup, needsProfileSelection } = useAuth();
  const location = useLocation();

  // Show loading spinner only when:
  // 1. isLoading: No cached data AND checking Supabase storage (initial cold start)
  // 2. user && !profile: OAuth callback where session exists but profile not yet fetched
  //
  // We intentionally DON'T wait for isValidating when we have cached data.
  // This enables stale-while-revalidate: render immediately with cache, validate silently.
  if (isLoading || (user && !profile)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role check
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect non-authorized users to home
    return <Navigate to="/" replace />;
  }

  // Super admins accessing admin routes bypass child requirements
  // (admin routes don't need child context)
  if (isSuperAdmin && location.pathname.startsWith('/admin')) {
    return <>{children}</>;
  }
  // For all other routes, super admins go through normal parent flow

  // Parent needs child setup - redirect unless we're already on setup page
  if (needsChildSetup && location.pathname !== '/setup-child') {
    return <Navigate to="/setup-child" replace />;
  }

  // Netflix-style profile selection: require profile selection if enabled and not skipped
  if (!skipProfileRequirement && (requireProfileSelection || requireChild) && needsProfileSelection) {
    return <Navigate to="/profiles" replace />;
  }

  // Require child check (for game-related routes)
  if (requireChild && needsChildSetup) {
    return <Navigate to="/setup-child" replace />;
  }

  return <>{children}</>;
}
