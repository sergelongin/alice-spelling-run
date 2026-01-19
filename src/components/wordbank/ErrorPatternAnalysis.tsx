import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ErrorPattern, ErrorPatternStats } from '@/types';
import { getPatternName, getPatternDescription, getPatternHint } from '@/utils/errorPatternAnalysis';

interface ErrorPatternAnalysisProps {
  patterns: Record<ErrorPattern, ErrorPatternStats>;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Breakdown of error patterns with occurrence counts and examples.
 * Shows which spelling challenges the student faces most often.
 */
export function ErrorPatternAnalysis({
  patterns,
  isExpanded,
  onToggleExpand,
}: ErrorPatternAnalysisProps) {
  const [expandedPattern, setExpandedPattern] = useState<ErrorPattern | null>(null);

  // Sort patterns by count (descending) and filter out zeros
  const sortedPatterns = Object.entries(patterns)
    .filter(([, stats]) => stats.count > 0)
    .sort(([, a], [, b]) => b.count - a.count) as [ErrorPattern, ErrorPatternStats][];

  // Calculate max for bar scaling
  const maxCount = sortedPatterns.length > 0 ? sortedPatterns[0][1].count : 0;

  // Count total error patterns for summary
  const totalPatterns = sortedPatterns.length;

  if (totalPatterns === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-lg">🎯</span>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800">Error Pattern Analysis</h3>
            <p className="text-sm text-gray-500">{totalPatterns} pattern types identified</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Pattern list */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          {sortedPatterns.map(([pattern, stats]) => (
            <div key={pattern} className="space-y-2">
              {/* Pattern bar */}
              <button
                onClick={() => setExpandedPattern(expandedPattern === pattern ? null : pattern)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {getPatternName(pattern)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {stats.count} time{stats.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full
                             transition-all duration-300 group-hover:opacity-80"
                    style={{ width: `${(stats.count / maxCount) * 100}%` }}
                  />
                </div>
              </button>

              {/* Expanded details */}
              {expandedPattern === pattern && (
                <div className="ml-1 pl-3 border-l-2 border-purple-200 space-y-2 py-2">
                  <p className="text-sm text-gray-600">
                    {getPatternDescription(pattern)}
                  </p>

                  {/* Example words */}
                  {stats.examples.length > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500">Examples: </span>
                      {stats.examples.slice(0, 3).map((ex, i) => (
                        <span key={i} className="text-gray-700">
                          {i > 0 && ', '}
                          <span className="capitalize">{ex.word}</span>
                          <span className="text-red-400 text-xs ml-1">({ex.attempt})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hint */}
                  <div className="bg-purple-50 rounded-lg p-3 text-sm text-purple-800">
                    💡 {getPatternHint(pattern, stats.examples[0]?.word || 'word')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Get count of unique error patterns with at least one occurrence
 */
export function getActivePatternCount(patterns: Record<ErrorPattern, ErrorPatternStats>): number {
  return Object.values(patterns).filter(stats => stats.count > 0).length;
}
