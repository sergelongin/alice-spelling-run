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
  const { user, profile, isLoading, isValidating, isSuperAdmin, needsChildSetup, needsProfileSelection } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is being determined OR if user exists but
  // we're still validating (fetching profile/children). This prevents race condition
  // where stale children data is used for redirect decisions during OAuth callback.
  // CRITICAL: Also wait if user exists but profile is null - this happens during OAuth
  // when the session is established but profile/children haven't been fetched yet.
  // Without profile, we can't determine isParent, so needsChildSetup would be false.
  if (isLoading || (user && isValidating) || (user && !profile)) {
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

  // Super admins bypass child requirements
  if (isSuperAdmin) {
    return <>{children}</>;
  }

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
