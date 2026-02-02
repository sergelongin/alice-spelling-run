/**
 * WatermelonDB Sync Adapter - Parent-Level Sync
 *
 * This adapter syncs ALL children's data in one operation using the parent's ID.
 * It uses WatermelonDB's native lastPulledAt timestamp (no per-child timestamps).
 *
 * Key design decisions:
 * - One sync operation for all children (reduces complexity)
 * - Business-key reconciliation (client/server generate different UUIDs)
 * - Existing push_changes RPC already handles multi-child (uses record's child_id)
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
import { syncLog, analyzeServerResponse, SYNC_DEBUG } from './syncDebug';

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

// =============================================================================
// RECONCILIATION FUNCTIONS
// Match server records to local records by business key to prevent duplicates
// =============================================================================

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
  serverData: ServerPullResponse
): Promise<SyncChangeset> {
  // Process all tables in parallel for efficiency
  const [
    wordProgressChanges,
    gameSessionChanges,
    statisticsChanges,
    calibrationChanges,
    wordAttemptsChanges,
    learningProgressChanges,
    gradeProgressChanges,
  ] = await Promise.all([
    reconcileWordProgress(serverData),
    reconcileGameSessions(serverData),
    reconcileStatistics(serverData),
    reconcileCalibration(serverData),
    reconcileWordAttempts(serverData),
    reconcileLearningProgress(serverData),
    reconcileGradeProgress(serverData),
  ]);

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

/**
 * Reconcile word_progress by (child_id, word_text)
 * Enhanced with diagnostic logging
 */
async function reconcileWordProgress(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.word_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Analyze server response for data quality issues
  analyzeServerResponse(
    'word_progress',
    serverData.word_progress as unknown as Array<Record<string, unknown>>,
    ['child_id', 'word_text'],
    ['last_attempt_at', 'next_review_at', 'introduced_at', 'archived_at', 'updated_at']
  );

  // Get all unique child_ids from server data
  const childIds = [...new Set(serverData.word_progress.map(r => r.child_id))];

  // Query local records for all relevant children
  const localRecords = await database
    .get<WordProgress>('word_progress')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  // Build lookup map: "childId:wordText" -> local record
  const localByKey = new Map<string, WordProgress>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.wordText.toLowerCase()}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const serverRecord of serverData.word_progress) {
    // Validate required fields
    if (!serverRecord.word_text) {
      skipped.push({ id: serverRecord.id, reason: 'null word_text' });
      continue;
    }

    const key = `${serverRecord.child_id}:${serverRecord.word_text.toLowerCase()}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformWordProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id, // Use LOCAL id
      });
    } else {
      created.push(transformWordProgressFromServer(serverRecord));
    }
  }

  // Log reconciliation stats
  syncLog.reconcileStats('Reconcile', 'word_progress', {
    serverReceived: serverData.word_progress.length,
    skippedInvalid: skipped.length,
    matchedForUpdate: updated.length,
    createdNew: created.length,
  });

  syncLog.skippedRecords('Reconcile', 'word_progress', skipped);

  return { created, updated, deleted: [] };
}

/**
 * Reconcile game_sessions by (child_id, client_session_id)
 * Enhanced with diagnostic logging
 */
async function reconcileGameSessions(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.game_sessions?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Analyze server response for data quality issues
  analyzeServerResponse(
    'game_sessions',
    serverData.game_sessions as unknown as Array<Record<string, unknown>>,
    ['child_id', 'client_session_id', 'played_at'],
    ['played_at', 'created_at']
  );

  const childIds = [...new Set(serverData.game_sessions.map(r => r.child_id))];

  const localRecords = await database
    .get<GameSession>('game_sessions')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByKey = new Map<string, GameSession>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.clientSessionId}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const serverRecord of serverData.game_sessions) {
    // Validate required fields
    if (!serverRecord.client_session_id) {
      skipped.push({ id: serverRecord.id, reason: 'null client_session_id' });
      continue;
    }

    const key = `${serverRecord.child_id}:${serverRecord.client_session_id}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformGameSessionFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformGameSessionFromServer(serverRecord));
    }
  }

  // Log reconciliation stats
  syncLog.reconcileStats('Reconcile', 'game_sessions', {
    serverReceived: serverData.game_sessions.length,
    skippedInvalid: skipped.length,
    matchedForUpdate: updated.length,
    createdNew: created.length,
  });

  syncLog.skippedRecords('Reconcile', 'game_sessions', skipped);

  return { created, updated, deleted: [] };
}

/**
 * Reconcile statistics by (child_id, mode)
 */
async function reconcileStatistics(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.statistics?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  const childIds = [...new Set(serverData.statistics.map(r => r.child_id))];

  const localRecords = await database
    .get<Statistics>('statistics')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByKey = new Map<string, Statistics>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.mode}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.statistics) {
    const key = `${serverRecord.child_id}:${serverRecord.mode}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformStatisticsFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformStatisticsFromServer(serverRecord));
    }
  }

  console.log(`[Sync] statistics reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile calibration by (child_id, client_calibration_id)
 */
async function reconcileCalibration(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.calibration?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  const childIds = [...new Set(serverData.calibration.map(r => r.child_id))];

  const localRecords = await database
    .get<Calibration>('calibration')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByKey = new Map<string, Calibration>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.clientCalibrationId}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.calibration) {
    const key = `${serverRecord.child_id}:${serverRecord.client_calibration_id}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformCalibrationFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformCalibrationFromServer(serverRecord));
    }
  }

  console.log(`[Sync] calibration reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile word_attempts by (child_id, client_attempt_id)
 * Enhanced with diagnostic logging to detect sync issues
 */
async function reconcileWordAttempts(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.word_attempts?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Analyze server response for data quality issues
  analyzeServerResponse(
    'word_attempts',
    serverData.word_attempts as unknown as Array<Record<string, unknown>>,
    ['child_id', 'client_attempt_id', 'word_text', 'attempted_at'],
    ['attempted_at', 'created_at']
  );

  const childIds = [...new Set(serverData.word_attempts.map(r => r.child_id))];

  const localRecords = await database
    .get<WordAttemptModel>('word_attempts')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByKey = new Map<string, WordAttemptModel>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.clientAttemptId}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const serverRecord of serverData.word_attempts) {
    // Validate required fields before processing
    if (!serverRecord.client_attempt_id) {
      skipped.push({ id: serverRecord.id, reason: 'null client_attempt_id' });
      continue;
    }

    const key = `${serverRecord.child_id}:${serverRecord.client_attempt_id}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformWordAttemptFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformWordAttemptFromServer(serverRecord));
    }
  }

  // Log reconciliation stats
  syncLog.reconcileStats('Reconcile', 'word_attempts', {
    serverReceived: serverData.word_attempts.length,
    skippedInvalid: skipped.length,
    matchedForUpdate: updated.length,
    createdNew: created.length,
  });

  // Log skipped records (warnings)
  syncLog.skippedRecords('Reconcile', 'word_attempts', skipped);

  // Sample log for debugging
  syncLog.sample('Reconcile', 'word_attempts created', created);

  return { created, updated, deleted: [] };
}

/**
 * Reconcile learning_progress by child_id (one record per child)
 * Enhanced with diagnostic logging to detect sync timestamp issues
 */
async function reconcileLearningProgress(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.learning_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Analyze server response for data quality issues
  analyzeServerResponse(
    'learning_progress',
    serverData.learning_progress as unknown as Array<Record<string, unknown>>,
    ['child_id'],
    ['updated_at', 'client_updated_at']
  );

  const childIds = [...new Set(serverData.learning_progress.map(r => r.child_id))];

  const localRecords = await database
    .get<LearningProgress>('learning_progress')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByChildId = new Map<string, LearningProgress>();
  for (const record of localRecords) {
    localByChildId.set(record.childId, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.learning_progress) {
    const localMatch = localByChildId.get(serverRecord.child_id);

    if (localMatch) {
      const transformed = transformLearningProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformLearningProgressFromServer(serverRecord));
    }
  }

  console.log(`[Sync] learning_progress reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

/**
 * Reconcile grade_progress by (child_id, grade_level)
 * Enhanced with diagnostic logging to detect sync timestamp issues
 */
async function reconcileGradeProgress(
  serverData: ServerPullResponse
): Promise<SyncTableChanges> {
  if (!serverData.grade_progress?.length) {
    return { created: [], updated: [], deleted: [] };
  }

  // Analyze server response for data quality issues
  analyzeServerResponse(
    'grade_progress',
    serverData.grade_progress as unknown as Array<Record<string, unknown>>,
    ['child_id', 'grade_level'],
    ['updated_at', 'client_updated_at', 'first_point_at', 'last_activity_at']
  );

  const childIds = [...new Set(serverData.grade_progress.map(r => r.child_id))];

  const localRecords = await database
    .get<GradeProgress>('grade_progress')
    .query(Q.where('child_id', Q.oneOf(childIds)))
    .fetch();

  const localByKey = new Map<string, GradeProgress>();
  for (const record of localRecords) {
    const key = `${record.childId}:${record.gradeLevel}`;
    localByKey.set(key, record);
  }

  const created: RawRecord[] = [];
  const updated: RawRecord[] = [];

  for (const serverRecord of serverData.grade_progress) {
    const key = `${serverRecord.child_id}:${serverRecord.grade_level}`;
    const localMatch = localByKey.get(key);

    if (localMatch) {
      const transformed = transformGradeProgressFromServer(serverRecord);
      updated.push({
        ...transformed,
        id: localMatch.id,
      });
    } else {
      created.push(transformGradeProgressFromServer(serverRecord));
    }
  }

  console.log(`[Sync] grade_progress reconciled: ${created.length} created, ${updated.length} updated`);
  return { created, updated, deleted: [] };
}

// =============================================================================
// PARENT-LEVEL SYNC
// =============================================================================

/**
 * Check which children have no local data and need a full sync.
 * This handles the case where:
 * - Device A creates a child and adds data
 * - Device B has lastPulledAt from before the child existed
 * - Incremental sync returns 0 records (nothing changed since lastPulledAt)
 * - But Device B has no local data for that child
 *
 * Solution: Force a full pull (lastPulledAt = null) when any child has no local data.
 */
async function getChildrenNeedingFullSync(childIds: string[]): Promise<string[]> {
  if (childIds.length === 0) return [];

  const needsFullSync: string[] = [];

  for (const childId of childIds) {
    // Check if this child has ANY word_progress records locally
    // This is the primary indicator of whether data exists for this child
    const count = await database
      .get<WordProgress>('word_progress')
      .query(Q.where('child_id', childId))
      .fetchCount();

    if (count === 0) {
      needsFullSync.push(childId);
    }
  }

  return needsFullSync;
}

/**
 * Sync local WatermelonDB with Supabase for ALL children of a parent.
 * Uses WatermelonDB's native lastPulledAt timestamp.
 *
 * @param parentId - The parent's user ID
 * @param childIds - Array of child IDs (for reset detection)
 * @returns Promise that resolves when sync is complete
 */
export async function syncWithSupabaseForParent(
  parentId: string,
  childIds: string[] = []
): Promise<void> {
  // Debounce: prevent too-frequent syncs
  const now = Date.now();
  if (now - lastSyncTime < SYNC_CONFIG.minSyncInterval) {
    console.log('[Sync] Skipping sync - too soon since last sync');
    return;
  }
  lastSyncTime = now;

  console.log('[Sync] Starting parent-level sync for:', parentId, 'children:', childIds.length);

  // Check for pending changes BEFORE sync
  const hasPending = await hasUnsyncedChanges({ database });
  console.log('[Sync] Has unsynced changes:', hasPending);

  // Create a new log entry for this sync
  const log = syncLogger.newLog();

  try {
    await synchronize({
      database,
      log,
      pullChanges: async ({ lastPulledAt }) => {
        console.log('[Sync] Pulling changes since:', lastPulledAt);

        // Check if any children have no local data (need full sync)
        const childrenNeedingFullSync = await getChildrenNeedingFullSync(childIds);

        let effectiveTimestamp = lastPulledAt
          ? new Date(lastPulledAt).toISOString()
          : null;

        // Force full pull if any child has no local data
        // This handles the multi-device scenario where Device B synced before a child existed
        if (childrenNeedingFullSync.length > 0 && lastPulledAt !== null) {
          console.log('[Sync] Forcing full pull - children have no local data:', childrenNeedingFullSync);
          effectiveTimestamp = null;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('pull_changes_for_parent', {
          p_parent_id: parentId,
          p_last_pulled_at: effectiveTimestamp,
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
          learningProgress: serverData.learning_progress?.length || 0,
          gradeProgress: serverData.grade_progress?.length || 0,
          lastResetAt: serverData.last_reset_at,
        });

        const serverTimestamp = new Date(serverData.timestamp).getTime();

        // Check if any child had a reset since last sync
        // If reset happened, clear local data for that child
        if (serverData.last_reset_at && lastPulledAt) {
          const resetTime = new Date(serverData.last_reset_at).getTime();
          if (resetTime > lastPulledAt) {
            console.log('[Sync] Reset detected! Clearing local data...', {
              resetTime: serverData.last_reset_at,
              lastPulledAt: new Date(lastPulledAt).toISOString(),
            });
            // Clear all children's local data
            for (const childId of childIds) {
              const deletedCounts = await resetWatermelonDBForChild(childId);
              console.log(`[Sync] Local data cleared for ${childId}:`, deletedCounts);
            }
          }
        }

        // Reconcile by business key to prevent duplicates
        const changes = await reconcilePullChanges(serverData);

        return {
          changes,
          timestamp: serverTimestamp,
        };
      },

      pushChanges: async ({ changes }) => {
        const allChanges = changes as SyncChangeset;

        // Log detailed push payload counts
        // Note: Statistics and learning_progress are NOT pushed - they're computed server-side
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
          // statistics: PULL-ONLY (computed server-side from game_sessions)
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
          // learning_progress: PULL-ONLY (computed server-side from word_attempts)
          grade_progress: {
            created: allChanges.grade_progress.created.length,
            updated: allChanges.grade_progress.updated.length,
            deleted: allChanges.grade_progress.deleted.length,
          },
        };
        console.log('[Sync] Pushing changes (statistics+learning_progress=pull-only):', pushCounts);

        const totalChanges = Object.values(pushCounts).reduce(
          (sum, table) => sum + table.created + table.updated + table.deleted,
          0
        );
        if (totalChanges === 0) {
          console.log('[Sync] No changes to push');
          return;
        }

        const transformedChanges = transformPushChanges(allChanges);

        // push_changes still takes p_child_id for backward compat,
        // but uses record's child_id for actual inserts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('push_changes', {
          p_child_id: childIds[0] || parentId, // Backward compat param (ignored by RPC)
          p_changes: transformedChanges,
        });

        if (error) {
          console.error('[Sync] Push error:', error);
          throw error;
        }

        console.log('[Sync] Push result:', data);
      },
    });

    console.log('[Sync] Sync completed successfully:', {
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
      phase: log.phase,
      remoteChangeCount: log.remoteChangeCount,
      localChangeCount: log.localChangeCount,
      resolvedConflicts: log.resolvedConflicts?.length || 0,
    });

    // Post-sync verification: check actual local counts
    if (SYNC_DEBUG && childIds.length > 0) {
      const localCounts = await verifyLocalCounts(childIds);
      const childIdPreview = childIds.length === 1
        ? childIds[0]
        : `${childIds[0].slice(0, 8)}... (+${childIds.length - 1} more)`;
      syncLog.info('Verify', `Local counts after sync for ${childIdPreview}:`, localCounts);
    }
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    console.error('[Sync] SyncLogger error details:', {
      phase: log.phase,
      error: log.error,
    });
    throw error;
  }
}

// =============================================================================
// LEGACY API (for backward compatibility during transition)
// =============================================================================

/**
 * @deprecated Use syncWithSupabaseForParent instead
 * Sync for a single child - now calls parent-level sync internally
 */
export async function syncWithSupabase(childId: string): Promise<void> {
  console.log('[Sync] Legacy syncWithSupabase called for child:', childId);

  // Get the parent ID from auth session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    console.warn('[Sync] No auth session - skipping sync');
    return;
  }

  // Call parent-level sync
  await syncWithSupabaseForParent(session.user.id, [childId]);
}

/**
 * @deprecated Use syncWithSupabaseForParent instead
 * Sync all children - now just calls parent-level sync once
 */
export async function syncAllChildren(
  children: { id: string; name: string }[]
): Promise<MultiChildSyncResult> {
  console.log('[Sync] Legacy syncAllChildren called for', children.length, 'children');

  // Get the parent ID from auth session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    console.warn('[Sync] No auth session - skipping sync');
    return {
      success: false,
      results: children.map(c => ({
        childId: c.id,
        childName: c.name,
        status: 'error' as const,
        error: 'No auth session',
      })),
      syncedAt: new Date().toISOString(),
    };
  }

  try {
    await syncWithSupabaseForParent(
      session.user.id,
      children.map(c => c.id)
    );

    return {
      success: true,
      results: children.map(c => ({
        childId: c.id,
        childName: c.name,
        status: 'success' as const,
      })),
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Sync] Parent-level sync failed:', err);
    return {
      success: false,
      results: children.map(c => ({
        childId: c.id,
        childName: c.name,
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      })),
      syncedAt: new Date().toISOString(),
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Verify local database counts after sync
 * Used for debugging to confirm records were actually inserted
 */
async function verifyLocalCounts(childIds: string[]): Promise<{
  word_attempts: number;
  word_progress: number;
  game_sessions: number;
  statistics: number;
  calibration: number;
  learning_progress: number;
  grade_progress: number;
}> {
  if (childIds.length === 0) {
    return {
      word_attempts: 0,
      word_progress: 0,
      game_sessions: 0,
      statistics: 0,
      calibration: 0,
      learning_progress: 0,
      grade_progress: 0,
    };
  }

  const [
    wordAttempts,
    wordProgress,
    gameSessions,
    statistics,
    calibration,
    learningProgress,
    gradeProgress,
  ] = await Promise.all([
    database.get<WordAttemptModel>('word_attempts').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<WordProgress>('word_progress').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<GameSession>('game_sessions').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<Statistics>('statistics').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<Calibration>('calibration').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<LearningProgress>('learning_progress').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
    database.get<GradeProgress>('grade_progress').query(Q.where('child_id', Q.oneOf(childIds))).fetchCount(),
  ]);

  return {
    word_attempts: wordAttempts,
    word_progress: wordProgress,
    game_sessions: gameSessions,
    statistics: statistics,
    calibration: calibration,
    learning_progress: learningProgress,
    grade_progress: gradeProgress,
  };
}

/**
 * Check if sync is needed (has local changes)
 */
export async function hasPendingChanges(): Promise<boolean> {
  return hasUnsyncedChanges({ database });
}

/**
 * Reset sync state (force full re-sync on next sync)
 */
export async function resetSyncState(): Promise<void> {
  console.log('[Sync] Sync state reset - next sync will be a full sync');
}

/**
 * Result of syncing (for backward compatibility)
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

// Export for external access to sync diagnostics
export { SYNC_CONFIG, syncLogger };
