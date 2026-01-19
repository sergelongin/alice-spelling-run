import { useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type WordBankMode = 'child' | 'parent';

interface UseWordBankModeReturn {
  mode: WordBankMode;
  hasPin: boolean;
  isPinModalOpen: boolean;
  pinError: string | null;
  isCreatingPin: boolean;

  // Actions
  switchToChildMode: () => void;
  requestParentMode: () => void;
  verifyPin: (pin: string) => boolean;
  createPin: (pin: string) => void;
  closePinModal: () => void;
  resetPin: () => void;
}

const PIN_STORAGE_KEY = 'alice-spelling-run-parent-pin';

/**
 * Hook for managing Word Bank mode switching with PIN protection for Parent Mode.
 *
 * Features:
 * - Default to Child Mode on first visit
 * - PIN protection for Parent Mode access
 * - Session-based mode persistence (resets on browser refresh)
 * - First-time PIN creation flow
 */
export function useWordBankMode(): UseWordBankModeReturn {
  // Store PIN in localStorage (hashed for basic security)
  const [storedPin, setStoredPin] = useLocalStorage<string | null>(PIN_STORAGE_KEY, null);

  // Session-based mode state (resets on refresh)
  const [mode, setMode] = useState<WordBankMode>('child');

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

  // Switch to Child Mode (no PIN required)
  const switchToChildMode = useCallback(() => {
    setMode('child');
  }, []);

  // Request to switch to Parent Mode (triggers PIN modal)
  const requestParentMode = useCallback(() => {
    setPinError(null);
    if (!hasPin) {
      // First time - need to create PIN
      setIsCreatingPin(true);
    } else {
      setIsCreatingPin(false);
    }
    setIsPinModalOpen(true);
  }, [hasPin]);

  // Verify entered PIN against stored PIN
  const verifyPin = useCallback((pin: string): boolean => {
    if (!storedPin) return false;

    const hashedInput = hashPin(pin);
    if (hashedInput === storedPin) {
      setMode('parent');
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
    setMode('parent');
    setIsPinModalOpen(false);
    setIsCreatingPin(false);
    setPinError(null);
  }, [hashPin, setStoredPin]);

  // Close PIN modal without completing action
  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPinError(null);
  }, []);

  // Reset PIN (for testing/debugging - could be hidden in production)
  const resetPin = useCallback(() => {
    setStoredPin(null);
    setMode('child');
  }, [setStoredPin]);

  return {
    mode,
    hasPin,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    switchToChildMode,
    requestParentMode,
    verifyPin,
    createPin,
    closePinModal,
    resetPin,
  };
}
