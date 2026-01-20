import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  getCachedSession,
  setCachedSession,
  getCachedProfile,
  setCachedProfile,
  getCachedChildren,
  setCachedChildren,
  loadActiveChildFromCache,
  setCachedActiveChildId,
  clearAllAuthCache,
  hasSupabaseSessionStorage,
} from '@/lib/authCache';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import type {
  AuthContextValue,
  AuthState,
  UserProfile,
  ChildProfile,
  SignUpData,
  SignInData,
  AddChildData,
} from '@/types/auth';

const ACTIVE_CHILD_KEY = 'alice-spelling-run-active-child';
const SESSION_PROFILE_SELECTED_KEY = 'alice-spelling-run-profile-selected';

// Check if profile was already selected this browser session
function hasProfileBeenSelectedThisSession(): boolean {
  // Check sessionStorage first (explicit selection this session)
  if (sessionStorage.getItem(SESSION_PROFILE_SELECTED_KEY) === 'true') {
    return true;
  }
  // Fallback: if localStorage has active child, profile was previously selected
  // This handles cases where sessionStorage was lost (tab suspension, viewport changes)
  return localStorage.getItem(ACTIVE_CHILD_KEY) !== null;
}

function setProfileSelectedThisSession(selected: boolean): void {
  if (selected) {
    sessionStorage.setItem(SESSION_PROFILE_SELECTED_KEY, 'true');
  } else {
    sessionStorage.removeItem(SESSION_PROFILE_SELECTED_KEY);
  }
}

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  children: [],
  activeChild: null,
  isLoading: true,
  isValidating: false,
  cacheStatus: 'none',
  error: null,
  hasSelectedProfileThisSession: hasProfileBeenSelectedThisSession(),
};

// Create optimistic initial state from cache (synchronous)
function createOptimisticState(): AuthState {
  const cachedSession = getCachedSession();
  const hasSelectedProfile = hasProfileBeenSelectedThisSession();

  if (cachedSession) {
    const cachedProfile = getCachedProfile();
    const cachedChildren = getCachedChildren();
    const childrenList = cachedChildren?.children || [];
    const activeChild = loadActiveChildFromCache(childrenList);

    // Determine cache status - use the stalest component
    const isStale = cachedSession.isStale ||
      (cachedProfile?.isStale ?? true) ||
      (cachedChildren?.isStale ?? true);

    return {
      user: cachedSession.session.user,
      session: cachedSession.session,
      profile: cachedProfile?.profile || null,
      children: childrenList,
      activeChild,
      isLoading: false,  // Don't block UI!
      isValidating: true,  // Will validate in background
      cacheStatus: isStale ? 'stale' : 'fresh',
      error: null,
      hasSelectedProfileThisSession: hasSelectedProfile,
    };
  }

  // No cache - check if Supabase has session storage
  // If both our cache AND Supabase's storage are empty, user is definitely not logged in
  if (!hasSupabaseSessionStorage()) {
    return {
      ...initialState,
      isLoading: false,  // Don't show spinner - we KNOW there's no session
      isValidating: false,
      cacheStatus: 'none',
      hasSelectedProfileThisSession: hasSelectedProfile,
    };
  }

  // Cache expired but Supabase might have a session - need to validate
  return { ...initialState, isLoading: true, isValidating: false, cacheStatus: 'none', hasSelectedProfileThisSession: hasSelectedProfile };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children: childrenNodes }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => createOptimisticState());

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Auth] Error fetching profile:', error);
      return null;
    }

    return data as UserProfile;
  }, []);

  // Fetch children for a parent
  const fetchChildren = useCallback(async (parentId: string): Promise<ChildProfile[]> => {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Auth] Error fetching children:', error);
      return [];
    }

    return (data || []) as ChildProfile[];
  }, []);

  // Load saved active child from children list
  const loadActiveChild = useCallback((childrenList: ChildProfile[]): ChildProfile | null => {
    const savedId = localStorage.getItem(ACTIVE_CHILD_KEY);
    if (savedId) {
      const found = childrenList.find(c => c.id === savedId);
      if (found) return found;
    }
    // Default to first child if available
    return childrenList.length > 0 ? childrenList[0] : null;
  }, []);

  // Background validation - validates cached state and updates if needed
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, isLoading: false, isValidating: false }));
      return;
    }

    let cancelled = false;

    async function validateAndSync() {
      try {
        // Get current session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError || !session) {
          // Invalid session - clear everything
          clearAllAuthCache();
          setProfileSelectedThisSession(false);
          setState({ ...initialState, isLoading: false, isValidating: false, cacheStatus: 'none', hasSelectedProfileThisSession: false });
          return;
        }

        // Valid session - fetch profile and children in PARALLEL
        const [profile, childrenList] = await Promise.all([
          fetchProfile(session.user.id),
          fetchChildren(session.user.id),
        ]);

        if (cancelled) return;

        // Update caches with fresh data
        setCachedSession(session);
        if (profile) setCachedProfile(profile);
        setCachedChildren(childrenList);

        const activeChild = loadActiveChild(childrenList);

        setState(prev => ({
          user: session.user,
          session,
          profile,
          children: childrenList,
          activeChild,
          isLoading: false,
          isValidating: false,
          cacheStatus: 'fresh',
          error: null,
          hasSelectedProfileThisSession: prev.hasSelectedProfileThisSession,
        }));
      } catch (error) {
        console.error('[Auth] Validation error:', error);
        if (cancelled) return;

        // Keep cached data on error, mark as stale
        setState(prev => ({
          ...prev,
          isLoading: false,
          isValidating: false,
          cacheStatus: prev.user ? 'stale' : 'none',
        }));
      }
    }

    validateAndSync();

    // Set up auth state change listener
    // CRITICAL: Do NOT use async/await directly in this callback!
    // Supabase operations inside onAuthStateChange cause deadlocks.
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    // See: https://github.com/supabase/gotrue-js/issues/762
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth] Auth state changed:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          // Set intermediate loading state immediately (non-blocking)
          // This lets ProtectedRoute know auth is in progress
          setState(prev => ({
            ...prev,
            user: session.user,
            session,
            isLoading: true,  // Show loading while fetching profile/children
          }));

          // CRITICAL: Defer Supabase calls to prevent deadlock
          // The callback must complete before any Supabase operations can proceed
          setTimeout(async () => {
            const [profile, childrenList] = await Promise.all([
              fetchProfile(session.user.id),
              fetchChildren(session.user.id),
            ]);

            // Update caches
            setCachedSession(session);
            if (profile) setCachedProfile(profile);
            setCachedChildren(childrenList);

            const activeChild = loadActiveChild(childrenList);

            // FIX: Only reset profile selection if this is a GENUINE new sign-in.
            // SIGNED_IN fires not just for new logins, but also for:
            // - Session re-validation (opening DevTools, tab restoration)
            // - Token refresh that Supabase interprets as sign-in
            // - Initial page load with existing session
            //
            // If localStorage already has an active child, the user previously
            // selected a profile - this is just a session refresh, not a new login.
            const hadActiveChild = localStorage.getItem(ACTIVE_CHILD_KEY) !== null;
            const shouldResetProfileSelection = !hadActiveChild;

            if (shouldResetProfileSelection) {
              setProfileSelectedThisSession(false);
            }

            setState({
              user: session.user,
              session,
              profile,
              children: childrenList,
              activeChild,
              isLoading: false,
              isValidating: false,
              cacheStatus: 'fresh',
              error: null,
              // Preserve profile selection if they had an active child (session refresh)
              hasSelectedProfileThisSession: hadActiveChild,
            });
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          clearAllAuthCache();
          setProfileSelectedThisSession(false);
          setState({ ...initialState, isLoading: false, isValidating: false, cacheStatus: 'none', hasSelectedProfileThisSession: false });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setCachedSession(session);
          setState(prev => ({ ...prev, session, cacheStatus: 'fresh' }));
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchChildren, loadActiveChild]);

  // Sign up
  const signUp = useCallback(async (data: SignUpData): Promise<{ error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.displayName || null,
        },
      },
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return { error: error.message };
    }

    // Reset loading state - auth listener only fires if user gets logged in
    // (which doesn't happen with email confirmation required)
    setState(prev => ({ ...prev, isLoading: false }));
    return { error: null };
  }, []);

  // Sign in
  const signIn = useCallback(async (data: SignInData): Promise<{ error: string | null }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error.message }));
      return { error: error.message };
    }

    // Auth state change listener will handle the rest
    return { error: null };
  }, []);

  // Sign out - RELIABLE: Clear state first, then tell Supabase
  const signOut = useCallback(async () => {
    // 1. Clear all caches FIRST (synchronous, guaranteed)
    clearAllAuthCache();

    // 2. Update state immediately (don't wait for Supabase)
    setState({ ...initialState, isLoading: false, isValidating: false, cacheStatus: 'none' });

    // 3. Tell Supabase (fire and forget - don't block on this)
    supabase.auth.signOut().catch(err => {
      console.error('[Auth] Sign out error (ignored):', err);
    });
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (data: Partial<Pick<UserProfile, 'display_name'>>): Promise<{ error: string | null }> => {
      if (!state.user) return { error: 'Not authenticated' };

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', state.user.id);

      if (error) {
        return { error: error.message };
      }

      setState(prev => {
        const updatedProfile = prev.profile ? { ...prev.profile, ...data } : null;
        // Update cache
        if (updatedProfile) setCachedProfile(updatedProfile);
        return { ...prev, profile: updatedProfile };
      });

      return { error: null };
    },
    [state.user]
  );

  // Add child
  const addChild = useCallback(
    async (data: AddChildData): Promise<{ child: ChildProfile | null; error: string | null }> => {
      if (!state.user) return { child: null, error: 'Not authenticated' };

      const { data: newChild, error } = await supabase
        .from('children')
        .insert({
          parent_id: state.user.id,
          name: data.name,
          grade_level: data.gradeLevel,
        })
        .select()
        .single();

      if (error) {
        return { child: null, error: error.message };
      }

      const childProfile = newChild as ChildProfile;

      setState(prev => {
        const updatedChildren = [...prev.children, childProfile];
        // If this is the first child, make them active
        const activeChild = prev.activeChild || childProfile;
        if (!prev.activeChild) {
          setCachedActiveChildId(activeChild.id);
        }
        // Update cache
        setCachedChildren(updatedChildren);
        return {
          ...prev,
          children: updatedChildren,
          activeChild,
        };
      });

      return { child: childProfile, error: null };
    },
    [state.user]
  );

  // Update child
  const updateChild = useCallback(
    async (
      childId: string,
      data: Partial<Pick<ChildProfile, 'name' | 'grade_level'>>
    ): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('children')
        .update(data)
        .eq('id', childId);

      if (error) {
        return { error: error.message };
      }

      setState(prev => {
        const updatedChildren = prev.children.map(c => (c.id === childId ? { ...c, ...data } : c));
        const updatedActiveChild = prev.activeChild?.id === childId
          ? { ...prev.activeChild, ...data }
          : prev.activeChild;
        // Update cache
        setCachedChildren(updatedChildren);
        return {
          ...prev,
          children: updatedChildren,
          activeChild: updatedActiveChild,
        };
      });

      return { error: null };
    },
    []
  );

  // Remove child
  const removeChild = useCallback(
    async (childId: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('children')
        .delete()
        .eq('id', childId);

      if (error) {
        return { error: error.message };
      }

      setState(prev => {
        const updatedChildren = prev.children.filter(c => c.id !== childId);
        let activeChild = prev.activeChild;

        // If we removed the active child, switch to another
        if (prev.activeChild?.id === childId) {
          activeChild = updatedChildren.length > 0 ? updatedChildren[0] : null;
          setCachedActiveChildId(activeChild?.id || null);
        }

        // Update cache
        setCachedChildren(updatedChildren);

        return {
          ...prev,
          children: updatedChildren,
          activeChild,
        };
      });

      return { error: null };
    },
    []
  );

  // Set active child
  const setActiveChild = useCallback((childId: string | null) => {
    setCachedActiveChildId(childId);

    setState(prev => ({
      ...prev,
      activeChild: childId ? prev.children.find(c => c.id === childId) || null : null,
    }));
  }, []);

  // Select profile (Netflix-style: sets active child AND marks as selected this session)
  const selectProfile = useCallback((childId: string) => {
    setCachedActiveChildId(childId);
    setProfileSelectedThisSession(true);

    setState(prev => ({
      ...prev,
      activeChild: prev.children.find(c => c.id === childId) || null,
      hasSelectedProfileThisSession: true,
    }));
  }, []);

  // Clear profile selection (for "Switch Profile" functionality)
  const clearProfileSelection = useCallback(() => {
    setProfileSelectedThisSession(false);
    // Clear localStorage active child so the fallback check also returns false
    localStorage.removeItem(ACTIVE_CHILD_KEY);
    setCachedActiveChildId(null);

    setState(prev => ({
      ...prev,
      activeChild: null,
      hasSelectedProfileThisSession: false,
    }));
  }, []);

  // Computed role helpers
  const isSuperAdmin = state.profile?.role === 'super_admin';
  const isParent = state.profile?.role === 'parent';
  const hasChildren = state.children.length > 0;
  const needsChildSetup = !!state.user && isParent && !hasChildren;
  // Netflix-style: parents with children need to select a profile each session
  const needsProfileSelection = !!state.user && isParent && hasChildren && !state.hasSelectedProfileThisSession;

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      signIn,
      signOut,
      updateProfile,
      addChild,
      updateChild,
      removeChild,
      setActiveChild,
      selectProfile,
      clearProfileSelection,
      isSuperAdmin,
      isParent,
      hasChildren,
      needsChildSetup,
      needsProfileSelection,
    }),
    [
      state,
      signUp,
      signIn,
      signOut,
      updateProfile,
      addChild,
      updateChild,
      removeChild,
      setActiveChild,
      selectProfile,
      clearProfileSelection,
      isSuperAdmin,
      isParent,
      hasChildren,
      needsChildSetup,
      needsProfileSelection,
    ]
  );

  return <AuthContext.Provider value={value}>{childrenNodes}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
