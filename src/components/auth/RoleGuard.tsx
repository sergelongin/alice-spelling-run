import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  /**
   * Roles that can see this content
   */
  allowedRoles: UserRole[];
  /**
   * Optional fallback content if role doesn't match
   */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on user role
 * Use for showing/hiding UI elements based on role
 */
export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { profile, isLoading } = useAuth();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // Check if user has required role
  if (profile && allowedRoles.includes(profile.role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Convenience component for super admin only content
 */
export function SuperAdminOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['super_admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Convenience component for parent only content
 */
export function ParentOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['parent']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
