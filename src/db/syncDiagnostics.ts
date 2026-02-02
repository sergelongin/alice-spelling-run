/**
 * Sync Diagnostics Module
 * Provides tools to check and repair WatermelonDB sync health.
 *
 * Uses official WatermelonDB diagnostic APIs:
 * - hasUnsyncedChanges: Check for pending local changes
 * - diagnoseSyncConsistency: Compare local and server state (when available)
 */

import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync';
import { Q } from '@nozbe/watermelondb';
import { database } from './index';
import { supabase } from '@/lib/supabase';
import { syncWithSupabase, syncLogger } from './sync';
import {
  transformWordProgressFromServer,
  transformGameSessionFromServer,
  transformStatisticsFromServer,
  transformCalibrationFromServer,
  transformWordAttemptFromServer,
  type ServerPullResponse,
} from './transforms';
import type { WordProgress, GameSession, Statistics, Calibration, WordAttemptModel, LearningProgress } from './models';

// =============================================================================
// TYPES
// =============================================================================

export type SyncHealthStatus = 'healthy' | 'has_unsynced' | 'inconsistent' | 'error' | 'offline' | 'checking';

export interface SyncHealthReport {
  status: SyncHealthStatus;
  hasUnsyncedChanges: boolean;
  inconsistencyCount: number;
  details: string;
  checkedAt: string;
  localCounts?: {
    wordProgress: number;
    gameSessions: number;
    statistics: number;
    calibration: number;
    wordAttempts: number;
    learningProgress: number;
  };
  serverCounts?: {
    wordProgress: number;
    gameSessions: number;
    statistics: number;
    calibration: number;
    wordAttempts: number;
    learningProgress: number;
  };
  lastSyncLog?: {
    startedAt?: Date;
    finishedAt?: Date;
    phase?: string;
    remoteChangeCount?: number;
    localChangeCount?: number;
    error?: string;
  };
  // Deep repair results (optional, only present after deep repair)
  orphanReport?: OrphanCleanupReport;
  refreshReport?: ForceRefreshReport;
}

export interface OrphanCleanupReport {
  status: 'success' | 'error' | 'skipped';
  orphansFound: { wordProgress: number; gameSessions: number; statistics: number; calibration: number; wordAttempts: number };
  orphansDeleted: { wordProgress: number; gameSessions: number; statistics: number; calibration: number; wordAttempts: number };
  skippedPendingUpload: { wordProgress: number; gameSessions: number; statistics: number; calibration: number; wordAttempts: number };
  details: string;
  executedAt: string;
}

export interface ForceRefreshReport {
  status: 'success' | 'error';
  deletedCounts: Record<string, number>;
  details: string;
  executedAt: string;
}

export interface HealOptions {
  /** Delete orphaned local records not present on server */
  includeOrphanCleanup?: boolean;
  /** Force refresh these collections from server (deletes local, re-pulls) */
  forceRefreshCollections?: ('word_progress' | 'statistics' | 'game_sessions' | 'calibration' | 'word_attempts')[];
  /** Dry run - report what would be deleted without actually deleting */
  dryRun?: boolean;
}

/** Response from get_record_keys RPC */
interface ServerRecordKeys {
  word_progress: string[];
  game_sessions: string[];
  statistics: string[];
  calibration: string[];
  word_attempts: string[];
}

// =============================================================================
// SYNC HEALTH CHECK
// =============================================================================

/**
 * Check the health of WatermelonDB sync for a specific child.
 * This function:
 * 1. Actually performs a sync (push local, pull server)
 * 2. Compares local and server record counts AFTER sync
 * 3. Returns a detailed health report
 *
 * By syncing first, this ensures "Check Sync Health" actually syncs data
 * rather than just reporting stale counts.
 *
 * @param childId - The child ID to check sync health for
 * @returns SyncHealthReport with status and details
 */
export async function checkSyncHealth(childId: string): Promise<SyncHealthReport> {
  const checkedAt = new Date().toISOString();

  // Check if we're online
  if (!navigator.onLine) {
    return {
      status: 'offline',
      hasUnsyncedChanges: false,
      inconsistencyCount: 0,
      details: 'Offline - cannot sync',
      checkedAt,
    };
  }

  // Step 1: Actually sync first (push local changes, pull server changes)
  let syncError: Error | null = null;
  try {
    await syncWithSupabase(childId);
  } catch (error) {
    syncError = error instanceof Error ? error : new Error(String(error));
    console.error('[SyncDiagnostics] Sync failed during health check:', syncError);
  }

  try {
    // Step 2: Check for any remaining unsynced local changes
    const hasPending = await hasUnsyncedChanges({ database });

    // Step 3: Get local record counts for this child (after sync)
    const localCounts = await getLocalCounts(childId);

    // Step 4: Get server record counts for this child
    const serverCounts = await getServerCounts(childId);

    // Step 5: Get last sync log from SyncLogger
    const logs = syncLogger.logs;
    const lastLog = logs[logs.length - 1];
    const lastSyncLog = lastLog
      ? {
          startedAt: lastLog.startedAt,
          finishedAt: lastLog.finishedAt,
          phase: lastLog.phase,
          remoteChangeCount: lastLog.remoteChangeCount,
          localChangeCount: lastLog.localChangeCount,
          error: lastLog.error?.message,
        }
      : undefined;

    // Step 6: If sync failed, return error status
    if (syncError) {
      return {
        status: 'error',
        hasUnsyncedChanges: hasPending,
        inconsistencyCount: -1,
        details: `Sync failed: ${syncError.message}`,
        checkedAt,
        localCounts,
        serverCounts,
        lastSyncLog,
      };
    }

    // Step 7: If there are still pending changes after sync, report it
    if (hasPending) {
      return {
        status: 'has_unsynced',
        hasUnsyncedChanges: true,
        inconsistencyCount: 0,
        details: 'Sync completed but local changes still pending',
        checkedAt,
        localCounts,
        serverCounts,
        lastSyncLog,
      };
    }

    // Step 8: Check for bidirectional count mismatches AFTER sync
    // If counts don't match after sync, something is wrong
    const inconsistencies: string[] = [];
    const threshold = 2; // Tighter threshold since we just synced

    // Local > server (push may have failed silently)
    if (localCounts.wordProgress > serverCounts.wordProgress + threshold) {
      inconsistencies.push(
        `word_progress: ${localCounts.wordProgress} local vs ${serverCounts.wordProgress} server (local excess)`
      );
    }
    // Server > local (pull may have failed)
    if (serverCounts.wordProgress > localCounts.wordProgress + threshold) {
      inconsistencies.push(
        `word_progress: ${localCounts.wordProgress} local vs ${serverCounts.wordProgress} server (missing local)`
      );
    }

    if (localCounts.gameSessions > serverCounts.gameSessions + threshold) {
      inconsistencies.push(
        `game_sessions: ${localCounts.gameSessions} local vs ${serverCounts.gameSessions} server (local excess)`
      );
    }
    if (serverCounts.gameSessions > localCounts.gameSessions + threshold) {
      inconsistencies.push(
        `game_sessions: ${localCounts.gameSessions} local vs ${serverCounts.gameSessions} server (missing local)`
      );
    }

    if (localCounts.statistics > serverCounts.statistics + threshold) {
      inconsistencies.push(
        `statistics: ${localCounts.statistics} local vs ${serverCounts.statistics} server (local excess)`
      );
    }
    if (serverCounts.statistics > localCounts.statistics + threshold) {
      inconsistencies.push(
        `statistics: ${localCounts.statistics} local vs ${serverCounts.statistics} server (missing local)`
      );
    }

    if (localCounts.calibration > serverCounts.calibration + threshold) {
      inconsistencies.push(
        `calibration: ${localCounts.calibration} local vs ${serverCounts.calibration} server (local excess)`
      );
    }
    if (serverCounts.calibration > localCounts.calibration + threshold) {
      inconsistencies.push(
        `calibration: ${localCounts.calibration} local vs ${serverCounts.calibration} server (missing local)`
      );
    }

    // Word attempts can have more variance due to volume
    const attemptThreshold = 5;
    if (localCounts.wordAttempts > serverCounts.wordAttempts + attemptThreshold) {
      inconsistencies.push(
        `word_attempts: ${localCounts.wordAttempts} local vs ${serverCounts.wordAttempts} server (local excess)`
      );
    }
    if (serverCounts.wordAttempts > localCounts.wordAttempts + attemptThreshold) {
      inconsistencies.push(
        `word_attempts: ${localCounts.wordAttempts} local vs ${serverCounts.wordAttempts} server (missing local)`
      );
    }

    if (inconsistencies.length > 0) {
      return {
        status: 'inconsistent',
        hasUnsyncedChanges: false,
        inconsistencyCount: inconsistencies.length,
        details: `Sync completed but count mismatch detected:\n${inconsistencies.join('\n')}`,
        checkedAt,
        localCounts,
        serverCounts,
        lastSyncLog,
      };
    }

    return {
      status: 'healthy',
      hasUnsyncedChanges: false,
      inconsistencyCount: 0,
      details: 'Sync completed successfully',
      checkedAt,
      localCounts,
      serverCounts,
      lastSyncLog,
    };
  } catch (error) {
    return {
      status: 'error',
      hasUnsyncedChanges: false,
      inconsistencyCount: -1,
      details: `Error checking sync health: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt,
    };
  }
}

/**
 * Get local record counts for a child
 */
async function getLocalCounts(childId: string): Promise<{
  wordProgress: number;
  gameSessions: number;
  statistics: number;
  calibration: number;
  wordAttempts: number;
  learningProgress: number;
}> {
  const [wpCount, gsCount, statsCount, calCount, waCount, lpCount] = await Promise.all([
    database.get<WordProgress>('word_progress').query(Q.where('child_id', childId)).fetchCount(),
    database.get<GameSession>('game_sessions').query(Q.where('child_id', childId)).fetchCount(),
    database.get<Statistics>('statistics').query(Q.where('child_id', childId)).fetchCount(),
    database.get<Calibration>('calibration').query(Q.where('child_id', childId)).fetchCount(),
    database.get<WordAttemptModel>('word_attempts').query(Q.where('child_id', childId)).fetchCount(),
    database.get<LearningProgress>('learning_progress').query(Q.where('child_id', childId)).fetchCount(),
  ]);

  return {
    wordProgress: wpCount,
    gameSessions: gsCount,
    statistics: statsCount,
    calibration: calCount,
    wordAttempts: waCount,
    learningProgress: lpCount,
  };
}

/**
 * Get server record counts for a child by querying Supabase directly
 * Note: statistics and learning_progress use computed views (not stored tables)
 */
async function getServerCounts(childId: string): Promise<{
  wordProgress: number;
  gameSessions: number;
  statistics: number;
  calibration: number;
  wordAttempts: number;
  learningProgress: number;
}> {
  const [wpResult, gsResult, statsResult, calResult, waResult, lpResult] = await Promise.all([
    supabase
      .from('child_word_progress')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
    supabase
      .from('child_game_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
    // Statistics are computed from game_sessions via computed_child_statistics view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('computed_child_statistics')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
    supabase
      .from('child_calibration')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('child_word_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
    // Learning progress is computed from word_attempts via computed_child_learning_progress view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('computed_child_learning_progress')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', childId),
  ]);

  return {
    wordProgress: wpResult.count || 0,
    gameSessions: gsResult.count || 0,
    statistics: statsResult.count || 0,
    calibration: calResult.count || 0,
    wordAttempts: waResult.count || 0,
    learningProgress: lpResult.count || 0,
  };
}

// =============================================================================
// DEEP REPAIR: ORPHAN CLEANUP
// =============================================================================

/**
 * Fetch business keys from server for orphan detection.
 * Uses the get_record_keys RPC function.
 */
async function fetchServerRecordKeys(childId: string): Promise<ServerRecordKeys | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_record_keys', {
    p_child_id: childId,
  });

  if (error) {
    console.error('[SyncDiagnostics] Failed to fetch server record keys:', error);
    return null;
  }

  return data as ServerRecordKeys;
}

/**
 * Detect and remove orphaned local records not present on server.
 * SAFE: Records with _status='created' (pending upload) are NEVER deleted.
 *
 * @param childId - The child ID to clean up orphans for
 * @param dryRun - If true, only reports what would be deleted without deleting
 * @returns Report of orphans found and deleted
 */
export async function cleanupOrphanedRecords(
  childId: string,
  dryRun: boolean = false
): Promise<OrphanCleanupReport> {
  const executedAt = new Date().toISOString();

  // Check if we're online
  if (!navigator.onLine) {
    return {
      status: 'skipped',
      orphansFound: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      orphansDeleted: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      skippedPendingUpload: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      details: 'Offline - cannot perform orphan cleanup',
      executedAt,
    };
  }

  try {
    // Fetch server business keys
    const serverKeys = await fetchServerRecordKeys(childId);
    if (!serverKeys) {
      return {
        status: 'error',
        orphansFound: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
        orphansDeleted: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
        skippedPendingUpload: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
        details: 'Failed to fetch server record keys',
        executedAt,
      };
    }

    // Build sets for O(1) lookup
    const serverWordTexts = new Set(serverKeys.word_progress.map((w: string) => w.toLowerCase()));
    const serverSessionIds = new Set(serverKeys.game_sessions);
    const serverModes = new Set(serverKeys.statistics);
    const serverCalibrationIds = new Set(serverKeys.calibration);
    const serverAttemptIds = new Set(serverKeys.word_attempts || []);

    // Query all local records
    const [localWords, localSessions, localStats, localCalibrations, localAttempts] = await Promise.all([
      database.get<WordProgress>('word_progress').query(Q.where('child_id', childId)).fetch(),
      database.get<GameSession>('game_sessions').query(Q.where('child_id', childId)).fetch(),
      database.get<Statistics>('statistics').query(Q.where('child_id', childId)).fetch(),
      database.get<Calibration>('calibration').query(Q.where('child_id', childId)).fetch(),
      database.get<WordAttemptModel>('word_attempts').query(Q.where('child_id', childId)).fetch(),
    ]);

    // Identify orphans (not on server) and pending uploads (status='created')
    const wordOrphans: WordProgress[] = [];
    const wordPending: WordProgress[] = [];
    for (const record of localWords) {
      const isPending = (record._raw as { _status?: string })._status === 'created';
      const isOrphan = !serverWordTexts.has(record.wordText.toLowerCase());
      if (isOrphan) {
        if (isPending) {
          wordPending.push(record);
        } else {
          wordOrphans.push(record);
        }
      }
    }

    const sessionOrphans: GameSession[] = [];
    const sessionPending: GameSession[] = [];
    for (const record of localSessions) {
      const isPending = (record._raw as { _status?: string })._status === 'created';
      const isOrphan = !serverSessionIds.has(record.clientSessionId);
      if (isOrphan) {
        if (isPending) {
          sessionPending.push(record);
        } else {
          sessionOrphans.push(record);
        }
      }
    }

    const statsOrphans: Statistics[] = [];
    const statsPending: Statistics[] = [];
    for (const record of localStats) {
      const isPending = (record._raw as { _status?: string })._status === 'created';
      const isOrphan = !serverModes.has(record.mode);
      if (isOrphan) {
        if (isPending) {
          statsPending.push(record);
        } else {
          statsOrphans.push(record);
        }
      }
    }

    const calibrationOrphans: Calibration[] = [];
    const calibrationPending: Calibration[] = [];
    for (const record of localCalibrations) {
      const isPending = (record._raw as { _status?: string })._status === 'created';
      const isOrphan = !serverCalibrationIds.has(record.clientCalibrationId);
      if (isOrphan) {
        if (isPending) {
          calibrationPending.push(record);
        } else {
          calibrationOrphans.push(record);
        }
      }
    }

    const attemptOrphans: WordAttemptModel[] = [];
    const attemptPending: WordAttemptModel[] = [];
    for (const record of localAttempts) {
      const isPending = (record._raw as { _status?: string })._status === 'created';
      const isOrphan = !serverAttemptIds.has(record.clientAttemptId);
      if (isOrphan) {
        if (isPending) {
          attemptPending.push(record);
        } else {
          attemptOrphans.push(record);
        }
      }
    }

    const orphansFound = {
      wordProgress: wordOrphans.length,
      gameSessions: sessionOrphans.length,
      statistics: statsOrphans.length,
      calibration: calibrationOrphans.length,
      wordAttempts: attemptOrphans.length,
    };

    const skippedPendingUpload = {
      wordProgress: wordPending.length,
      gameSessions: sessionPending.length,
      statistics: statsPending.length,
      calibration: calibrationPending.length,
      wordAttempts: attemptPending.length,
    };

    console.log('[SyncDiagnostics] Orphans found:', orphansFound);
    console.log('[SyncDiagnostics] Skipped (pending upload):', skippedPendingUpload);

    // Dry run - just report
    if (dryRun) {
      return {
        status: 'success',
        orphansFound,
        orphansDeleted: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
        skippedPendingUpload,
        details: `Dry run: Would delete ${orphansFound.wordProgress} word(s), ${orphansFound.gameSessions} session(s), ${orphansFound.statistics} stat(s), ${orphansFound.calibration} calibration(s), ${orphansFound.wordAttempts} attempt(s)`,
        executedAt,
      };
    }

    // Delete orphans in a single transaction
    await database.write(async () => {
      for (const record of wordOrphans) {
        await record.destroyPermanently();
      }
      for (const record of sessionOrphans) {
        await record.destroyPermanently();
      }
      for (const record of statsOrphans) {
        await record.destroyPermanently();
      }
      for (const record of calibrationOrphans) {
        await record.destroyPermanently();
      }
      for (const record of attemptOrphans) {
        await record.destroyPermanently();
      }
    });

    const totalDeleted = orphansFound.wordProgress + orphansFound.gameSessions + orphansFound.statistics + orphansFound.calibration + orphansFound.wordAttempts;
    console.log('[SyncDiagnostics] Deleted', totalDeleted, 'orphaned records');

    return {
      status: 'success',
      orphansFound,
      orphansDeleted: orphansFound,
      skippedPendingUpload,
      details: `Deleted ${totalDeleted} orphaned record(s). Skipped ${skippedPendingUpload.wordProgress + skippedPendingUpload.gameSessions + skippedPendingUpload.statistics + skippedPendingUpload.calibration + skippedPendingUpload.wordAttempts} pending upload(s).`,
      executedAt,
    };
  } catch (error) {
    console.error('[SyncDiagnostics] Orphan cleanup failed:', error);
    return {
      status: 'error',
      orphansFound: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      orphansDeleted: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      skippedPendingUpload: { wordProgress: 0, gameSessions: 0, statistics: 0, calibration: 0, wordAttempts: 0 },
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      executedAt,
    };
  }
}

// =============================================================================
// DEEP REPAIR: FORCE REFRESH FROM SERVER
// =============================================================================

/**
 * Force refresh local data from server.
 * Deletes all local records for specified collections and re-pulls ALL data from server.
 * Use when local data is stale/corrupt and server is authoritative.
 *
 * IMPORTANT: This bypasses normal sync and pulls with null timestamp to get ALL server records,
 * not just changes since last sync.
 *
 * @param childId - The child ID to refresh
 * @param collections - Which collections to refresh (default: word_progress, statistics)
 * @returns Report of what was refreshed
 */
export async function forceRefreshFromServer(
  childId: string,
  collections: ('word_progress' | 'statistics' | 'game_sessions' | 'calibration' | 'word_attempts')[] = ['word_progress', 'statistics', 'game_sessions', 'calibration', 'word_attempts']
): Promise<ForceRefreshReport> {
  const executedAt = new Date().toISOString();

  // Check if we're online
  if (!navigator.onLine) {
    return {
      status: 'error',
      deletedCounts: {},
      details: 'Offline - cannot perform force refresh',
      executedAt,
    };
  }

  try {
    const deletedCounts: Record<string, number> = {};
    const insertedCounts: Record<string, number> = {};

    // Step 1: Delete local records for specified collections
    await database.write(async () => {
      if (collections.includes('word_progress')) {
        const records = await database.get<WordProgress>('word_progress').query(Q.where('child_id', childId)).fetch();
        deletedCounts.word_progress = records.length;
        for (const record of records) {
          await record.destroyPermanently();
        }
      }

      if (collections.includes('statistics')) {
        const records = await database.get<Statistics>('statistics').query(Q.where('child_id', childId)).fetch();
        deletedCounts.statistics = records.length;
        for (const record of records) {
          await record.destroyPermanently();
        }
      }

      if (collections.includes('game_sessions')) {
        const records = await database.get<GameSession>('game_sessions').query(Q.where('child_id', childId)).fetch();
        deletedCounts.game_sessions = records.length;
        for (const record of records) {
          await record.destroyPermanently();
        }
      }

      if (collections.includes('calibration')) {
        const records = await database.get<Calibration>('calibration').query(Q.where('child_id', childId)).fetch();
        deletedCounts.calibration = records.length;
        for (const record of records) {
          await record.destroyPermanently();
        }
      }

      if (collections.includes('word_attempts')) {
        const records = await database.get<WordAttemptModel>('word_attempts').query(Q.where('child_id', childId)).fetch();
        deletedCounts.word_attempts = records.length;
        for (const record of records) {
          await record.destroyPermanently();
        }
      }
    });

    console.log('[SyncDiagnostics] Deleted local records for force refresh:', deletedCounts);

    // Step 2: Pull ALL data from server with null timestamp (bypasses lastPulledAt)
    // IMPORTANT: Use pull_changes_for_parent (not legacy pull_changes) because:
    // - pull_changes_for_parent uses computed_word_mastery view (correct mastery values)
    // - legacy pull_changes uses raw child_word_progress table (mastery=0)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return {
        status: 'error',
        deletedCounts,
        details: 'No authenticated session - cannot pull from server',
        executedAt,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('pull_changes_for_parent', {
      p_parent_id: session.user.id,
      p_last_pulled_at: null, // null = get ALL records, not just changes
    });

    if (error) {
      console.error('[SyncDiagnostics] Failed to pull from server:', error);
      return {
        status: 'error',
        deletedCounts,
        details: `Failed to pull from server: ${error.message}`,
        executedAt,
      };
    }

    const rawServerData = data as ServerPullResponse;

    // Filter server data to only include records for the specified child
    // (pull_changes_for_parent returns ALL children's data)
    const serverData: ServerPullResponse = {
      word_progress: rawServerData.word_progress?.filter(r => r.child_id === childId) || [],
      game_sessions: rawServerData.game_sessions?.filter(r => r.child_id === childId) || [],
      statistics: rawServerData.statistics?.filter(r => r.child_id === childId) || [],
      calibration: rawServerData.calibration?.filter(r => r.child_id === childId) || [],
      word_attempts: rawServerData.word_attempts?.filter(r => r.child_id === childId) || [],
      learning_progress: rawServerData.learning_progress?.filter(r => r.child_id === childId) || [],
      grade_progress: rawServerData.grade_progress?.filter(r => r.child_id === childId) || [],
      timestamp: rawServerData.timestamp,
      last_reset_at: rawServerData.last_reset_at,
    };

    console.log('[SyncDiagnostics] Pulled data from server (filtered to child):', {
      word_progress: serverData.word_progress?.length || 0,
      game_sessions: serverData.game_sessions?.length || 0,
      statistics: serverData.statistics?.length || 0,
      calibration: serverData.calibration?.length || 0,
      word_attempts: serverData.word_attempts?.length || 0,
    });

    // Step 3: Insert server records into local database
    await database.write(async () => {
      // Insert word_progress
      if (collections.includes('word_progress') && serverData.word_progress?.length > 0) {
        const wpCollection = database.get<WordProgress>('word_progress');
        for (const serverRecord of serverData.word_progress) {
          const rawRecord = transformWordProgressFromServer(serverRecord);
          await wpCollection.create((record) => {
            record._raw.id = rawRecord.id as string;
            Object.keys(rawRecord).forEach((key) => {
              if (key !== 'id') {
                // @ts-expect-error - WatermelonDB _raw setters not typed
                record._raw[key] = rawRecord[key];
              }
            });
          });
        }
        insertedCounts.word_progress = serverData.word_progress.length;
      }

      // Insert game_sessions
      if (collections.includes('game_sessions') && serverData.game_sessions?.length > 0) {
        const gsCollection = database.get<GameSession>('game_sessions');
        for (const serverRecord of serverData.game_sessions) {
          const rawRecord = transformGameSessionFromServer(serverRecord);
          await gsCollection.create((record) => {
            record._raw.id = rawRecord.id as string;
            Object.keys(rawRecord).forEach((key) => {
              if (key !== 'id') {
                // @ts-expect-error - WatermelonDB _raw setters not typed
                record._raw[key] = rawRecord[key];
              }
            });
          });
        }
        insertedCounts.game_sessions = serverData.game_sessions.length;
      }

      // Insert statistics
      if (collections.includes('statistics') && serverData.statistics?.length > 0) {
        const statsCollection = database.get<Statistics>('statistics');
        for (const serverRecord of serverData.statistics) {
          const rawRecord = transformStatisticsFromServer(serverRecord);
          await statsCollection.create((record) => {
            record._raw.id = rawRecord.id as string;
            Object.keys(rawRecord).forEach((key) => {
              if (key !== 'id') {
                // @ts-expect-error - WatermelonDB _raw setters not typed
                record._raw[key] = rawRecord[key];
              }
            });
          });
        }
        insertedCounts.statistics = serverData.statistics.length;
      }

      // Insert calibration
      if (collections.includes('calibration') && serverData.calibration?.length > 0) {
        const calCollection = database.get<Calibration>('calibration');
        for (const serverRecord of serverData.calibration) {
          const rawRecord = transformCalibrationFromServer(serverRecord);
          await calCollection.create((record) => {
            record._raw.id = rawRecord.id as string;
            Object.keys(rawRecord).forEach((key) => {
              if (key !== 'id') {
                // @ts-expect-error - WatermelonDB _raw setters not typed
                record._raw[key] = rawRecord[key];
              }
            });
          });
        }
        insertedCounts.calibration = serverData.calibration.length;
      }

      // Insert word_attempts
      if (collections.includes('word_attempts') && serverData.word_attempts?.length > 0) {
        const waCollection = database.get<WordAttemptModel>('word_attempts');
        for (const serverRecord of serverData.word_attempts) {
          const rawRecord = transformWordAttemptFromServer(serverRecord);
          await waCollection.create((record) => {
            record._raw.id = rawRecord.id as string;
            Object.keys(rawRecord).forEach((key) => {
              if (key !== 'id') {
                // @ts-expect-error - WatermelonDB _raw setters not typed
                record._raw[key] = rawRecord[key];
              }
            });
          });
        }
        insertedCounts.word_attempts = serverData.word_attempts.length;
      }
    });

    console.log('[SyncDiagnostics] Inserted server records:', insertedCounts);

    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    const totalInserted = Object.values(insertedCounts).reduce((sum, count) => sum + count, 0);

    return {
      status: 'success',
      deletedCounts,
      details: `Force refreshed ${collections.join(', ')}. Deleted ${totalDeleted} local record(s), inserted ${totalInserted} from server.`,
      executedAt,
    };
  } catch (error) {
    console.error('[SyncDiagnostics] Force refresh failed:', error);
    return {
      status: 'error',
      deletedCounts: {},
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      executedAt,
    };
  }
}

// =============================================================================
// SYNC REPAIR / HEALING
// =============================================================================

/**
 * Attempt to heal sync inconsistencies.
 * Can perform a quick repair (standard sync) or deep repair (with orphan cleanup and/or force refresh).
 *
 * Quick Repair (default):
 * 1. Push any local changes
 * 2. Pull all server changes
 * 3. Re-check health
 *
 * Deep Repair (with options):
 * 1. Push pending local changes FIRST (to avoid data loss)
 * 2. Abort if push fails and force refresh was requested
 * 3. Optionally force refresh specified collections from server
 * 4. Optionally clean up orphaned local records
 * 5. Run standard sync
 * 6. Re-check health
 *
 * @param childId - The child ID to heal sync for
 * @param options - Optional deep repair options
 * @returns Updated SyncHealthReport after healing attempt
 */
export async function healSyncInconsistencies(
  childId: string,
  options: HealOptions = {}
): Promise<SyncHealthReport> {
  const { includeOrphanCleanup, forceRefreshCollections, dryRun } = options;
  const isDeepRepair = includeOrphanCleanup || (forceRefreshCollections && forceRefreshCollections.length > 0);

  console.log('[SyncDiagnostics] Starting sync healing for child:', childId, {
    isDeepRepair,
    includeOrphanCleanup,
    forceRefreshCollections,
    dryRun,
  });

  let orphanReport: OrphanCleanupReport | undefined;
  let refreshReport: ForceRefreshReport | undefined;

  try {
    // Step 1: Push pending local changes BEFORE any destructive operations
    // This prevents data loss when force refresh deletes local data
    if (isDeepRepair) {
      console.log('[SyncDiagnostics] Pushing pending changes before deep repair...');
      try {
        await syncWithSupabase(childId);
      } catch (syncError) {
        console.error('[SyncDiagnostics] Pre-repair sync failed:', syncError);
        // Check if we still have unsynced changes - if so, abort deep repair
        if (forceRefreshCollections && forceRefreshCollections.length > 0) {
          const stillHasPending = await hasUnsyncedChanges({ database });
          if (stillHasPending) {
            return {
              status: 'error',
              hasUnsyncedChanges: true,
              inconsistencyCount: -1,
              details: 'Cannot perform deep repair: local changes failed to sync to server. Please try "Sync Now" first to push your changes.',
              checkedAt: new Date().toISOString(),
            };
          }
        }
      }

      // Double-check: abort force refresh if we still have unsynced changes
      if (forceRefreshCollections && forceRefreshCollections.length > 0) {
        const stillHasPending = await hasUnsyncedChanges({ database });
        if (stillHasPending) {
          console.warn('[SyncDiagnostics] Still have unsynced changes after sync, aborting force refresh');
          return {
            status: 'error',
            hasUnsyncedChanges: true,
            inconsistencyCount: -1,
            details: 'Cannot perform deep repair: local changes failed to sync to server. Please try "Sync Now" first to push your changes.',
            checkedAt: new Date().toISOString(),
          };
        }
        console.log('[SyncDiagnostics] All local changes synced, safe to proceed with force refresh');
      }
    }

    // Step 2: Force refresh from server if requested
    // Now safe because we've pushed local changes
    if (forceRefreshCollections && forceRefreshCollections.length > 0) {
      console.log('[SyncDiagnostics] Performing force refresh for:', forceRefreshCollections);
      refreshReport = await forceRefreshFromServer(childId, forceRefreshCollections);
      if (refreshReport.status === 'error') {
        console.error('[SyncDiagnostics] Force refresh failed:', refreshReport.details);
        // Continue with healing anyway
      }
    }

    // Step 3: Clean up orphaned records if requested
    // Do this AFTER force refresh so we don't delete records that will be refreshed anyway
    if (includeOrphanCleanup) {
      console.log('[SyncDiagnostics] Performing orphan cleanup, dryRun:', dryRun);
      orphanReport = await cleanupOrphanedRecords(childId, dryRun);
      if (orphanReport.status === 'error') {
        console.error('[SyncDiagnostics] Orphan cleanup failed:', orphanReport.details);
        // Continue with healing anyway
      }
    }

    // Step 4: Standard sync - push local changes, pull server changes
    await syncWithSupabase(childId);

    // Wait a moment for the sync to fully complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Run another sync to ensure bidirectional consistency
    await syncWithSupabase(childId);

    // Re-check health
    const healthReport = await checkSyncHealth(childId);

    // Attach deep repair reports if present
    if (orphanReport) {
      healthReport.orphanReport = orphanReport;
    }
    if (refreshReport) {
      healthReport.refreshReport = refreshReport;
    }

    console.log('[SyncDiagnostics] Sync healing completed:', healthReport.status, {
      orphanReport: orphanReport?.status,
      refreshReport: refreshReport?.status,
    });
    return healthReport;
  } catch (error) {
    console.error('[SyncDiagnostics] Sync healing failed:', error);
    return {
      status: 'error',
      hasUnsyncedChanges: false,
      inconsistencyCount: -1,
      details: `Healing failed: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: new Date().toISOString(),
      orphanReport,
      refreshReport,
    };
  }
}

// =============================================================================
// DETAILED DIAGNOSTICS (for debugging)
// =============================================================================

/**
 * Get detailed sync diagnostics for debugging.
 * This includes raw data comparisons for troubleshooting.
 *
 * @param childId - The child ID to diagnose
 * @returns Detailed diagnostic information
 */
export async function getDetailedDiagnostics(childId: string): Promise<{
  health: SyncHealthReport;
  syncLogs: string;
  localWordSample: { id: string; wordText: string; masteryLevel: number }[];
  serverWordSample: { id: string; word_text: string; mastery_level: number }[];
}> {
  const health = await checkSyncHealth(childId);

  // Get sync logs
  const syncLogs = syncLogger.formattedLogs;

  // Get sample of local words
  const localWords = await database
    .get<WordProgress>('word_progress')
    .query(Q.where('child_id', childId), Q.take(10))
    .fetch();

  const localWordSample = localWords.map((w) => ({
    id: w.id,
    wordText: w.wordText,
    masteryLevel: w.masteryLevel,
  }));

  // Get sample of server words
  const { data: serverWords } = await supabase
    .from('child_word_progress')
    .select('id, word_text, mastery_level')
    .eq('child_id', childId)
    .limit(10);

  return {
    health,
    syncLogs,
    localWordSample,
    serverWordSample: serverWords || [],
  };
}

// =============================================================================
// MULTI-CHILD HEALTH CHECK
// =============================================================================

/**
 * Aggregated sync health report across all children
 */
export interface MultiChildSyncHealthReport {
  overallStatus: SyncHealthStatus;
  childReports: {
    childId: string;
    childName: string;
    health: SyncHealthReport;
  }[];
  checkedAt: string;
}

/**
 * Check sync health for all children.
 * Returns aggregated status (worst status across all children) and individual reports.
 *
 * Status priority (worst to best): error > inconsistent > has_unsynced > healthy
 *
 * @param children - Array of child objects with id and name
 * @returns Promise with aggregated health report
 */
export async function checkSyncHealthAllChildren(
  children: { id: string; name: string }[]
): Promise<MultiChildSyncHealthReport> {
  const childReports: MultiChildSyncHealthReport['childReports'] = [];
  let worstStatus: SyncHealthStatus = 'healthy';

  console.log('[SyncDiagnostics] Checking health for', children.length, 'children');

  for (const child of children) {
    console.log(`[SyncDiagnostics] Checking health for child ${child.name}...`);
    const health = await checkSyncHealth(child.id);
    childReports.push({ childId: child.id, childName: child.name, health });

    // Track worst status
    if (health.status === 'error') {
      worstStatus = 'error';
    } else if (health.status === 'inconsistent' && worstStatus !== 'error') {
      worstStatus = 'inconsistent';
    } else if (health.status === 'has_unsynced' && worstStatus === 'healthy') {
      worstStatus = 'has_unsynced';
    }
    // 'healthy' doesn't change worstStatus, 'offline' and 'checking' are transient
  }

  console.log(`[SyncDiagnostics] Multi-child health check complete. Overall status: ${worstStatus}`);

  return {
    overallStatus: worstStatus,
    childReports,
    checkedAt: new Date().toISOString(),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { syncLogger };
