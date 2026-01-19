import { AlertTriangle, ChevronRight } from 'lucide-react';

interface AttentionNeededAlertProps {
  strugglingWordCount: number;
  errorPatternCount: number;
  onViewDetails: () => void;
}

/**
 * Alert box highlighting areas that need parent attention.
 * Shows struggling words count and error pattern alerts.
 */
export function AttentionNeededAlert({
  strugglingWordCount,
  errorPatternCount,
  onViewDetails,
}: AttentionNeededAlertProps) {
  // Don't show if nothing needs attention
  if (strugglingWordCount === 0 && errorPatternCount === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-lg">✓</span>
          </div>
          <div>
            <h4 className="font-semibold text-green-800">All Good!</h4>
            <p className="text-sm text-green-600">No words currently need special attention.</p>
          </div>
        </div>
      </div>
    );
  }

  const issues = [];
  if (strugglingWordCount > 0) {
    issues.push(`${strugglingWordCount} struggling word${strugglingWordCount !== 1 ? 's' : ''}`);
  }
  if (errorPatternCount > 0) {
    issues.push(`${errorPatternCount} error pattern${errorPatternCount !== 1 ? 's' : ''}`);
  }

  return (
    <button
      onClick={onViewDetails}
      className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4 text-left
               hover:bg-amber-100 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-800">Attention Needed</h4>
            <p className="text-sm text-amber-600">{issues.join(' • ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-600 text-sm font-medium
                      group-hover:translate-x-1 transition-transform">
          View Details
          <ChevronRight size={16} />
        </div>
      </div>
    </button>
  );
}
