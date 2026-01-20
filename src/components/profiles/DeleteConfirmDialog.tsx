import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ChildProfile } from '@/types/auth';

interface DeleteConfirmDialogProps {
  child: ChildProfile;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmDialog({ child, onClose, onDeleted }: DeleteConfirmDialogProps) {
  const { removeChild } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const result = await removeChild(child.id);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onDeleted();
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
          <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">
            Delete Profile?
          </h3>

          <p className="text-gray-400 mb-6">
            Are you sure you want to delete <span className="text-white font-medium">{child.name}</span>'s profile?
            This will remove all their progress and cannot be undone.
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
              onClick={handleDelete}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
