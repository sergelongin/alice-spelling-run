/**
 * Sync Diagnostic Logging Module
 *
 * Provides conditional logging for debugging sync issues.
 * Enable by setting VITE_SYNC_DEBUG=true in .env
 *
 * Usage:
 *   import { syncLog, SYNC_DEBUG } from './syncDebug';
 *   syncLog.info('Pull', 'Received data', { count: 20 });
 *   syncLog.sample('Transform', 'word_attempts', records, 2);
 */

export const SYNC_DEBUG = import.meta.env.VITE_SYNC_DEBUG === 'true';

/**
 * Format log message with consistent prefix
 */
function formatMessage(prefix: string, message: string): string {
  return `[Sync:${prefix}] ${message}`;
}

/**
 * Conditional logger that only outputs when SYNC_DEBUG is enabled
 */
export const syncLog = {
  /**
   * Log info-level message (only when debug enabled)
   */
  info: (prefix: string, message: string, data?: unknown): void => {
    if (!SYNC_DEBUG) return;
    if (data !== undefined) {
      console.log(formatMessage(prefix, message), data);
    } else {
      console.log(formatMessage(prefix, message));
    }
  },

  /**
   * Log warning-level message (always shown, but with more detail when debug enabled)
   */
  warn: (prefix: string, message: string, data?: unknown): void => {
    // Warnings are always shown (they indicate potential issues)
    if (data !== undefined) {
      console.warn(formatMessage(prefix, message), data);
    } else {
      console.warn(formatMessage(prefix, message));
    }
  },

  /**
   * Log error-level message (always shown)
   */
  error: (prefix: string, message: string, data?: unknown): void => {
    if (data !== undefined) {
      console.error(formatMessage(prefix, message), data);
    } else {
      console.error(formatMessage(prefix, message));
    }
  },

  /**
   * Log a sample of records for debugging (only when debug enabled)
   * Shows first N records to avoid flooding console
   */
  sample: <T>(prefix: string, label: string, records: T[], sampleSize = 2): void => {
    if (!SYNC_DEBUG) return;
    if (!records.length) {
      console.log(formatMessage(prefix, `${label}: (empty)`));
      return;
    }
    const sample = records.slice(0, sampleSize);
    console.log(
      formatMessage(prefix, `${label} sample (${sampleSize}/${records.length}):`),
      sample
    );
  },

  /**
   * Log reconciliation stats
   */
  reconcileStats: (
    prefix: string,
    tableName: string,
    stats: {
      serverReceived: number;
      skippedInvalid?: number;
      matchedForUpdate: number;
      createdNew: number;
    }
  ): void => {
    const message = `${tableName} reconciled`;
    const logData = {
      serverReceived: stats.serverReceived,
      ...(stats.skippedInvalid && stats.skippedInvalid > 0
        ? { skippedInvalid: stats.skippedInvalid }
        : {}),
      matchedForUpdate: stats.matchedForUpdate,
      createdNew: stats.createdNew,
      expectedTotal: stats.createdNew + stats.matchedForUpdate,
    };

    // Always log basic reconciliation (existing behavior)
    console.log(`[Sync] ${tableName} reconciled: ${stats.createdNew} created, ${stats.matchedForUpdate} updated`);

    // Add detailed stats when debug enabled
    if (SYNC_DEBUG) {
      console.log(formatMessage(prefix, message), logData);
    }
  },

  /**
   * Log skipped records with reasons (warnings, always shown)
   */
  skippedRecords: (
    prefix: string,
    tableName: string,
    skipped: Array<{ id: string; reason: string }>
  ): void => {
    if (skipped.length === 0) return;
    console.warn(
      formatMessage(prefix, `${skipped.length} ${tableName} records skipped due to invalid data:`),
      skipped.slice(0, 5) // Show first 5, avoid flooding
    );
    if (skipped.length > 5) {
      console.warn(formatMessage(prefix, `... and ${skipped.length - 5} more`));
    }
  },
};

/**
 * Validation result for transform functions
 */
export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate a timestamp value (returns NaN check result)
 */
export function validateTimestamp(
  value: unknown,
  fieldName: string
): ValidationResult {
  if (value === null || value === undefined) {
    return { isValid: true }; // Null is valid for optional timestamps
  }

  const timestamp = new Date(value as string | number).getTime();
  if (Number.isNaN(timestamp)) {
    return {
      isValid: false,
      reason: `${fieldName} produces NaN (value: ${value})`,
    };
  }

  return { isValid: true };
}

/**
 * Validate required string field
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string
): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      reason: `${fieldName} is null/undefined/empty`,
    };
  }
  return { isValid: true };
}

/**
 * Safe timestamp conversion with fallback
 * Returns 0 instead of NaN for invalid dates (makes record insertable)
 */
export function safeTimestamp(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    syncLog.warn(
      'Transform',
      `Invalid timestamp "${value}" converted to 0 (epoch)`
    );
    return 0; // Fallback to epoch instead of NaN
  }

  return timestamp;
}

/**
 * Analyze server pull response for potential issues
 */
export function analyzeServerResponse(
  tableName: string,
  records: Array<Record<string, unknown>>,
  requiredFields: string[],
  timestampFields: string[]
): {
  nullRequired: Record<string, number>;
  invalidTimestamps: Record<string, number>;
  totalRecords: number;
} {
  const nullRequired: Record<string, number> = {};
  const invalidTimestamps: Record<string, number> = {};

  for (const record of records) {
    // Check required fields
    for (const field of requiredFields) {
      if (record[field] === null || record[field] === undefined) {
        nullRequired[field] = (nullRequired[field] || 0) + 1;
      }
    }

    // Check timestamp fields
    for (const field of timestampFields) {
      const value = record[field];
      if (value !== null && value !== undefined) {
        const timestamp = new Date(value as string).getTime();
        if (Number.isNaN(timestamp)) {
          invalidTimestamps[field] = (invalidTimestamps[field] || 0) + 1;
        }
      }
    }
  }

  // Log warnings if issues found
  const hasIssues =
    Object.keys(nullRequired).length > 0 ||
    Object.keys(invalidTimestamps).length > 0;

  if (hasIssues) {
    syncLog.warn('Pull', `Server ${tableName} data quality issues:`, {
      totalRecords: records.length,
      ...(Object.keys(nullRequired).length > 0 ? { nullRequired } : {}),
      ...(Object.keys(invalidTimestamps).length > 0 ? { invalidTimestamps } : {}),
    });
  }

  return {
    nullRequired,
    invalidTimestamps,
    totalRecords: records.length,
  };
}
