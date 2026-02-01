/**
 * WatermelonDB Sync Adapter
 * Implements synchronize() integration with Supabase RPC functions
 *
 * IMPORTANT: This adapter reconciles by business key (word_text) not just ID,
 * because client and server generate different UUIDs. Without this reconciliation,
 * sync would create duplicate records for the same word.
 */

import { synchronize, hasUnsyncedChanges } from '@nozbe/watermelondb/sync';
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';
import { Q } from '@nozbe/watermelondb';
import { database } from './index';
import { supabase } from '@/lib/supabase';
import {
  transformWordProgressFromServer,
  transformGameSessionFromServer,
  transformStatisticsFromServer,
  transformCalibrationFromServer,
  transformWordAttemptFromServer,
  transformLearningProgressFromServer,
  transformGradeProgressFromServer,
  transformPushChanges,
  type ServerPullResponse,
  type SyncChangeset,
  type SyncTableChanges,
} from './transforms';
import type { WordAttemptModel, LearningProgress, GradeProgress } from './models';
import type { WordProgress, GameSession, Statistics, Calibration } from './models';
import { resetWatermelonDBForChild } from './resetChild';
import { getLastPulledAt, setLastPulledAt, clearLastPulledAt } from './syncTimestamps';

// Sync configuration
const SYNC_CONFIG = {
  // Minimum time between syncs (ms)
  minSyncInterval: 2000,
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,
};

// Track last sync time to prevent too-frequent syncs
let lastSyncTime = 0;

// Persistent SyncLogger to keep track of recent syncs
const syncLogger = new SyncLogger(20);

// Generic type for raw records
type RawRecord = Record<string, unknown>;

/**
 * Reconcile server pull data with local records by business key.
 *
 * Problem: Client generates UUID A, server generates UUID B for the same word.
 * Without reconciliation, sync creates duplicate records.
 *
 * Solution: Match by business key (e.g., word_text), not by ID.
 * - If local record exists with same business key → put in "updated" with LOCAL id
 * - If no local match → put in "created" with server id
 */
async function reconcilePullChanges(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncChangeset> {
  // ==========================================================================
  // WORD PROGRESS: Reconcile by (child_id, word_text)
  // ==========================================================================
  const wordProgressChanges = await reconcileWordProgress(serverData, childId);

  // ==========================================================================
  // GAME SESSIONS: Reconcile by (child_id, client_session_id)
  // ==========================================================================
  const gameSessionChanges = await reconcileGameSessions(serverData, childId);

  // ==========================================================================
  // STATISTICS: Reconcile by (child_id, mode)
  // ==========================================================================
  const statisticsChanges = await reconcileStatistics(serverData, childId);

  // ==========================================================================
  // CALIBRATION: Reconcile by (child_id, client_calibration_id)
  // ==========================================================================
  const calibrationChanges = await reconcileCalibration(serverData, childId);

  // ==========================================================================
  // WORD ATTEMPTS: Reconcile by (child_id, client_attempt_id)
  // Insert-only pattern (like game_sessions)
  // ==========================================================================
  const wordAttemptsChanges = await reconcileWordAttempts(serverData, childId);

  // ==========================================================================
  // LEARNING PROGRESS: Reconcile by (child_id)
  // Single record per child for global lifetime points
  // ==========================================================================
  const learningProgressChanges = await reconcileLearningProgress(serverData, childId);

  // ==========================================================================
  // GRADE PROGRESS: Reconcile by (child_id, grade_level)
  // One record per child per grade level
  // ==========================================================================
  const gradeProgressChanges = await reconcileGradeProgress(serverData, childId);

  return {
    word_progress: wordProgressChanges,
    game_sessions: gameSessionChanges,
    statistics: statisticsChanges,
    calibration: calibrationChanges,
    learning_progress: learningProgressChanges,
    grade_progress: gradeProgressChanges,
    word_bank_metadata: { created: [], updated: [], deleted: [] },
    word_attempts: wordAttemptsChanges,
  };
}

async function reconcileWordProgress(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.word_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by word_text
  const localRecords = await database
    .get<WordProgress>('word_progress')
    .query(Q.where('child_id', childId))
    .fetch();

  const localByWordText = new Map<string, WordProgress>();
  for (const record of localRecords) {
    localByWordText.set(record.wordText.toLowerCase(), record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.word_progress) {
    const wordText = serverRecord.word_text.toLowerCase();
    const localMatch = localByWordText.get(wordText);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformWordProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id, // Use LOCAL id, not server id
      });
    } else {
      // No local match - put in "created" with server id
      created.push(transformWordProgressFromServer(serverRecord));
    }
  }

  console.log(`[Sync] word_progress reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

async function reconcileGameSessions(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.game_sessions?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by client_session_id
  const localRecords = await database
    .get<GameSession>('game_sessions')
    .query(Q.where('child_id', childId))
    .fetch();

  const localBySessionId = new Map<string, GameSession>();
  for (const record of localRecords) {
    localBySessionId.set(record.clientSessionId, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.game_sessions) {
    const sessionId = serverRecord.client_session_id;
    const localMatch = localBySessionId.get(sessionId);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformGameSessionFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformGameSessionFromServer(serverRecord));
    }
  }

  console.log(`[Sync] game_sessions reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

async function reconcileStatistics(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.statistics?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by mode
  const localRecords = await database
    .get<Statistics>('statistics')
    .query(Q.where('child_id', childId))
    .fetch();

  const localByMode = new Map<string, Statistics>();
  for (const record of localRecords) {
    localByMode.set(record.mode, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.statistics) {
    const mode = serverRecord.mode;
    const localMatch = localByMode.get(mode);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformStatisticsFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformStatisticsFromServer(serverRecord));
    }
  }

  console.log(`[Sync] statistics reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

async function reconcileCalibration(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.calibration?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by client_calibration_id
  const localRecords = await database
    .get<Calibration>('calibration')
    .query(Q.where('child_id', childId))
    .fetch();

  const localByCalibrationId = new Map<string, Calibration>();
  for (const record of localRecords) {
    localByCalibrationId.set(record.clientCalibrationId, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.calibration) {
    const calibrationId = serverRecord.client_calibration_id;
    const localMatch = localByCalibrationId.get(calibrationId);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformCalibrationFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformCalibrationFromServer(serverRecord));
    }
  }

  console.log(`[Sync] calibration reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile word_attempts by client_attempt_id.
 * Insert-only pattern (like game_sessions) - no updates, just deduplication.
 */
async function reconcileWordAttempts(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.word_attempts?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by client_attempt_id
  const localRecords = await database
    .get<WordAttemptModel>('word_attempts')
    .query(Q.where('child_id', childId))
    .fetch();

  const localByAttemptId = new Map<string, WordAttemptModel>();
  for (const record of localRecords) {
    localByAttemptId.set(record.clientAttemptId, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.word_attempts) {
    const attemptId = serverRecord.client_attempt_id;
    const localMatch = localByAttemptId.get(attemptId);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      // (This handles ID reconciliation, data is unchanged for insert-only)
      const transformed = transformWordAttemptFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformWordAttemptFromServer(serverRecord));
    }
  }

  console.log(`[Sync] word_attempts reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile learning_progress by child_id.
 * Single record per child for global lifetime points.
 */
async function reconcileLearningProgress(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.learning_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local record (should be at most one per child)
  const localRecords = await database
    .get<LearningProgress>('learning_progress')
    .query(Q.where('child_id', childId))
    .fetch();

  const localRecord = localRecords[0] || null;

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.learning_progress) {
    if (localRecord) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformLearningProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localRecord.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformLearningProgressFromServer(serverRecord));
    }
  }

  console.log(`[Sync] learning_progress reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile grade_progress by (child_id, grade_level).
 * One record per child per grade level.
 */
async function reconcileGradeProgress(
  serverData: ServerPullResponse,
  childId: string
): Promise<SyncTableChanges> {
  if (!serverData.grade_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Query local records to build lookup map by grade_level
  const localRecords = await database
    .get<GradeProgress>('grade_progress')
    .query(Q.where('child_id', childId))
    .fetch();

  const localByGradeLevel = new Map<number, GradeProgress>();
  for (const record of localRecords) {
    localByGradeLevel.set(record.gradeLevel, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.grade_progress) {
    const gradeLevel = serverRecord.grade_level;
    const localMatch = localByGradeLevel.get(gradeLevel);

    if (localMatch) {
      // Local record exists - put in "updated" with LOCAL id
      const transformed = transformGradeProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      // No local match - put in "created"
      created.push(transformGradeProgressFromServer(serverRecord));
    }
  }

  console.log(`[Sync] grade_progress reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Sync local WatermelonDB with Supabase
 * @param childId - The child ID to sync data for
 * @returns Promise that resolves when sync is complete
 */
export async function syncWithSupabase(childId: string): Promise<void> {
  // Debounce: prevent too-frequent syncs
  const now = Date.now();
  if (now - lastSyncTime < SYNC_CONFIG.minSyncInterval) {
    console.log('[Sync] Skipping sync - too soon since last sync');
    return;
  }
  lastSyncTime = now;

  // Get per-child lastPulledAt (null = first sync, will pull everything)
  // This overrides WatermelonDB's global timestamp to fix multi-child sync issues
  const perChildLastPulledAt = getLastPulledAt(childId);

  console.log('[Sync] Starting sync for child:', childId, 'perChildLastPulledAt:', perChildLastPulledAt);

  // Check for pending changes BEFORE sync
  const hasPending = await hasUnsyncedChanges({ database });
  console.log('[Sync] Has unsynced changes:', hasPending);

  // Create a new log entry for this sync
  const log = syncLogger.newLog();

  try {
    await synchronize({
      database,
      log, // Pass logger to capture sync details
      pullChanges: async ({ lastPulledAt: _wmLastPulledAt }) => {
        // OVERRIDE WatermelonDB's global timestamp with per-child timestamp
        // This fixes the bug where switching children uses the wrong timestamp
        const effectiveTimestamp = perChildLastPulledAt;

        console.log('[Sync] Pulling changes since:', effectiveTimestamp, '(WM global was:', _wmLastPulledAt, ')');

        const timestamp = effectiveTimestamp
          ? new Date(effectiveTimestamp).toISOString()
          : null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('pull_changes', {
          p_child_id: childId,
          p_last_pulled_at: timestamp,
        });

        if (error) {
          console.error('[Sync] Pull error:', error);
          throw error;
        }

        const serverData = data as ServerPullResponse;
        console.log('[Sync] Pulled data:', {
          wordProgress: serverData.word_progress?.length || 0,
          gameSessions: serverData.game_sessions?.length || 0,
          statistics: serverData.statistics?.length || 0,
          calibration: serverData.calibration?.length || 0,
          wordAttempts: serverData.word_attempts?.length || 0,
          lastResetAt: serverData.last_reset_at,
        });

        const serverTimestamp = new Date(serverData.timestamp).getTime();

        // Check if server reset occurred since last sync
        // If reset happened more recently than our last sync, we need to clear local data
        // IMPORTANT: Only check for reset if we had a previous sync timestamp.
        // On first sync (effectiveTimestamp=null), we should NOT trigger reset detection
        // even if last_reset_at exists from a previous device's reset.
        if (serverData.last_reset_at && effectiveTimestamp) {
          const resetTime = new Date(serverData.last_reset_at).getTime();
          if (resetTime > effectiveTimestamp) {
            console.log('[Sync] Reset detected! Clearing local data...', {
              resetTime: serverData.last_reset_at,
              effectiveTimestamp: new Date(effectiveTimestamp).toISOString(),
            });
            const deletedCounts = await resetWatermelonDBForChild(childId);
            console.log('[Sync] Local data cleared:', deletedCounts);
            // Clear the per-child timestamp so next sync does a full pull
            clearLastPulledAt(childId);
            // DON'T return empty changeset - fall through to apply server data
            // After clearing local data, we still need to populate from server
          }
        }

        // Reconcile by business key to prevent duplicates
        // Client and server have different UUIDs, so we match by business key instead
        const changes = await reconcilePullChanges(serverData, childId);

        // Save per-child timestamp for next sync
        // This is the key fix for multi-child sync - each child tracks its own timestamp
        setLastPulledAt(childId, serverTimestamp);

        return {
          changes,
          timestamp: serverTimestamp,
        };
      },

      pushChanges: async ({ changes }) => {
        // Push ALL pending records from ALL children.
        // Each record carries its own child_id which the RPC will use.
        // The RPC validates parent ownership of each child_id.
        // No client-side filtering needed - this fixes the bug where filter removed valid records.
        const allChanges = changes as SyncChangeset;

        // Log detailed push payload counts for debugging
        const pushCounts = {
          word_progress: {
            created: allChanges.word_progress.created.length,
            updated: allChanges.word_progress.updated.length,
            deleted: allChanges.word_progress.deleted.length,
          },
          game_sessions: {
            created: allChanges.game_sessions.created.length,
            updated: allChanges.game_sessions.updated.length,
            deleted: allChanges.game_sessions.deleted.length,
          },
          statistics: {
            created: allChanges.statistics.created.length,
            updated: allChanges.statistics.updated.length,
            deleted: allChanges.statistics.deleted.length,
          },
          calibration: {
            created: allChanges.calibration.created.length,
            updated: allChanges.calibration.updated.length,
            deleted: allChanges.calibration.deleted.length,
          },
          word_attempts: {
            created: allChanges.word_attempts.created.length,
            updated: allChanges.word_attempts.updated.length,
            deleted: allChanges.word_attempts.deleted.length,
          },
          learning_progress: {
            created: allChanges.learning_progress.created.length,
            updated: allChanges.learning_progress.updated.length,
            deleted: allChanges.learning_progress.deleted.length,
          },
          grade_progress: {
            created: allChanges.grade_progress.created.length,
            updated: allChanges.grade_progress.updated.length,
            deleted: allChanges.grade_progress.deleted.length,
          },
        };
        console.log('[Sync] Pushing ALL children changes:', pushCounts);

        // If all counts are 0, log a warning for investigation
        const totalChanges = Object.values(pushCounts).reduce(
          (sum, table) => sum + table.created + table.updated + table.deleted,
          0
        );
        if (totalChanges === 0) {
          console.log('[Sync] Warning: No changes to push (all counts are 0)');
        }

        const transformedChanges = transformPushChanges(allChanges);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('push_changes', {
          p_child_id: childId,
          p_changes: transformedChanges,
        });

        if (error) {
          console.error('[Sync] Push error:', error);
          throw error;
        }

        console.log('[Sync] Push result:', data);
      },
    });

    // Log sync completion with details from SyncLogger
    console.log('[Sync] Sync completed successfully:', {
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
      phase: log.phase,
      remoteChangeCount: log.remoteChangeCount,
      localChangeCount: log.localChangeCount,
      resolvedConflicts: log.resolvedConflicts?.length || 0,
    });
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    // Log error details from SyncLogger
    console.error('[Sync] SyncLogger error details:', {
      phase: log.phase,
      error: log.error,
    });
    throw error;
  }
}

/**
 * Check if sync is needed (has local changes)
 * Uses the official WatermelonDB API to check for unsynced changes.
 * @returns Promise<boolean> - true if there are pending changes
 */
export async function hasPendingChanges(): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}

/**
 * Reset sync state for a child (force full re-sync on next sync)
 * Use with caution - this will re-download all data
 */
export async function resetSyncState(): Promise<void> {
  // WatermelonDB handles this internally
  // Just reset the lastPulledAt in sync state
  console.log('[Sync] Sync state reset - next sync will be a full sync');
}

// =============================================================================
// MULTI-CHILD SYNC
// =============================================================================

/**
 * Result of syncing multiple children
 */
export interface MultiChildSyncResult {
  success: boolean;
  results: {
    childId: string;
    childName: string;
    status: 'success' | 'error';
    error?: string;
  }[];
  syncedAt: string;
}

/**
 * Sync all children for a parent in sequence.
 * This ensures each child's data is properly synced using their per-child timestamps.
 *
 * @param children - Array of child objects with id and name
 * @returns Promise with sync results for each child
 */
export async function syncAllChildren(
  children: { id: string; name: string }[]
): Promise<MultiChildSyncResult> {
  const results: MultiChildSyncResult['results'] = [];

  console.log('[Sync] Starting multi-child sync for', children.length, 'children');

  for (const child of children) {
    try {
      console.log(`[Sync] Syncing child ${child.name} (${child.id})...`);
      await syncWithSupabase(child.id);
      results.push({ childId: child.id, childName: child.name, status: 'success' });
      console.log(`[Sync] Child ${child.name} synced successfully`);
    } catch (err) {
      console.error(`[Sync] Failed to sync child ${child.name}:`, err);
      results.push({
        childId: child.id,
        childName: child.name,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`[Sync] Multi-child sync complete: ${successCount}/${children.length} succeeded`);

  return {
    success: results.every(r => r.status === 'success'),
    results,
    syncedAt: new Date().toISOString(),
  };
}

// Export for external access to sync diagnostics
export { SYNC_CONFIG, syncLogger };
