import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useParentDashboardAccess,
  revokeParentDashboardAccess,
  SESSION_ACCESS_KEY,
} from './useParentDashboardAccess';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('useParentDashboardAccess', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  describe('Initial State', () => {
    it('should start with isAuthorized false when sessionStorage is empty', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isPinModalOpen).toBe(false);
    });

    it('should start with isAuthorized true when sessionStorage has authorization', () => {
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result } = renderHook(() => useParentDashboardAccess());

      expect(result.current.isAuthorized).toBe(true);
    });

    it('should detect hasPin false when no PIN stored', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      expect(result.current.hasPin).toBe(false);
    });
  });

  describe('PIN Creation Flow', () => {
    it('should open modal in create mode when no PIN exists', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      expect(result.current.isPinModalOpen).toBe(true);
      expect(result.current.isCreatingPin).toBe(true);
    });

    it('should create PIN and authorize user', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      act(() => {
        result.current.createPin('1234');
      });

      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.isPinModalOpen).toBe(false);
      expect(result.current.hasPin).toBe(true);
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(SESSION_ACCESS_KEY, 'true');
    });

    it('should reject invalid PIN (not 4 digits)', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      act(() => {
        result.current.createPin('123'); // Only 3 digits
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.pinError).toBe('PIN must be exactly 4 digits');
    });
  });

  describe('PIN Verification Flow', () => {
    beforeEach(() => {
      // Set up a stored PIN (hashed version of '1234')
      // The hash function produces 'wcoy' for PIN '1234'
      localStorageMock.setItem(
        'alice-spelling-run-parent-pin',
        JSON.stringify('wcoy')
      );
    });

    it('should open modal in verify mode when PIN exists', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      expect(result.current.isPinModalOpen).toBe(true);
      expect(result.current.isCreatingPin).toBe(false);
    });

    it('should authorize on correct PIN', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      let verified = false;
      act(() => {
        verified = result.current.verifyPin('1234');
      });

      expect(verified).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
      expect(result.current.isPinModalOpen).toBe(false);
    });

    it('should reject incorrect PIN', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      let verified = false;
      act(() => {
        verified = result.current.verifyPin('9999');
      });

      expect(verified).toBe(false);
      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.pinError).toBe('Incorrect PIN. Please try again.');
    });
  });

  describe('Request Access Behavior', () => {
    it('should return early without opening modal when already authorized', () => {
      // Pre-authorize via sessionStorage
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result } = renderHook(() => useParentDashboardAccess());

      expect(result.current.isAuthorized).toBe(true);

      act(() => {
        result.current.requestAccess();
      });

      // Modal should NOT open
      expect(result.current.isPinModalOpen).toBe(false);
    });
  });

  describe('Revocation', () => {
    it('should revoke access via hook method', () => {
      // First authorize
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result } = renderHook(() => useParentDashboardAccess());
      expect(result.current.isAuthorized).toBe(true);

      act(() => {
        result.current.revokeAccess();
      });

      expect(result.current.isAuthorized).toBe(false);
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(SESSION_ACCESS_KEY);
    });

    it('should revoke access via standalone function', () => {
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      revokeParentDashboardAccess();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith(SESSION_ACCESS_KEY);
      expect(sessionStorageMock.getItem(SESSION_ACCESS_KEY)).toBe(null);
    });

    it('standalone revocation should affect subsequent hook instances', () => {
      // Authorize first
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      // Verify initial state
      const { result: result1 } = renderHook(() => useParentDashboardAccess());
      expect(result1.current.isAuthorized).toBe(true);

      // Revoke using standalone function
      revokeParentDashboardAccess();

      // New hook instance should read empty sessionStorage
      const { result: result2 } = renderHook(() => useParentDashboardAccess());
      expect(result2.current.isAuthorized).toBe(false);
    });
  });

  describe('Modal Behavior', () => {
    it('should close modal and clear error', () => {
      const { result } = renderHook(() => useParentDashboardAccess());

      act(() => {
        result.current.requestAccess();
      });

      expect(result.current.isPinModalOpen).toBe(true);

      act(() => {
        result.current.closePinModal();
      });

      expect(result.current.isPinModalOpen).toBe(false);
      expect(result.current.pinError).toBe(null);
    });
  });

  describe('Reset PIN', () => {
    it('should clear PIN and revoke access', () => {
      // Set up PIN and authorize (hash of '1234' is 'wcoy')
      localStorageMock.setItem(
        'alice-spelling-run-parent-pin',
        JSON.stringify('wcoy')
      );
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result } = renderHook(() => useParentDashboardAccess());

      expect(result.current.hasPin).toBe(true);
      expect(result.current.isAuthorized).toBe(true);

      act(() => {
        result.current.resetPin();
      });

      expect(result.current.hasPin).toBe(false);
      expect(result.current.isAuthorized).toBe(false);
    });
  });
});

describe('Parent Dashboard Access Flow Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  describe('Bug Fix: PIN required after navigation away from parent mode', () => {
    it('should require PIN after returning from parent dashboard when revokeAccess is called on mount', () => {
      // Step 1: User at profile selection, no authorization
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useParentDashboardAccess()
      );
      expect(result1.current.isAuthorized).toBe(false);

      // Step 2: User enters PIN
      act(() => {
        result1.current.requestAccess();
      });
      act(() => {
        result1.current.createPin('1234');
      });
      expect(result1.current.isAuthorized).toBe(true);

      // Step 3: User navigates to parent dashboard (component unmounts)
      unmount1();

      // Step 4: User clicks "Home" from parent dashboard, ends up at profile selection
      // ProfileSelectionScreen calls revokeAccess on mount
      const { result: result2 } = renderHook(() => {
        const hook = useParentDashboardAccess();
        // Simulate ProfileSelectionScreen calling revokeAccess on mount
        // This is done via useEffect in the actual component
        return hook;
      });

      // Before the useEffect runs, isAuthorized is still true from sessionStorage
      expect(result2.current.isAuthorized).toBe(true);

      // After calling revokeAccess (simulating useEffect on mount)
      act(() => {
        result2.current.revokeAccess();
      });

      // Now isAuthorized should be false
      expect(result2.current.isAuthorized).toBe(false);

      // Clicking Parents card should require PIN
      act(() => {
        result2.current.requestAccess();
      });
      expect(result2.current.isPinModalOpen).toBe(true);
    });

    it('should require PIN after selectProfile revokes access', () => {
      // Step 1: Simulate being authorized
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useParentDashboardAccess()
      );
      expect(result1.current.isAuthorized).toBe(true);

      // Step 2: User selects a child profile (this should revoke access)
      // In AuthContext.selectProfile, we call revokeParentDashboardAccess()
      revokeParentDashboardAccess();

      unmount1();

      // Step 3: New hook instance should NOT be authorized
      const { result: result2 } = renderHook(() => useParentDashboardAccess());
      expect(result2.current.isAuthorized).toBe(false);
    });

    it('should require PIN after clearProfileSelection revokes access', () => {
      // Step 1: Simulate being authorized
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useParentDashboardAccess()
      );
      expect(result1.current.isAuthorized).toBe(true);

      // Step 2: User clicks "Switch Profile" (calls clearProfileSelection)
      revokeParentDashboardAccess();

      unmount1();

      // Step 3: New hook instance should NOT be authorized
      const { result: result2 } = renderHook(() => useParentDashboardAccess());
      expect(result2.current.isAuthorized).toBe(false);
    });
  });

  describe('Expected Behavior: PIN not required within parent pages', () => {
    it('should maintain authorization when navigating between parent pages', () => {
      // Set up authorization
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      // User on /parent-dashboard
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useParentDashboardAccess()
      );
      expect(result1.current.isAuthorized).toBe(true);

      // User navigates to /parent-dashboard/child/:id
      // We do NOT call revokeParentDashboardAccess here
      unmount1();

      // New page should still be authorized
      const { result: result2 } = renderHook(() => useParentDashboardAccess());
      expect(result2.current.isAuthorized).toBe(true);
    });
  });

  describe('Expected Behavior: Profile Selection should revoke access on mount', () => {
    it('should revoke access when ProfileSelectionScreen mounts', () => {
      // Step 1: User was authorized on parent dashboard
      sessionStorageMock.setItem(SESSION_ACCESS_KEY, 'true');

      // Step 2: User navigates to profile selection
      // The ProfileSelectionScreen should call revokeAccess on mount
      // Simulating what ProfileSelectionScreen should do:
      const { result } = renderHook(() => {
        const hook = useParentDashboardAccess();
        // This simulates what we'll add to ProfileSelectionScreen
        // useEffect(() => { revokeAccess(); }, []);
        return hook;
      });

      // Before fix: isAuthorized would be true (from sessionStorage)
      // After fix: ProfileSelectionScreen will call revokeAccess on mount

      // For now, calling revokeAccess manually to test expected behavior
      act(() => {
        result.current.revokeAccess();
      });

      expect(result.current.isAuthorized).toBe(false);

      // Now requesting access should open PIN modal
      act(() => {
        result.current.requestAccess();
      });

      expect(result.current.isPinModalOpen).toBe(true);
    });
  });

  describe('Full User Flow: Parent mode → Home → Profile Selection → Parent mode', () => {
    it('complete flow: enter PIN, navigate away, return, should require PIN again', () => {
      // Set up an existing PIN (hash of '1234' is 'wcoy')
      localStorageMock.setItem(
        'alice-spelling-run-parent-pin',
        JSON.stringify('wcoy')
      );

      // === Scene 1: User at profile selection for the first time ===
      const { result: scene1, unmount: unmount1 } = renderHook(() =>
        useParentDashboardAccess()
      );

      // No authorization yet
      expect(scene1.current.isAuthorized).toBe(false);

      // User clicks Parents card
      act(() => {
        scene1.current.requestAccess();
      });
      expect(scene1.current.isPinModalOpen).toBe(true);

      // User enters correct PIN
      act(() => {
        scene1.current.verifyPin('1234');
      });
      expect(scene1.current.isAuthorized).toBe(true);
      expect(scene1.current.isPinModalOpen).toBe(false);

      // === Scene 2: User is on parent dashboard ===
      // (simulated by unmounting profile selection)
      unmount1();

      // Verify sessionStorage has authorization
      expect(sessionStorageMock.getItem(SESSION_ACCESS_KEY)).toBe('true');

      // === Scene 3: User clicks "Home", returns to profile selection ===
      // ProfileSelectionScreen mounts and calls revokeAccess
      const { result: scene3 } = renderHook(() => {
        const hook = useParentDashboardAccess();
        return hook;
      });

      // Initially authorized from sessionStorage
      expect(scene3.current.isAuthorized).toBe(true);

      // ProfileSelectionScreen's useEffect runs and revokes access
      act(() => {
        scene3.current.revokeAccess();
      });

      // Now unauthorized
      expect(scene3.current.isAuthorized).toBe(false);
      expect(sessionStorageMock.getItem(SESSION_ACCESS_KEY)).toBe(null);

      // === Scene 4: User clicks Parents card again ===
      act(() => {
        scene3.current.requestAccess();
      });

      // PIN modal should open (not bypass!)
      expect(scene3.current.isPinModalOpen).toBe(true);
      expect(scene3.current.isCreatingPin).toBe(false); // Verifying existing PIN
    });
  });
});

