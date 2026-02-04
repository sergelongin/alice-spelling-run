/**
 * Word Catalog Sync
 * Pull-only sync for the word catalog from Supabase to local WatermelonDB.
 *
 * This is SEPARATE from per-child sync because:
 * 1. Word catalog is global (not per-child)
 * 2. It's pull-only (client never modifies system words)
 * 3. Custom words are added via Supabase API directly
 *
 * Sync pattern:
 * - Fetch system words (is_custom=false)
 * - Fetch parent's custom words (created_by=parentId)
 * - Upsert into local word_catalog table
 */

import { Q } from '@nozbe/watermelondb';
import { database, wordCatalogCollection } from './index';
import { WordCatalog } from './models/WordCatalog';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Storage key for last sync timestamp
const WORD_CATALOG_SYNC_KEY = 'alice-spelling-run-word-catalog-sync';

// Minimum time between syncs (5 minutes)
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Maximum age before forcing a refresh (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

interface WordCatalogSyncState {
  lastSyncedAt: number | null;
  parentId: string | null;
}

interface ServerWord {
  id: string;
  word: string;
  word_normalized: string;
  definition: string;
  example: string | null;
  grade_level: number;
  is_custom: boolean;
  created_by: string | null;
  updated_at: string;
}

interface PullResponse {
  words: ServerWord[];
  deleted_ids: string[];
  timestamp: string;
}

/**
 * Get the last sync state from localStorage
 */
function getSyncState(): WordCatalogSyncState {
  try {
    const stored = localStorage.getItem(WORD_CATALOG_SYNC_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { lastSyncedAt: null, parentId: null };
}

/**
 * Save sync state to localStorage
 */
function setSyncState(state: WordCatalogSyncState): void {
  try {
    localStorage.setItem(WORD_CATALOG_SYNC_KEY, JSON.stringify(state));
  } catch {
    console.warn('[WordCatalogSync] Failed to save sync state');
  }
}

/**
 * Check if sync is needed based on time elapsed
 */
export function shouldSyncWordCatalog(parentId: string | null): boolean {
  const state = getSyncState();

  // If parent changed, need full sync
  if (state.parentId !== parentId) {
    return true;
  }

  // If never synced, need sync
  if (!state.lastSyncedAt) {
    return true;
  }

  // If cache is stale (> 24 hours), need sync
  const age = Date.now() - state.lastSyncedAt;
  if (age > MAX_CACHE_AGE_MS) {
    return true;
  }

  return false;
}

/**
 * Check if we should skip sync due to rate limiting
 */
function isRateLimited(): boolean {
  const state = getSyncState();
  if (!state.lastSyncedAt) return false;
  return Date.now() - state.lastSyncedAt < MIN_SYNC_INTERVAL_MS;
}

/**
 * Sync word catalog from Supabase to local WatermelonDB.
 *
 * @param parentId - The parent's user ID (for fetching their custom words)
 * @param forceFullSync - If true, ignore incremental sync and fetch all words
 */
export async function syncWordCatalog(
  parentId: string | null,
  forceFullSync = false
): Promise<{ synced: number; deleted: number; error: string | null }> {
  // Skip if Supabase not configured
  if (!isSupabaseConfigured()) {
    console.log('[WordCatalogSync] Skipping - Supabase not configured');
    return { synced: 0, deleted: 0, error: null };
  }

  // Rate limit check (unless forcing)
  if (!forceFullSync && isRateLimited()) {
    console.log('[WordCatalogSync] Skipping - rate limited');
    return { synced: 0, deleted: 0, error: null };
  }

  const state = getSyncState();

  // Determine if we need a full sync
  const needsFullSync = forceFullSync || state.parentId !== parentId || !state.lastSyncedAt;
  const lastSyncedAt = needsFullSync ? null : new Date(state.lastSyncedAt!).toISOString();

  console.log('[WordCatalogSync] Starting sync', {
    parentId,
    incremental: !needsFullSync,
    lastSyncedAt,
  });

  try {
    // Call the RPC function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('pull_word_catalog', {
      p_parent_id: parentId,
      p_last_synced_at: lastSyncedAt,
    });

    if (error) {
      console.error('[WordCatalogSync] RPC error:', error);
      return { synced: 0, deleted: 0, error: error.message };
    }

    const response = data as PullResponse;
    const words = response.words || [];
    const deletedIds = response.deleted_ids || [];

    console.log('[WordCatalogSync] Received', {
      words: words.length,
      deleted: deletedIds.length,
    });

    // Process in a single database write transaction
    await database.write(async () => {
      // Handle deletions first
      for (const serverId of deletedIds) {
        const existing = await wordCatalogCollection
          .query(Q.where('server_id', serverId))
          .fetch();

        for (const record of existing) {
          await record.destroyPermanently();
        }
      }

      // Upsert words
      for (const word of words) {
        // Check if record exists by server_id
        const existing = await wordCatalogCollection
          .query(Q.where('server_id', word.id))
          .fetch();

        if (existing.length > 0) {
          // Update existing record
          // Use _raw.column_name pattern for reliable persistence
          // Decorated setters may not persist due to Vite/esbuild decorator transpilation issues
          await existing[0].update((record: WordCatalog) => {
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_text = word.word;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_normalized = word.word_normalized;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.definition = word.definition;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.example_sentence = word.example || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.grade_level = word.grade_level;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.is_custom = word.is_custom;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.created_by = word.created_by || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.server_updated_at = new Date(word.updated_at).getTime();
          });
        } else {
          // Create new record
          // Use _raw.column_name pattern for reliable persistence
          await wordCatalogCollection.create((record: WordCatalog) => {
            record._raw.id = crypto.randomUUID();
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_text = word.word;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.word_normalized = word.word_normalized;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.definition = word.definition;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.example_sentence = word.example || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.grade_level = word.grade_level;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.is_custom = word.is_custom;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.created_by = word.created_by || null;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.server_id = word.id;
            // @ts-expect-error - WatermelonDB _raw setters not typed
            record._raw.server_updated_at = new Date(word.updated_at).getTime();
          });
        }
      }
    });

    // Update sync state
    setSyncState({
      lastSyncedAt: Date.now(),
      parentId,
    });

    console.log('[WordCatalogSync] Sync complete', {
      synced: words.length,
      deleted: deletedIds.length,
    });

    return { synced: words.length, deleted: deletedIds.length, error: null };
  } catch (err) {
    console.error('[WordCatalogSync] Sync failed:', err);
    return {
      synced: 0,
      deleted: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get the count of words in the local catalog
 */
export async function getLocalCatalogCount(): Promise<number> {
  return wordCatalogCollection.query().fetchCount();
}

/**
 * Check if local catalog has been populated
 */
export async function hasLocalCatalog(): Promise<boolean> {
  const count = await getLocalCatalogCount();
  return count > 0;
}

/**
 * Clear the local word catalog (for testing/debugging)
 */
export async function clearLocalCatalog(): Promise<void> {
  await database.write(async () => {
    const all = await wordCatalogCollection.query().fetch();
    for (const record of all) {
      await record.destroyPermanently();
    }
  });

  // Clear sync state
  localStorage.removeItem(WORD_CATALOG_SYNC_KEY);
}
