import { useState } from 'react';
import { X } from 'lucide-react';
import { ErrorPattern, ErrorPatternStats } from '@/types';
import { getPatternName, getPatternDescription, getPatternHint } from '@/utils/errorPatternAnalysis';

interface ErrorPatternAnalysisProps {
  patterns: Record<ErrorPattern, ErrorPatternStats>;
}

/**
 * Shows top 3 error patterns as full-width cards.
 * "View all" opens a dialog with complete list.
 */
export function ErrorPatternAnalysis({ patterns }: ErrorPatternAnalysisProps) {
  const [showAllDialog, setShowAllDialog] = useState(false);

  // Sort patterns by count (descending) and filter out zeros
  const sortedPatterns = Object.entries(patterns)
    .filter(([, stats]) => stats.count > 0)
    .sort(([, a], [, b]) => b.count - a.count) as [ErrorPattern, ErrorPatternStats][];

  // Calculate max for bar scaling
  const maxCount = sortedPatterns.length > 0 ? sortedPatterns[0][1].count : 0;

  // Show only top 3 in main view
  const displayPatterns = sortedPatterns.slice(0, 3);
  const hasMore = sortedPatterns.length > 3;
  const totalPatterns = sortedPatterns.length;

  if (totalPatterns === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎯</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Error Pattern Analysis</h3>
            <p className="text-sm text-gray-500">
              {totalPatterns} pattern type{totalPatterns !== 1 ? 's' : ''} identified
            </p>
          </div>
        </div>

        {/* Pattern cards - full width, stacked */}
        <div className="p-5 space-y-4">
          {displayPatterns.map(([pattern, stats]) => (
            <PatternCard
              key={pattern}
              pattern={pattern}
              stats={stats}
              maxCount={maxCount}
            />
          ))}

          {/* View all button */}
          {hasMore && (
            <button
              onClick={() => setShowAllDialog(true)}
              className="w-full text-center text-sm text-purple-600 hover:text-purple-800 font-medium py-2 hover:bg-purple-50 rounded-lg transition-colors"
            >
              View all {totalPatterns} patterns →
            </button>
          )}
        </div>
      </div>

      {/* All Patterns Dialog */}
      {showAllDialog && (
        <AllPatternsDialog
          patterns={sortedPatterns}
          maxCount={maxCount}
          onClose={() => setShowAllDialog(false)}
        />
      )}
    </>
  );
}

interface PatternCardProps {
  pattern: ErrorPattern;
  stats: ErrorPatternStats;
  maxCount: number;
}

function PatternCard({ pattern, stats, maxCount }: PatternCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
      {/* Pattern name and count */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-800">
          {getPatternName(pattern)}
        </span>
        <span className="text-sm text-gray-500 font-medium">
          {stats.count}x
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full"
          style={{ width: `${(stats.count / maxCount) * 100}%` }}
        />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-2">
        {getPatternDescription(pattern)}
      </p>

      {/* Example words */}
      {stats.examples.length > 0 && (
        <p className="text-sm text-gray-500 mb-3">
          {stats.examples.slice(0, 2).map((ex, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <span className="text-gray-700">{ex.word}</span>
              <span className="text-red-400 ml-1">→ "{ex.attempt}"</span>
            </span>
          ))}
        </p>
      )}

      {/* Hint */}
      <div className="text-sm text-purple-700 bg-purple-50 p-2 rounded">
        💡 {getPatternHint(pattern, stats.examples[0]?.word || 'word')}
      </div>
    </div>
  );
}

interface AllPatternsDialogProps {
  patterns: [ErrorPattern, ErrorPatternStats][];
  maxCount: number;
  onClose: () => void;
}

function AllPatternsDialog({ patterns, maxCount, onClose }: AllPatternsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">All Error Patterns</h3>
              <p className="text-sm text-gray-500">
                {patterns.length} pattern type{patterns.length !== 1 ? 's' : ''} identified
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {patterns.map(([pattern, stats]) => (
            <PatternCard
              key={pattern}
              pattern={pattern}
              stats={stats}
              maxCount={maxCount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Get count of unique error patterns with at least one occurrence
 */
export function getActivePatternCount(patterns: Record<ErrorPattern, ErrorPatternStats>): number {
  return Object.values(patterns).filter(stats => stats.count > 0).length;
}
