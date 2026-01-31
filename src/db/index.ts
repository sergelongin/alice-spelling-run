/**
 * WatermelonDB Database Initialization
 * Sets up the local database with LokiJS adapter for web
 */

import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import {
  WordProgress,
  GameSession,
  Statistics,
  Calibration,
  LearningProgress,
  WordBankMetadata,
  WordAttemptModel,
} from './models';

// Extend Window interface for HMR persistence
declare global {
  interface Window {
    __watermelondb?: Database;
  }
}

/**
 * Create and initialize the WatermelonDB database
 * Uses LokiJS adapter for web with IndexedDB persistence
 */
function createDatabase(): Database {
  // In development, reuse existing database to prevent issues during HMR
  if (import.meta.env.DEV && window.__watermelondb) {
    return window.__watermelondb;
  }

  const adapter = new LokiJSAdapter({
    schema,
    // Use IndexedDB for persistence (survives page reloads)
    useIncrementalIndexedDB: true,
    // Disable web worker for simpler debugging
    useWebWorker: false,
    dbName: 'alice_spelling_run',
    // Called when database needs to be set up or migrated
    onSetUpError: (error) => {
      console.error('[WatermelonDB] Setup error:', error);
    },
  });

  const database = new Database({
    adapter,
    modelClasses: [
      WordProgress,
      GameSession,
      Statistics,
      Calibration,
      LearningProgress,
      WordBankMetadata,
      WordAttemptModel,
    ],
  });

  // Store on window for HMR persistence in development
  if (import.meta.env.DEV) {
    window.__watermelondb = database;
  }

  return database;
}

// Singleton database instance
export const database = createDatabase();

// Export table accessors for convenience
export const wordProgressCollection = database.get<WordProgress>('word_progress');
export const gameSessionCollection = database.get<GameSession>('game_sessions');
export const statisticsCollection = database.get<Statistics>('statistics');
export const calibrationCollection = database.get<Calibration>('calibration');
export const learningProgressCollection = database.get<LearningProgress>('learning_progress');
export const wordBankMetadataCollection = database.get<WordBankMetadata>('word_bank_metadata');
export const wordAttemptCollection = database.get<WordAttemptModel>('word_attempts');

// Re-export models for convenience
export * from './models';
export * from './schema';
