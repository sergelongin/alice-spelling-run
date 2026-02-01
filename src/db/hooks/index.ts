/**
 * Database Hooks Index
 */

export { useDatabase } from './useDatabase';
export type { UseDatabaseResult } from './useDatabase';

// Re-export sync health types for convenience
export type { SyncHealthReport, SyncHealthStatus, HealOptions, OrphanCleanupReport, ForceRefreshReport, MultiChildSyncHealthReport } from '../syncDiagnostics';

// Re-export sync functions for multi-child operations
export { syncAllChildren, type MultiChildSyncResult } from '../sync';
export { checkSyncHealthAllChildren } from '../syncDiagnostics';
