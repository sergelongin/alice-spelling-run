import { useState } from 'react';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

type DisplayMode = 'hint' | 'revealed' | 'always';

interface DefinitionDisplayProps {
  definition?: string;
  example?: string;
  mode: DisplayMode;
  onReveal?: () => void; // Called when user clicks to reveal in hint mode
}

/**
 * Displays word definitions with different modes:
 * - hint: Shows a button to reveal the definition (for practice mode)
 * - revealed: Shows definition with animation (after spelling attempts)
 * - always: Definition always visible (for Word Bank)
 */
export function DefinitionDisplay({
  definition,
  example,
  mode,
  onReveal
}: DefinitionDisplayProps) {
  const [isRevealed, setIsRevealed] = useState(mode !== 'hint');

  // Don't render if there's no definition
  if (!definition) {
    return null;
  }

  const handleReveal = () => {
    setIsRevealed(true);
    onReveal?.();
  };

  // Hint mode: show button to reveal
  if (mode === 'hint' && !isRevealed) {
    return (
      <button
        onClick={handleReveal}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100
                   border border-blue-200 rounded-lg text-blue-600 text-sm
                   transition-colors animate-fadeIn"
      >
        <Eye className="w-4 h-4" />
        <span>Show Definition</span>
      </button>
    );
  }

  // Revealed or always mode: show the definition
  return (
    <div className={`animate-fadeIn ${mode === 'revealed' ? 'animate-slideUp' : ''}`}>
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200
                      rounded-xl p-4 shadow-sm max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-blue-100 rounded-full">
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <span className="font-semibold text-blue-700 text-sm">Definition</span>

          {/* Hide button in hint mode after reveal */}
          {mode === 'hint' && isRevealed && (
            <button
              onClick={() => setIsRevealed(false)}
              className="ml-auto p-1 text-blue-400 hover:text-blue-600 transition-colors"
              title="Hide definition"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Definition text */}
        <p className="text-gray-700 text-sm leading-relaxed pl-8">
          {definition}
        </p>

        {/* Example sentence (if provided) */}
        {example && (
          <p className="text-gray-500 text-xs italic mt-2 pl-8">
            Example: "{example}"
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for inline display (e.g., in feedback messages)
 */
export function DefinitionCompact({
  definition,
  className = ''
}: {
  definition?: string;
  className?: string;
}) {
  if (!definition) {
    return null;
  }

  return (
    <div className={`flex items-start gap-2 bg-blue-50 rounded-lg p-3 text-sm animate-fadeIn ${className}`}>
      <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
      <span className="text-gray-700">{definition}</span>
    </div>
  );
}

/**
 * Inline definition display for word lists
 */
export function DefinitionInline({ definition }: { definition?: string }) {
  if (!definition) {
    return null;
  }

  return (
    <span className="text-gray-500 text-sm">
      — {definition}
    </span>
  );
}
