import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { BatchGenerationState } from '@/types/audio';

interface AudioGenerationProgressProps {
  state: BatchGenerationState;
  onCancel: () => void;
}

export function AudioGenerationProgress({ state, onCancel }: AudioGenerationProgressProps) {
  if (!state.isGenerating && state.totalWords === 0) {
    return null;
  }

  const progress = state.totalWords > 0 ? (state.completedWords / state.totalWords) * 100 : 0;
  const isComplete = !state.isGenerating && state.completedWords === state.totalWords;
  const hasErrors = state.failedWords.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">
          {isComplete ? 'Generation Complete' : 'Generating Audio...'}
        </h3>
        {state.isGenerating && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Cancel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute left-0 top-0 h-full transition-all duration-300 ${
            hasErrors ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-600">
            {state.completedWords} / {state.totalWords} words
          </span>
          {state.failedWords.length > 0 && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertCircle size={14} />
              {state.failedWords.length} failed
            </span>
          )}
        </div>

        {state.currentWord && state.isGenerating && (
          <span className="text-blue-600 flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" />
            {state.currentWord}
          </span>
        )}

        {isComplete && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle size={14} />
            Done
          </span>
        )}
      </div>

      {/* Failed words list */}
      {hasErrors && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Failed words:</p>
          <div className="flex flex-wrap gap-1">
            {state.failedWords.slice(0, 10).map((word) => (
              <span
                key={word}
                className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded"
              >
                {word}
              </span>
            ))}
            {state.failedWords.length > 10 && (
              <span className="text-xs text-gray-500">
                +{state.failedWords.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
