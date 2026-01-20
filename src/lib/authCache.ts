import type { Session } from '@supabase/supabase-js';
import type { UserProfile, ChildProfile } from '@/types/auth';

const CACHE_KEYS = {
  SESSION: 'alice-auth-session-cache',
  PROFILE: 'alice-auth-profile-cache',
  CHILDREN: 'alice-auth-children-cache',
  ACTIVE_CHILD: 'alice-spelling-run-active-child',
} as const;

const CACHE_TTL = {
  SESSION: 5 * 60 * 1000,    // 5 minutes
  PROFILE: 30 * 60 * 1000,   // 30 minutes
  CHILDREN: 15 * 60 * 1000,  // 15 minutes
} as const;

interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
}

const CACHE_VERSION = 1;

// Generic cache operations
function readCache<T>(key: string): { data: T; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const cached: CachedData<T> = JSON.parse(raw);
    if (cached.version !== CACHE_VERSION) return null;

    const isStale = Date.now() > cached.expiresAt;
    return { data: cached.data, isStale };
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T, ttl: number): void {
  const cached: CachedData<T> = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttl,
    version: CACHE_VERSION,
  };
  localStorage.setItem(key, JSON.stringify(cached));
}

// Check if JWT is expired (with 60s safety margin)
export function isSessionExpired(session: Session): boolean {
  if (!session.expires_at) return true;
  return (session.expires_at * 1000) < (Date.now() + 60000);
}

// Session cache
export function getCachedSession(): { session: Session; isStale: boolean } | null {
  const result = readCache<Session>(CACHE_KEYS.SESSION);
  if (!result) return null;

  // Also check JWT expiry (not just cache TTL)
  if (isSessionExpired(result.data)) return null;

  return { session: result.data, isStale: result.isStale };
}

export function setCachedSession(session: Session): void {
  writeCache(CACHE_KEYS.SESSION, session, CACHE_TTL.SESSION);
}

// Profile cache
export function getCachedProfile(): { profile: UserProfile; isStale: boolean } | null {
  const result = readCache<UserProfile>(CACHE_KEYS.PROFILE);
  return result ? { profile: result.data, isStale: result.isStale } : null;
}

export function setCachedProfile(profile: UserProfile): void {
  writeCache(CACHE_KEYS.PROFILE, profile, CACHE_TTL.PROFILE);
}

// Children cache
export function getCachedChildren(): { children: ChildProfile[]; isStale: boolean } | null {
  const result = readCache<ChildProfile[]>(CACHE_KEYS.CHILDREN);
  return result ? { children: result.data, isStale: result.isStale } : null;
}

export function setCachedChildren(children: ChildProfile[]): void {
  writeCache(CACHE_KEYS.CHILDREN, children, CACHE_TTL.CHILDREN);
}

// Active child helpers (uses same key as AuthContext for compatibility)
export function getCachedActiveChildId(): string | null {
  return localStorage.getItem(CACHE_KEYS.ACTIVE_CHILD);
}

export function setCachedActiveChildId(childId: string | null): void {
  if (childId) {
    localStorage.setItem(CACHE_KEYS.ACTIVE_CHILD, childId);
  } else {
    localStorage.removeItem(CACHE_KEYS.ACTIVE_CHILD);
  }
}

// Load active child from cached children list
export function loadActiveChildFromCache(childrenList: ChildProfile[]): ChildProfile | null {
  const savedId = getCachedActiveChildId();
  if (savedId) {
    const found = childrenList.find(c => c.id === savedId);
    if (found) return found;
  }
  // Default to first child if available
  return childrenList.length > 0 ? childrenList[0] : null;
}

// Clear all auth caches
export function clearAllAuthCache(): void {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  // Also clear the Supabase internal storage
  localStorage.removeItem('alice-spelling-run-auth');
}

// Check if Supabase has any session data in localStorage (synchronous check)
// This allows us to immediately determine "no session" without async calls
export function hasSupabaseSessionStorage(): boolean {
  try {
    const raw = localStorage.getItem('alice-spelling-run-auth');
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Supabase stores session data with access_token
    return !!(data?.access_token || data?.currentSession?.access_token);
  } catch {
    return false;
  }
}

export { CACHE_KEYS };
