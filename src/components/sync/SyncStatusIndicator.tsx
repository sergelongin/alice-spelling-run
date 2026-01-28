/**
 * SyncStatusIndicator
 * Shows subtle sync status in the header
 * - Cloud with checkmark: online (synced)
 * - Cloud with offline indicator: offline
 *
 * Note: WatermelonDB handles sync internally, so this is simplified
 * to just show online/offline status.
 */

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Check } from 'lucide-react';

export function SyncStatusIndicator() {
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

  // Determine icon and color based on online status
  const getStatusDisplay = () => {
    if (!isOnline) {
      return {
        icon: <CloudOff size={16} />,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        tooltip: 'Offline - changes will sync when back online',
      };
    }

    // Online state
    return {
      icon: (
        <div className="relative">
          <Cloud size={16} />
          <Check size={8} className="absolute -bottom-0.5 -right-0.5 stroke-[3]" />
        </div>
      ),
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      tooltip: 'Online - synced',
    };
  };

  const { icon, color, bgColor, tooltip } = getStatusDisplay();

  return (
    <div className="relative group">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColor} ${color} transition-colors`}
        title={tooltip}
      >
        {icon}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute right-0 top-full mt-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          {tooltip}
        </div>
      </div>
    </div>
  );
}
