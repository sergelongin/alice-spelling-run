/**
 * Progress Service
 * Supabase CRUD operations for child progress tables
 * Handles the actual database operations for sync
 */

import { supabase } from '@/lib/supabase';
import type {
  ChildWordProgressRow,
  ChildStatisticsRow,
  ChildGameSessionRow,
  ChildCalibrationRow,
  ChildSyncMetadataRow,
  ChildSyncStatusRow,
  WordProgressSyncPayload,
  StatisticsSyncPayload,
  GameSessionSyncPayload,
  CalibrationSyncPayload,
} from '@/types/sync';

// =============================================================================
// SYNC STATUS (for polling)
// =============================================================================

/**
 * Fetch sync status for a child (cheap single-row query)
 * Returns null if no sync status exists yet (new user with no data)
 *
 * Note: Uses type assertion because child_sync_status table is not yet in
 * generated Supabase types. The table is created by migration 010.
 */
export async function fetchSyncStatus(
  childId: string
): Promise<ChildSyncStatusRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('child_sync_status')
    .select('child_id, last_data_changed_at')
    .eq('child_id', childId)
    .single();

  if (error) {
    // PGRST116 = no rows found (expected for new users)
    if (error.code === 'PGRST116') return null;
    console.error('[ProgressService] Failed to fetch sync status:', error);
    return null;
  }

  return data as ChildSyncStatusRow;
}

// =============================================================================
// WORD PROGRESS
// =============================================================================

/**
 * Fetch all word progress for a child
 */
export async function fetchWordProgress(
  childId: string,
  since?: string
): Promise<ChildWordProgressRow[]> {
  let query = supabase
    .from('child_word_progress')
    .select('*')
    .eq('child_id', childId);

  if (since) {
    query = query.gt('client_updated_at', since);
  }

  const { data, error } = await query.order('client_updated_at', {
    ascending: false,
  });

  if (error) {
    console.error('[ProgressService] Failed to fetch word progress:', error);
    throw error;
  }

  return (data || []) as ChildWordProgressRow[];
}

/**
 * Upsert word progress (batch)
 * Deduplicates by word_text to avoid "cannot affect row a second time" error
 */
export async function upsertWordProgress(
  items: WordProgressSyncPayload[]
): Promise<void> {
  if (items.length === 0) return;

  // Deduplicate by child_id + word_text, keeping the most recent (last in array)
  const deduped = new Map<string, WordProgressSyncPayload>();
  for (const item of items) {
    const key = `${item.child_id}:${item.word_text.toLowerCase()}`;
    deduped.set(key, item);
  }
  const uniqueItems = Array.from(deduped.values());

  // Batch in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
    const batch = uniqueItems.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('child_word_progress')
      .upsert(batch, {
        onConflict: 'child_id,word_text',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[ProgressService] Failed to upsert word progress:', error);
      throw error;
    }
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Fetch all statistics for a child
 */
export async function fetchStatistics(
  childId: string,
  since?: string
): Promise<ChildStatisticsRow[]> {
  let query = supabase
    .from('child_statistics')
    .select('*')
    .eq('child_id', childId);

  if (since) {
    query = query.gt('client_updated_at', since);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ProgressService] Failed to fetch statistics:', error);
    throw error;
  }

  // Cast through unknown for JSONB fields compatibility
  return (data || []) as unknown as ChildStatisticsRow[];
}

/**
 * Upsert statistics (batch)
 * Note: Uses type assertion for JSONB fields (word_accuracy, personal_bests, etc.)
 * since our typed sync payloads are more specific than Supabase's generic Json type
 */
export async function upsertStatistics(
  items: StatisticsSyncPayload[]
): Promise<void> {
  if (items.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('child_statistics').upsert(items as any, {
    onConflict: 'child_id,mode',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('[ProgressService] Failed to upsert statistics:', error);
    throw error;
  }
}

// =============================================================================
// GAME SESSIONS
// =============================================================================

/**
 * Fetch game sessions for a child
 */
export async function fetchGameSessions(
  childId: string,
  since?: string,
  limit = 100
): Promise<ChildGameSessionRow[]> {
  let query = supabase
    .from('child_game_sessions')
    .select('*')
    .eq('child_id', childId);

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ProgressService] Failed to fetch game sessions:', error);
    throw error;
  }

  // Cast through unknown for JSONB fields compatibility
  return (data || []) as unknown as ChildGameSessionRow[];
}

/**
 * Fetch ALL game sessions for a child using pagination
 * Used for event sourcing - deriving word progress and statistics from sessions
 */
export async function fetchAllGameSessionsPaginated(
  childId: string
): Promise<ChildGameSessionRow[]> {
  const allSessions: ChildGameSessionRow[] = [];
  const pageSize = 500;
  let from = 0;

   
  while (true) {
    const { data, error } = await supabase
      .from('child_game_sessions')
      .select('*')
      .eq('child_id', childId)
      .order('played_at', { ascending: true }) // Oldest first for correct derivation order
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('[ProgressService] Failed to fetch all game sessions:', error);
      throw error;
    }

    const sessions = (data || []) as unknown as ChildGameSessionRow[];
    allSessions.push(...sessions);

    // If we got fewer than pageSize, we've reached the end
    if (sessions.length < pageSize) {
      break;
    }

    from += pageSize;

    // Safety limit
    if (from > 10000) {
      console.warn('[ProgressService] Reached 10000 session limit');
      break;
    }
  }

  console.log(`[ProgressService] Fetched ${allSessions.length} total sessions for child ${childId}`);
  return allSessions;
}

/**
 * Insert game sessions (batch, ignore duplicates)
 * Deduplicates by client_session_id to avoid conflicts
 * Note: Uses type assertion for JSONB fields (completed_words, wrong_attempts)
 */
export async function insertGameSessions(
  items: GameSessionSyncPayload[]
): Promise<void> {
  if (items.length === 0) return;

  // Deduplicate by child_id + client_session_id
  const deduped = new Map<string, GameSessionSyncPayload>();
  for (const item of items) {
    const key = `${item.child_id}:${item.client_session_id}`;
    deduped.set(key, item);
  }
  const uniqueItems = Array.from(deduped.values());

  // Batch in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
    const batch = uniqueItems.slice(i, i + BATCH_SIZE);
     
    const { error } = await supabase
      .from('child_game_sessions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase upsert type workaround
      .upsert(batch as any, {
        onConflict: 'child_id,client_session_id',
        ignoreDuplicates: true, // Skip existing sessions
      });

    if (error) {
      console.error('[ProgressService] Failed to insert game sessions:', error);
      throw error;
    }
  }
}

// =============================================================================
// CALIBRATION
// =============================================================================

/**
 * Fetch calibrations for a child
 */
export async function fetchCalibrations(
  childId: string,
  since?: string
): Promise<ChildCalibrationRow[]> {
  let query = supabase
    .from('child_calibration')
    .select('*')
    .eq('child_id', childId);

  if (since) {
    query = query.gt('created_at', since);
  }

  const { data, error } = await query.order('completed_at', {
    ascending: false,
  });

  if (error) {
    console.error('[ProgressService] Failed to fetch calibrations:', error);
    throw error;
  }

  return (data || []) as ChildCalibrationRow[];
}

/**
 * Insert calibrations (batch, ignore duplicates)
 * Deduplicates by client_calibration_id to avoid conflicts
 */
export async function insertCalibrations(
  items: CalibrationSyncPayload[]
): Promise<void> {
  if (items.length === 0) return;

  // Deduplicate by child_id + client_calibration_id
  const deduped = new Map<string, CalibrationSyncPayload>();
  for (const item of items) {
    const key = `${item.child_id}:${item.client_calibration_id}`;
    deduped.set(key, item);
  }
  const uniqueItems = Array.from(deduped.values());

  const { error } = await supabase.from('child_calibration').upsert(uniqueItems, {
    onConflict: 'child_id,client_calibration_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[ProgressService] Failed to insert calibrations:', error);
    throw error;
  }
}

// =============================================================================
// SYNC METADATA
// =============================================================================

/**
 * Fetch sync metadata for a child
 */
export async function fetchSyncMetadata(
  childId: string
): Promise<ChildSyncMetadataRow | null> {
  const { data, error } = await supabase
    .from('child_sync_metadata')
    .select('*')
    .eq('child_id', childId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No record found
      return null;
    }
    console.error('[ProgressService] Failed to fetch sync metadata:', error);
    throw error;
  }

  return data as ChildSyncMetadataRow;
}

/**
 * Upsert sync metadata
 */
export async function upsertSyncMetadata(
  childId: string,
  updates: Partial<Omit<ChildSyncMetadataRow, 'id' | 'child_id' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase.from('child_sync_metadata').upsert(
    {
      child_id: childId,
      ...updates,
    },
    {
      onConflict: 'child_id',
    }
  );

  if (error) {
    console.error('[ProgressService] Failed to upsert sync metadata:', error);
    throw error;
  }
}

// =============================================================================
// UTILITY: Check if server has any data for child
// =============================================================================

/**
 * Check if server has any existing data for a child
 * Used to determine if this is a fresh sync or merge scenario
 */
export async function hasServerData(childId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('child_word_progress')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', childId);

  if (error) {
    console.error('[ProgressService] Failed to check server data:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Get server time for clock drift calculation
 */
export async function getServerTime(): Promise<Date> {
  // Use a simple query to get server time from the response header
  const start = Date.now();
  const { error } = await supabase
    .from('children')
    .select('id')
    .limit(1);
  const end = Date.now();

  if (error) {
    // Fall back to local time
    return new Date();
  }

  // Approximate server time as the midpoint of request
  return new Date(start + (end - start) / 2);
}

// =============================================================================
// BACKFILL: Update existing rows with detailed data
// =============================================================================

import type { GameResult } from '@/types/game';
import type { GameStatistics } from '@/types/statistics';

/**
 * Backfill game sessions that are missing detailed data (completed_words, wrong_attempts)
 *
 * This handles sessions that were synced before migration 008 added the JSONB columns.
 * Matches Supabase sessions with localStorage gameHistory by client_session_id.
 *
 * @returns Number of sessions updated
 */
export async function backfillGameSessionDetails(
  childId: string,
  gameHistory: GameResult[]
): Promise<number> {
  if (gameHistory.length === 0) return 0;

  // 1. Fetch sessions that have NULL completed_words (need backfill)
  const { data: sessionsToBackfill, error: fetchError } = await supabase
    .from('child_game_sessions')
    .select('id, client_session_id')
    .eq('child_id', childId)
    .is('completed_words', null);

  if (fetchError) {
    console.error('[ProgressService] Failed to fetch sessions for backfill:', fetchError);
    throw fetchError;
  }

  if (!sessionsToBackfill || sessionsToBackfill.length === 0) {
    return 0;
  }

  // 2. Create a map of local game history by session id
  const localHistoryMap = new Map<string, GameResult>();
  for (const game of gameHistory) {
    localHistoryMap.set(game.id, game);
  }

  // 3. Match and prepare updates
  const updates: Array<{
    id: string;
    completed_words: GameResult['completedWords'];
    wrong_attempts: GameResult['wrongAttempts'];
  }> = [];

  for (const session of sessionsToBackfill) {
    const localGame = localHistoryMap.get(session.client_session_id);
    if (localGame && localGame.completedWords) {
      updates.push({
        id: session.id,
        completed_words: localGame.completedWords,
        wrong_attempts: localGame.wrongAttempts || [],
      });
    }
  }

  if (updates.length === 0) {
    return 0;
  }

  // 4. Update each session (batch updates for JSONB require individual calls)
  let updatedCount = 0;
  for (const update of updates) {
     
    const { error: updateError } = await supabase
      .from('child_game_sessions')
      .update({
        completed_words: update.completed_words,
        wrong_attempts: update.wrong_attempts,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase update type workaround
      } as any)
      .eq('id', update.id);

    if (updateError) {
      console.error('[ProgressService] Failed to backfill session:', update.id, updateError);
      // Continue with other updates
    } else {
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`[ProgressService] Backfilled ${updatedCount} game sessions with detailed data`);
  }

  return updatedCount;
}

/**
 * Backfill statistics rows that are missing detailed data
 * (word_accuracy, first_correct_dates, personal_bests, error_patterns)
 *
 * This updates existing rows that were synced before detailed columns were added.
 */
export async function backfillStatisticsDetails(
  childId: string,
  statistics: GameStatistics
): Promise<number> {
  // Check if there's any detailed data to backfill
  const hasDetailedData =
    Object.keys(statistics.wordAccuracy || {}).length > 0 ||
    Object.keys(statistics.firstCorrectDates || {}).length > 0 ||
    Object.keys(statistics.personalBests || {}).length > 0 ||
    Object.keys(statistics.errorPatterns || {}).some(
      (k) => statistics.errorPatterns[k as keyof typeof statistics.errorPatterns]?.count > 0
    );

  if (!hasDetailedData) {
    return 0;
  }

  // Fetch existing statistics that are missing detailed data
  const { data: statsToBackfill, error: fetchError } = await supabase
    .from('child_statistics')
    .select('id, mode, word_accuracy')
    .eq('child_id', childId);

  if (fetchError) {
    console.error('[ProgressService] Failed to fetch statistics for backfill:', fetchError);
    throw fetchError;
  }

  if (!statsToBackfill || statsToBackfill.length === 0) {
    return 0;
  }

  // Update each mode's row with detailed data
  // Note: All modes share the same detailed statistics in localStorage
  let updatedCount = 0;

  for (const stat of statsToBackfill) {
    // Only backfill if word_accuracy is null/empty (indicates it wasn't synced yet)
    const needsBackfill =
      !stat.word_accuracy || Object.keys(stat.word_accuracy as object).length === 0;

    if (!needsBackfill) continue;

    // Only include error_patterns with actual counts
    const filteredErrorPatterns: Record<string, typeof statistics.errorPatterns[keyof typeof statistics.errorPatterns]> = {};
    for (const [pattern, stats] of Object.entries(statistics.errorPatterns || {})) {
      if (stats.count > 0) {
        filteredErrorPatterns[pattern] = stats;
      }
    }

     
    const { error: updateError } = await supabase
      .from('child_statistics')
      .update({
        word_accuracy: statistics.wordAccuracy || {},
        first_correct_dates: statistics.firstCorrectDates || {},
        personal_bests: statistics.personalBests || {},
        error_patterns: Object.keys(filteredErrorPatterns).length > 0 ? filteredErrorPatterns : {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase update type workaround
      } as any)
      .eq('id', stat.id);

    if (updateError) {
      console.error('[ProgressService] Failed to backfill statistics:', stat.mode, updateError);
    } else {
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`[ProgressService] Backfilled ${updatedCount} statistics rows with detailed data`);
  }

  return updatedCount;
}
