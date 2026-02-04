import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { verifyPinOffline, hasCachedPin } from '@/lib/pinCache';

interface UseParentDashboardAccessReturn {
  isAuthorized: boolean;
  hasPin: boolean;
  isPinModalOpen: boolean;
  pinError: string | null;
  isCreatingPin: boolean;
  isVerifying: boolean;
  attemptsRemaining: number | null;
  lockedUntil: Date | null;

  // Actions
  requestAccess: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  closePinModal: () => void;
  revokeAccess: () => void;
}

export const SESSION_ACCESS_KEY = 'alice-spelling-run-parent-dashboard-access';

// Legacy PIN key for migration detection
const LEGACY_PIN_KEY = 'alice-spelling-run-parent-pin';

/**
 * Revoke parent dashboard access from non-component code.
 * Call this when transitioning from parent mode to child mode.
 */
export function revokeParentDashboardAccess(): void {
  sessionStorage.removeItem(SESSION_ACCESS_KEY);
}

/**
 * Hook for managing Parent Dashboard access with PIN protection.
 *
 * Features:
 * - PIN verification via Supabase RPC (online)
 * - Offline fallback using cached bcrypt hash
 * - Rate limiting with lockout display
 * - Session-based authorization (clears on browser/tab close)
 */
export function useParentDashboardAccess(): UseParentDashboardAccessReturn {
  const { hasPinSet, verifyParentPin, needsPinSetup } = useAuth();

  // Session-based authorization state (clears when browser/tab closes)
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem(SESSION_ACCESS_KEY) === 'true';
  });

  // PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  // Check for legacy localStorage PIN (for existing users)
  const hasLegacyPin = localStorage.getItem(LEGACY_PIN_KEY) !== null;

  // Has PIN set either in Supabase or locally cached
  const hasPin = hasPinSet || hasCachedPin() || hasLegacyPin;

  // Is creating PIN if they need PIN setup (no PIN set yet)
  const isCreatingPin = needsPinSetup;

  // Request access to Parent Dashboard (triggers PIN modal)
  const requestAccess = useCallback(() => {
    // If already authorized this session, grant immediate access
    if (isAuthorized) {
      return;
    }

    setPinError(null);
    setAttemptsRemaining(null);
    setLockedUntil(null);
    setIsPinModalOpen(true);
  }, [isAuthorized]);

  // Verify entered PIN against Supabase (with offline fallback)
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    setIsVerifying(true);
    setPinError(null);
    setAttemptsRemaining(null);
    setLockedUntil(null);

    try {
      // Check if locked
      if (lockedUntil && lockedUntil > new Date()) {
        const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        setPinError(`Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
        setIsVerifying(false);
        return false;
      }

      // Try online verification first
      const result = await verifyParentPin(pin);

      if (result.success) {
        setIsAuthorized(true);
        sessionStorage.setItem(SESSION_ACCESS_KEY, 'true');
        setIsPinModalOpen(false);

        // Clear legacy PIN if it exists (migration complete)
        localStorage.removeItem(LEGACY_PIN_KEY);

        setIsVerifying(false);
        return true;
      }

      // Handle failure
      if (result.lockedUntil) {
        const lockDate = new Date(result.lockedUntil);
        setLockedUntil(lockDate);
        const mins = Math.ceil((lockDate.getTime() - Date.now()) / 60000);
        setPinError(`Too many attempts. Locked for ${mins} minute${mins === 1 ? '' : 's'}.`);
      } else if (result.attemptsRemaining !== undefined) {
        setAttemptsRemaining(result.attemptsRemaining);
        setPinError(`Incorrect PIN. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} remaining.`);
      } else {
        setPinError(result.error || 'Incorrect PIN. Please try again.');
      }

      setIsVerifying(false);
      return false;
    } catch {
      // Network error - try offline verification
      console.warn('[ParentDashboardAccess] Online verification failed, trying offline...');

      try {
        const offlineResult = await verifyPinOffline(pin);

        if (offlineResult) {
          setIsAuthorized(true);
          sessionStorage.setItem(SESSION_ACCESS_KEY, 'true');
          setIsPinModalOpen(false);
          setIsVerifying(false);
          return true;
        }

        setPinError('Incorrect PIN. Please try again.');
        setIsVerifying(false);
        return false;
      } catch {
        setPinError('Unable to verify PIN. Please check your connection.');
        setIsVerifying(false);
        return false;
      }
    }
  }, [verifyParentPin, lockedUntil]);

  // Close PIN modal without completing action
  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPinError(null);
    setAttemptsRemaining(null);
    setLockedUntil(null);
  }, []);

  // Revoke current session access (user must re-enter PIN)
  const revokeAccess = useCallback(() => {
    setIsAuthorized(false);
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
  }, []);

  return {
    isAuthorized,
    hasPin,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    isVerifying,
    attemptsRemaining,
    lockedUntil,
    requestAccess,
    verifyPin,
    closePinModal,
    revokeAccess,
  };
}
