import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface UseParentDashboardAccessReturn {
  isAuthorized: boolean;
  hasPin: boolean;
  isPinModalOpen: boolean;
  pinError: string | null;
  isCreatingPin: boolean;

  // Actions
  requestAccess: () => void;
  verifyPin: (pin: string) => boolean;
  createPin: (pin: string) => void;
  closePinModal: () => void;
  revokeAccess: () => void;
  resetPin: () => void;
}

const PIN_STORAGE_KEY = 'alice-spelling-run-parent-pin';
export const SESSION_ACCESS_KEY = 'alice-spelling-run-parent-dashboard-access';

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
 * - PIN protection for accessing the Parent Dashboard
 * - Session-based authorization (clears on browser/tab close)
 * - First-time PIN creation flow
 * - Uses same PIN as Word Bank parent mode for consistency
 */
export function useParentDashboardAccess(): UseParentDashboardAccessReturn {
  // Store PIN in localStorage (hashed for basic security)
  // Shares the same PIN with Word Bank parent mode for consistency
  const [storedPin, setStoredPin] = useLocalStorage<string | null>(PIN_STORAGE_KEY, null);

  // Session-based authorization state (clears when browser/tab closes)
  const [isAuthorized, setIsAuthorized] = useState(() => {
    // Check sessionStorage for existing authorization
    return sessionStorage.getItem(SESSION_ACCESS_KEY) === 'true';
  });

  // PIN modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isCreatingPin, setIsCreatingPin] = useState(false);

  const hasPin = storedPin !== null;

  // Simple hash function for PIN (not cryptographically secure, but prevents casual viewing)
  const hashPin = useCallback((pin: string): string => {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }, []);

  // Request access to Parent Dashboard (triggers PIN modal)
  const requestAccess = useCallback(() => {
    // If already authorized this session, grant immediate access
    if (isAuthorized) {
      return;
    }

    setPinError(null);
    if (!hasPin) {
      // First time - need to create PIN
      setIsCreatingPin(true);
    } else {
      setIsCreatingPin(false);
    }
    setIsPinModalOpen(true);
  }, [hasPin, isAuthorized]);

  // Verify entered PIN against stored PIN
  const verifyPin = useCallback((pin: string): boolean => {
    if (!storedPin) return false;

    const hashedInput = hashPin(pin);
    if (hashedInput === storedPin) {
      setIsAuthorized(true);
      sessionStorage.setItem(SESSION_ACCESS_KEY, 'true');
      setIsPinModalOpen(false);
      setPinError(null);
      return true;
    } else {
      setPinError('Incorrect PIN. Please try again.');
      return false;
    }
  }, [storedPin, hashPin]);

  // Create a new PIN (first-time setup)
  const createPin = useCallback((pin: string) => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    const hashedPin = hashPin(pin);
    setStoredPin(hashedPin);
    setIsAuthorized(true);
    sessionStorage.setItem(SESSION_ACCESS_KEY, 'true');
    setIsPinModalOpen(false);
    setIsCreatingPin(false);
    setPinError(null);
  }, [hashPin, setStoredPin]);

  // Close PIN modal without completing action
  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPinError(null);
  }, []);

  // Revoke current session access (user must re-enter PIN)
  const revokeAccess = useCallback(() => {
    setIsAuthorized(false);
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
  }, []);

  // Reset PIN (for testing/debugging - could be hidden in production)
  const resetPin = useCallback(() => {
    setStoredPin(null);
    setIsAuthorized(false);
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
  }, [setStoredPin]);

  return {
    isAuthorized,
    hasPin,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    requestAccess,
    verifyPin,
    createPin,
    closePinModal,
    revokeAccess,
    resetPin,
  };
}
