/**
 * Database Hooks Index
 */

export { useDatabase } from './useDatabase';
export type { UseDatabaseResult } from './useDatabase';

// Re-export sync health types for convenience
export type { SyncHealthReport, SyncHealthStatus, HealOptions, OrphanCleanupReport, ForceRefreshReport } from '../syncDiagnostics';
