import { Lightbulb, Loader2, Sparkles, Volume2 } from 'lucide-react';

interface SpellingHintProps {
  hint: string | null;
  isLoading: boolean;
  attemptCount: number;
  onDismiss?: () => void;
  onRepeat?: () => void;
}

export function SpellingHint({ hint, isLoading, attemptCount, onDismiss, onRepeat }: SpellingHintProps) {
  // Don't render anything if no hint and not loading
  if (!hint && !isLoading) {
    return null;
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4 shadow-md max-w-md mx-auto">
        {/* Header with icon */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-purple-100 rounded-full">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
            ) : (
              <Lightbulb className="w-5 h-5 text-purple-500" />
            )}
          </div>
          <span className="font-semibold text-purple-700 text-sm">
            {isLoading ? 'Thinking...' : 'Helpful Hint'}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {attemptCount > 2 && (
              <Sparkles className="w-4 h-4 text-yellow-500" />
            )}
            {/* Repeat hint button */}
            {onRepeat && hint && !isLoading && (
              <button
                onClick={onRepeat}
                className="p-1.5 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors"
                title="Hear hint again"
              >
                <Volume2 className="w-4 h-4 text-purple-500" />
              </button>
            )}
          </div>
        </div>

        {/* Hint content */}
        <div className="text-gray-700 text-sm leading-relaxed pl-9">
          {isLoading ? (
            <span className="text-purple-400 italic">
              Coming up with a hint for you...
            </span>
          ) : (
            <p>{hint}</p>
          )}
        </div>

        {/* Dismiss button (optional) */}
        {onDismiss && !isLoading && (
          <button
            onClick={onDismiss}
            className="mt-2 ml-9 text-xs text-purple-500 hover:text-purple-700 underline"
          >
            Got it!
          </button>
        )}
      </div>
    </div>
  );
}

// Compact version for inline display
export function SpellingHintCompact({ hint, isLoading }: { hint: string | null; isLoading: boolean }) {
  if (!hint && !isLoading) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 bg-purple-50 rounded-lg p-3 text-sm animate-fadeIn">
      {isLoading ? (
        <Loader2 className="w-4 h-4 text-purple-500 animate-spin flex-shrink-0 mt-0.5" />
      ) : (
        <Lightbulb className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
      )}
      <span className="text-gray-700">
        {isLoading ? (
          <span className="text-purple-400 italic">Thinking...</span>
        ) : (
          hint
        )}
      </span>
    </div>
  );
}
