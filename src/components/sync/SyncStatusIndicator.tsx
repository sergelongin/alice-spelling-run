/**
 * SyncStatusIndicator
 * Shows sync health status in the header
 * - Green cloud: healthy (synced)
 * - Yellow cloud with arrow: has unsynced changes
 * - Red cloud with warning: sync inconsistencies detected
 * - Gray cloud: offline
 * - Spinning loader: checking health
 *
 * Uses WatermelonDB diagnostics to show actual sync health status.
 */

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Check, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import type { SyncHealthStatus, SyncHealthReport, HealOptions } from '@/db/hooks';

interface SyncStatusIndicatorProps {
  syncHealth: SyncHealthReport | null;
  syncHealthStatus: SyncHealthStatus;
  isSyncing: boolean;
  onCheckHealth?: () => void;
  onHealSync?: (options?: HealOptions) => void;
}

export function SyncStatusIndicator({
  syncHealth,
  syncHealthStatus,
  isSyncing,
  onCheckHealth,
  onHealSync,
}: SyncStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Determine icon and color based on sync health status
  const getStatusDisplay = () => {
    // If syncing, show spinner
    if (isSyncing) {
      return {
        icon: <Loader2 size={16} className="animate-spin" />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        tooltip: 'Syncing...',
      };
    }

    // Offline takes precedence
    if (!isOnline) {
      return {
        icon: <CloudOff size={16} />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        tooltip: 'Offline - changes will sync when back online',
      };
    }

    // Check sync health status
    switch (syncHealthStatus) {
      case 'healthy':
        return {
          icon: (
            <div className="relative">
              <Cloud size={16} />
              <Check size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
            </div>
          ),
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          tooltip: 'Synced',
        };

      case 'has_unsynced':
        return {
          icon: (
            <div className="relative">
              <Cloud size={16} />
              <Upload size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
            </div>
          ),
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          tooltip: 'Pending changes to sync',
        };

      case 'inconsistent':
        return {
          icon: (
            <div className="relative">
              <Cloud size={16} />
              <AlertTriangle size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
            </div>
          ),
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          tooltip: `Sync issue detected (${syncHealth?.inconsistencyCount || 0} issues)`,
        };

      case 'error':
        return {
          icon: (
            <div className="relative">
              <Cloud size={16} />
              <AlertTriangle size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
            </div>
          ),
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          tooltip: 'Sync error',
        };

      case 'checking':
        return {
          icon: <Loader2 size={16} className="animate-spin" />,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          tooltip: 'Checking sync health...',
        };

      case 'offline':
      default:
        return {
          icon: <CloudOff size={16} />,
          color: 'text-gray-400',
          bgColor: 'bg-gray-100',
          tooltip: 'Offline',
        };
    }
  };

  const { icon, color, bgColor, tooltip } = getStatusDisplay();

  // Format last checked time
  const lastCheckedText = syncHealth?.checkedAt
    ? `Last checked: ${new Date(syncHealth.checkedAt).toLocaleTimeString()}`
    : '';

  return (
    <div className="relative">
      <button
        className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColor} ${color} transition-colors hover:opacity-80`}
        title={tooltip}
        onClick={() => setShowDetails(!showDetails)}
      >
        {icon}
      </button>

      {/* Expanded details panel */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-gray-700">Sync Status</span>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          </div>

          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${color} mb-2`}>
            {icon}
            <span className="capitalize">{syncHealthStatus.replace('_', ' ')}</span>
          </div>

          {/* Details */}
          {syncHealth?.details && (
            <p className="text-xs text-gray-600 mb-2">{syncHealth.details}</p>
          )}

          {/* Record counts (if available) */}
          {syncHealth?.localCounts && syncHealth?.serverCounts && (
            <div className="text-xs text-gray-500 mb-2 bg-gray-50 rounded p-2">
              <div className="font-medium mb-1">Record Counts (local / server):</div>
              <div>Words: {syncHealth.localCounts.wordProgress} / {syncHealth.serverCounts.wordProgress}</div>
              <div>Games: {syncHealth.localCounts.gameSessions} / {syncHealth.serverCounts.gameSessions}</div>
              <div>Stats: {syncHealth.localCounts.statistics} / {syncHealth.serverCounts.statistics}</div>
              <div>Attempts: {syncHealth.localCounts.wordAttempts} / {syncHealth.serverCounts.wordAttempts}</div>
            </div>
          )}

          {/* Last checked */}
          {lastCheckedText && (
            <p className="text-xs text-gray-400 mb-2">{lastCheckedText}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {onCheckHealth && (
                <button
                  onClick={onCheckHealth}
                  disabled={isSyncing}
                  className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded disabled:opacity-50"
                >
                  Refresh
                </button>
              )}
              {onHealSync && (
                <button
                  onClick={() => onHealSync()}
                  disabled={isSyncing}
                  className="flex-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded disabled:opacity-50"
                >
                  Quick Repair
                </button>
              )}
            </div>
            {/* Deep Repair is always available - useful when server data was manually corrected */}
            {onHealSync && (
              <button
                onClick={() => onHealSync({
                  includeOrphanCleanup: true,
                  forceRefreshCollections: ['word_progress', 'statistics', 'game_sessions', 'calibration', 'word_attempts'],
                })}
                disabled={isSyncing}
                className="w-full text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 py-1.5 px-2 rounded disabled:opacity-50 border border-amber-300"
                title="Deletes local records not on server, forces re-sync from server. Use when server data was manually corrected."
              >
                Deep Repair (server authority)
              </button>
            )}
          </div>

          {/* Deep repair results */}
          {syncHealth?.orphanReport && (
            <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
              <div className="font-medium text-amber-800 mb-1">Orphan Cleanup Results:</div>
              <div className="text-amber-700">{syncHealth.orphanReport.details}</div>
            </div>
          )}
          {syncHealth?.refreshReport && (
            <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
              <div className="font-medium text-blue-800 mb-1">Force Refresh Results:</div>
              <div className="text-blue-700">{syncHealth.refreshReport.details}</div>
            </div>
          )}
        </div>
      )}

      {/* Simple tooltip on hover (when details panel is closed) */}
      {!showDetails && (
        <div className="absolute right-0 top-full mt-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple version of SyncStatusIndicator for when GameContext is not available.
 * Shows only online/offline status.
 */
export function SimpleSyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400"
        title="Offline"
      >
        <CloudOff size={16} />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-500"
      title="Online"
    >
      <div className="relative">
        <Cloud size={16} />
        <Check size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
      </div>
    </div>
  );
}
