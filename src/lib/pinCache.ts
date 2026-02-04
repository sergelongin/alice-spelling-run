/**
 * PIN cache for offline verification
 *
 * Stores the bcrypt hash locally so PIN can be verified when offline.
 * The hash is returned by the server after successful set/verify operations.
 */
import bcrypt from 'bcryptjs';

const PIN_CACHE_KEY = 'alice-auth-pin-cache';

interface CachedPin {
  hash: string;
  cachedAt: number;
}

/**
 * Get cached PIN hash for offline verification
 */
export function getCachedPinHash(): string | null {
  try {
    const raw = localStorage.getItem(PIN_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedPin = JSON.parse(raw);
    return cached.hash;
  } catch {
    return null;
  }
}

/**
 * Cache PIN hash for offline verification
 * Called after successful server-side set/verify
 */
export function setCachedPinHash(hash: string): void {
  const cached: CachedPin = {
    hash,
    cachedAt: Date.now(),
  };
  localStorage.setItem(PIN_CACHE_KEY, JSON.stringify(cached));
}

/**
 * Clear cached PIN hash
 * Called on logout or PIN reset
 */
export function clearCachedPinHash(): void {
  localStorage.removeItem(PIN_CACHE_KEY);
}

/**
 * Verify PIN offline using bcryptjs
 * Falls back to this when server is unreachable
 */
export async function verifyPinOffline(pin: string): Promise<boolean> {
  const hash = getCachedPinHash();
  if (!hash) return false;

  try {
    return await bcrypt.compare(pin, hash);
  } catch {
    return false;
  }
}

/**
 * Check if we have a cached PIN (for offline "has PIN" check)
 */
export function hasCachedPin(): boolean {
  return getCachedPinHash() !== null;
}
