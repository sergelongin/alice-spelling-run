/**
 * IndexedDB-based audio cache for storing downloaded pronunciations locally
 * 7-day TTL to balance freshness with avoiding repeated downloads
 */

import type { AudioCacheEntry } from '@/types/audio';

const DB_NAME = 'alice-spelling-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB connection
 */
function initDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[AudioCache] IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[AudioCache] IndexedDB opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create audio store with indexes
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'word' });
        store.createIndex('voiceId', 'voiceId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        console.log('[AudioCache] Created audio store');
      }
    };
  });

  return dbInitPromise;
}

/**
 * Generate cache key for a word + voice combination
 */
function getCacheKey(word: string, voiceId: string): string {
  return `${word.toLowerCase().trim()}:${voiceId}`;
}

/**
 * Get cached audio entry
 */
export async function getCachedAudio(
  word: string,
  voiceId: string
): Promise<AudioCacheEntry | null> {
  try {
    const database = await initDB();
    const key = getCacheKey(word, voiceId);

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as AudioCacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
          // Expired - delete it and return null
          deleteCachedAudio(word, voiceId).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry);
      };
    });
  } catch (err) {
    console.error('[AudioCache] Get error:', err);
    return null;
  }
}

/**
 * Store audio in cache
 */
export async function setCachedAudio(
  word: string,
  voiceId: string,
  blobUrl: string,
  storagePath: string
): Promise<void> {
  try {
    const database = await initDB();
    const key = getCacheKey(word, voiceId);
    const now = Date.now();

    const entry: AudioCacheEntry = {
      word: key,
      voiceId,
      blobUrl,
      storagePath,
      cachedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[AudioCache] Cached audio for:', word);
        resolve();
      };
    });
  } catch (err) {
    console.error('[AudioCache] Set error:', err);
  }
}

/**
 * Delete cached audio entry
 */
export async function deleteCachedAudio(word: string, voiceId: string): Promise<void> {
  try {
    const database = await initDB();
    const key = getCacheKey(word, voiceId);

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('[AudioCache] Delete error:', err);
  }
}

/**
 * Clear all expired entries from cache
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const database = await initDB();
    const now = Date.now();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          // Revoke blob URL before deleting
          const entry = cursor.value as AudioCacheEntry;
          if (entry.blobUrl) {
            URL.revokeObjectURL(entry.blobUrl);
          }
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log('[AudioCache] Cleared', deletedCount, 'expired entries');
          resolve(deletedCount);
        }
      };
    });
  } catch (err) {
    console.error('[AudioCache] Clear expired error:', err);
    return 0;
  }
}

/**
 * Clear all cached audio
 */
export async function clearAllCache(): Promise<void> {
  try {
    const database = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // First revoke all blob URLs
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const entries = getAllRequest.result as AudioCacheEntry[];
        for (const entry of entries) {
          if (entry.blobUrl) {
            URL.revokeObjectURL(entry.blobUrl);
          }
        }

        // Then clear the store
        const clearRequest = store.clear();
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
          console.log('[AudioCache] Cleared all cache');
          resolve();
        };
      };
    });
  } catch (err) {
    console.error('[AudioCache] Clear all error:', err);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestEntry: Date | null }> {
  try {
    const database = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onerror = () => reject(countRequest.error);
      countRequest.onsuccess = () => {
        const count = countRequest.result;

        // Find oldest entry
        const index = store.index('cachedAt');
        const cursorRequest = index.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          const oldestEntry = cursor ? new Date((cursor.value as AudioCacheEntry).cachedAt) : null;
          resolve({ count, oldestEntry });
        };
      };
    });
  } catch (err) {
    console.error('[AudioCache] Stats error:', err);
    return { count: 0, oldestEntry: null };
  }
}

// Run cleanup on module load
clearExpiredCache().catch(console.error);
