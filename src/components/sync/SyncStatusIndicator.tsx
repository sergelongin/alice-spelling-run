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

import { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, CloudOff, Check, AlertTriangle, Upload, Loader2, Book, Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { SyncHealthStatus, SyncHealthReport, HealOptions } from '@/db/hooks';
import type { MultiChildSyncHealthReport } from '@/db/syncDiagnostics';
import { getLocalCatalogCount, syncWordCatalog } from '@/db/syncWordCatalog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface SyncStatusIndicatorProps {
  syncHealth: SyncHealthReport | null;
  syncHealthStatus: SyncHealthStatus;
  isSyncing: boolean;
  onCheckHealth?: () => void;
  onHealSync?: (options?: HealOptions) => void;
  // Parent multi-child view props
  isParentView?: boolean;
  multiChildHealth?: MultiChildSyncHealthReport | null;
  onSyncAllChildren?: () => Promise<void>;
}

export function SyncStatusIndicator({
  syncHealth,
  syncHealthStatus,
  isSyncing,
  onCheckHealth,
  onHealSync,
  isParentView = false,
  multiChildHealth,
  onSyncAllChildren,
}: SyncStatusIndicatorProps) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  const [showChildDetails, setShowChildDetails] = useState(false);
  const [isSyncingAllChildren, setIsSyncingAllChildren] = useState(false);

  // Word catalog counts
  const [catalogCounts, setCatalogCounts] = useState<{ local: number; server: number } | null>(null);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  // Ref for click-outside detection
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Close dialog when clicking outside
  useEffect(() => {
    if (!showDetails) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    };

    // Use setTimeout to avoid closing immediately from the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDetails]);

  // Fetch word catalog counts when details panel opens
  // Auto-syncs if local count differs from server count
  const fetchCatalogCounts = useCallback(async () => {
    try {
      const [localCount, serverResult] = await Promise.all([
        getLocalCatalogCount(),
        supabase
          .from('words')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
      ]);

      const serverCount = serverResult.count || 0;
      setCatalogCounts({
        local: localCount,
        server: serverCount,
      });

      // Auto-sync if local differs from server
      if (localCount !== serverCount && user && !isSyncingCatalog && isOnline) {
        console.log('[SyncStatusIndicator] Auto-syncing catalog - local:', localCount, 'server:', serverCount);
        setIsSyncingCatalog(true);
        try {
          await syncWordCatalog(user.id, true); // Force full sync
          // Refresh counts after sync
          const newLocalCount = await getLocalCatalogCount();
          setCatalogCounts({ local: newLocalCount, server: serverCount });
        } catch (err) {
          console.error('[SyncStatusIndicator] Auto-sync failed:', err);
        } finally {
          setIsSyncingCatalog(false);
        }
      }
    } catch (err) {
      console.error('[SyncStatusIndicator] Failed to fetch catalog counts:', err);
    }
  }, [user, isSyncingCatalog, isOnline]);

  useEffect(() => {
    if (showDetails) {
      fetchCatalogCounts();
    }
  }, [showDetails, fetchCatalogCounts]);

  // Sync word catalog
  const handleSyncCatalog = useCallback(async () => {
    if (!user || isSyncingCatalog) return;

    setIsSyncingCatalog(true);
    try {
      await syncWordCatalog(user.id, true); // Force full sync
      await fetchCatalogCounts(); // Refresh counts
    } catch (err) {
      console.error('[SyncStatusIndicator] Failed to sync catalog:', err);
    } finally {
      setIsSyncingCatalog(false);
    }
  }, [user, isSyncingCatalog, fetchCatalogCounts]);

  // Sync all children handler
  const handleSyncAllChildren = useCallback(async () => {
    if (!onSyncAllChildren || isSyncingAllChildren) return;

    setIsSyncingAllChildren(true);
    try {
      await onSyncAllChildren();
    } catch (err) {
      console.error('[SyncStatusIndicator] Failed to sync all children:', err);
    } finally {
      setIsSyncingAllChildren(false);
    }
  }, [onSyncAllChildren, isSyncingAllChildren]);

  // Determine icon and color based on sync health status
  const getStatusDisplay = () => {
    // If syncing, show spinner
    if (isSyncing || isSyncingAllChildren) {
      return {
        icon: <Loader2 size={16} className="animate-spin" />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        tooltip: isSyncingAllChildren ? 'Syncing all children...' : 'Syncing...',
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

    // For parent view, use multi-child aggregate status if available
    const effectiveStatus = isParentView && multiChildHealth
      ? multiChildHealth.overallStatus
      : syncHealthStatus;

    // Check sync health status
    switch (effectiveStatus) {
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
    <div className="relative" ref={containerRef}>
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
            <span className="capitalize">
              {(isParentView && multiChildHealth ? multiChildHealth.overallStatus : syncHealthStatus).replace('_', ' ')}
            </span>
          </div>

          {/* Multi-child status (parent view) */}
          {isParentView && multiChildHealth && multiChildHealth.childReports.length > 0 && (
            <div className="text-xs text-gray-500 mb-2 bg-indigo-50 rounded p-2 border border-indigo-100">
              <button
                onClick={() => setShowChildDetails(!showChildDetails)}
                className="flex items-center justify-between w-full font-medium text-indigo-700"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={12} />
                  All Children ({multiChildHealth.childReports.length})
                </span>
                {showChildDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showChildDetails && (
                <div className="mt-2 space-y-1.5">
                  {multiChildHealth.childReports.map(report => {
                    const statusColor =
                      report.health.status === 'healthy' ? 'text-green-600' :
                      report.health.status === 'has_unsynced' ? 'text-yellow-600' :
                      report.health.status === 'error' || report.health.status === 'inconsistent' ? 'text-red-600' :
                      'text-gray-500';

                    return (
                      <div key={report.childId} className="flex items-center justify-between">
                        <span className="text-gray-700">{report.childName}</span>
                        <span className={`capitalize ${statusColor}`}>
                          {report.health.status.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sync All Children button */}
              {onSyncAllChildren && (
                <button
                  onClick={handleSyncAllChildren}
                  disabled={isSyncingAllChildren || !isOnline}
                  className="mt-2 w-full text-[10px] bg-indigo-100 hover:bg-indigo-200 text-indigo-700 py-1 px-2 rounded disabled:opacity-50"
                >
                  {isSyncingAllChildren ? 'Syncing all children...' : 'Sync All Children'}
                </button>
              )}
            </div>
          )}

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

          {/* Word Catalog sync status */}
          <div className="text-xs text-gray-500 mb-2 bg-purple-50 rounded p-2 border border-purple-100">
            <div className="flex items-center gap-1.5 font-medium mb-1 text-purple-700">
              <Book size={12} />
              Word Catalog
            </div>
            {catalogCounts ? (
              <>
                <div className="text-purple-600">
                  Cached: {catalogCounts.local} / {catalogCounts.server} server
                </div>
                {catalogCounts.local < catalogCounts.server && (
                  <div className="text-amber-600 text-[10px] mt-0.5">
                    {catalogCounts.server - catalogCounts.local} words not yet synced
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400">Loading...</div>
            )}
            <button
              onClick={handleSyncCatalog}
              disabled={isSyncingCatalog || !isOnline}
              className="mt-1.5 w-full text-[10px] bg-purple-100 hover:bg-purple-200 text-purple-700 py-1 px-2 rounded disabled:opacity-50"
            >
              {isSyncingCatalog ? 'Syncing...' : 'Sync Word Catalog'}
            </button>
          </div>

          {/* Last checked */}
          {lastCheckedText && (
            <p className="text-xs text-gray-400 mb-2">{lastCheckedText}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Sync Now - triggers actual sync and reports health */}
            {onCheckHealth && (
              <button
                onClick={onCheckHealth}
                disabled={isSyncing}
                className="w-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 py-1.5 px-2 rounded disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
            {/* Deep Repair - last resort when sync isn't enough */}
            {onHealSync && (
              <button
                onClick={() => onHealSync({
                  includeOrphanCleanup: true,
                  forceRefreshCollections: ['word_progress', 'statistics', 'game_sessions', 'calibration', 'word_attempts'],
                })}
                disabled={isSyncing}
                className="w-full text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 py-1.5 px-2 rounded disabled:opacity-50 border border-amber-300"
                title="Deletes local records not on server, forces complete re-sync from server. Use when normal sync isn't resolving issues."
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
