import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ChildProfile } from '@/types/auth';

interface ResetProgressDialogProps {
  child: ChildProfile;
  onClose: () => void;
  onReset: () => void;
}

export function ResetProgressDialog({ child, onClose, onReset }: ResetProgressDialogProps) {
  const { resetChildProgress } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLoading]);

  const handleReset = async () => {
    setIsLoading(true);
    setError(null);

    console.log('[ResetProgressDialog] Starting reset for child:', child.id);
    const result = await resetChildProgress(child.id);
    console.log('[ResetProgressDialog] Reset result:', result);

    setIsLoading(false);

    if (result.error) {
      console.error('[ResetProgressDialog] Reset failed:', result.error);
      setError(result.error);
    } else {
      console.log('[ResetProgressDialog] Reset successful, calling onReset');
      onReset();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-gray-800 rounded-xl shadow-xl p-6">
        <div className="flex flex-col items-center text-center">
          {/* Warning icon */}
          <div className="w-12 h-12 bg-amber-900/50 rounded-full flex items-center justify-center mb-4">
            <RotateCcw className="w-6 h-6 text-amber-400" />
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">
            Reset Progress?
          </h3>

          <p className="text-gray-400 mb-4">
            This will clear all learning progress for <span className="text-white font-medium">{child.name}</span>:
          </p>

          {/* What will be deleted */}
          <ul className="text-left text-gray-300 text-sm mb-4 space-y-1 w-full bg-gray-700/50 rounded-lg p-3">
            <li>- Word mastery levels</li>
            <li>- Game history and statistics</li>
            <li>- Streaks and achievements</li>
            <li>- Calibration results</li>
          </ul>

          <p className="text-gray-500 text-sm mb-6">
            The profile will be kept. This cannot be undone.
          </p>

          {error && (
            <div className="w-full mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Resetting...
                </>
              ) : (
                'Reset Progress'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
