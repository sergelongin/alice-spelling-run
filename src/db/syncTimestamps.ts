/**
 * Per-Child Sync Timestamp Tracking
 *
 * WatermelonDB uses a global `lastPulledAt` timestamp, which causes issues when
 * switching between children. For example:
 * - Child A syncs at timestamp 100
 * - Switch to Child B (who has data created at timestamp 50)
 * - WatermelonDB uses timestamp 100 for Child B's pull
 * - Child B's data is filtered out because it's "before" the last sync
 *
 * This module tracks `lastPulledAt` per-child in localStorage, bypassing
 * WatermelonDB's global tracking.
 */

const STORAGE_KEY = 'alice-sync-timestamps';

interface SyncTimestamps {
  [childId: string]: number | null;
}

/**
 * Get the last pulled timestamp for a specific child.
 * @returns timestamp in milliseconds, or null if never synced
 */
export function getLastPulledAt(childId: string): number | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const timestamps: SyncTimestamps = JSON.parse(data);
    return timestamps[childId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Save the last pulled timestamp for a specific child.
 * @param childId - The child ID
 * @param timestamp - Timestamp in milliseconds
 */
export function setLastPulledAt(childId: string, timestamp: number): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const timestamps: SyncTimestamps = data ? JSON.parse(data) : {};
    timestamps[childId] = timestamp;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  } catch (err) {
    console.error('[SyncTimestamps] Failed to save:', err);
  }
}

/**
 * Clear the sync timestamp for a specific child.
 * Use this when resetting child progress to force a full re-sync.
 */
export function clearLastPulledAt(childId: string): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    const timestamps: SyncTimestamps = JSON.parse(data);
    delete timestamps[childId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
    console.log('[SyncTimestamps] Cleared timestamp for child:', childId);
  } catch {
    // Silently ignore errors
  }
}

/**
 * Clear all sync timestamps.
 * Use this when logging out or resetting the entire app.
 */
export function clearAllSyncTimestamps(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[SyncTimestamps] Cleared all timestamps');
}

/**
 * Get all stored sync timestamps (for debugging).
 */
export function getAllSyncTimestamps(): SyncTimestamps {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}
