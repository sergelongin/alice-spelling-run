import { AlertCircle, Play, Archive } from 'lucide-react';
import { Word } from '@/types';
import { analyzeError } from '@/utils/errorPatternAnalysis';
import { getPatternName } from '@/utils/errorPatternAnalysis';

interface StrugglingWord extends Word {
  accuracy: number;
  recentAttempts: string[];
  patterns: string[];
}

interface StrugglingWordsPanelProps {
  words: StrugglingWord[];
  onForcePractice?: (wordId: string) => void;
  onArchive?: (wordId: string) => void;
}

/**
 * Panel showing words with lowest accuracy that need focused practice.
 * Shows error patterns and recent wrong attempts for each word.
 * Always expanded - no collapse toggle.
 */
export function StrugglingWordsPanel({
  words,
  onForcePractice,
  onArchive,
}: StrugglingWordsPanelProps) {
  if (words.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header - static, no collapse toggle */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-red-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Struggling Words</h3>
          <p className="text-sm text-gray-500">{words.length} word{words.length !== 1 ? 's' : ''} need extra practice</p>
        </div>
      </div>

      {/* Word list - always visible */}
      <div className="divide-y divide-gray-50">
        {words.map(word => (
          <div key={word.id} className="px-5 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Word and stats */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-gray-800 capitalize">{word.text}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                    Level {word.masteryLevel}
                  </span>
                  <span className="text-xs text-gray-500">
                    {(word.attemptHistory || []).length} attempts
                  </span>
                  <span className={`text-xs font-medium ${
                    word.accuracy < 33 ? 'text-red-600' :
                    word.accuracy < 50 ? 'text-orange-600' : 'text-amber-600'
                  }`}>
                    {word.accuracy}% accuracy
                  </span>
                </div>

                {/* Error pattern */}
                {word.patterns.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pattern: <span className="text-gray-700">{word.patterns.join(', ')}</span>
                  </p>
                )}

                {/* Recent wrong attempts */}
                {word.recentAttempts.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Recent: {word.recentAttempts.map((attempt, i) => (
                      <span key={i} className="text-red-400 ml-1">"{attempt}"</span>
                    ))}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-3">
                {onForcePractice && (
                  <button
                    onClick={() => onForcePractice(word.id)}
                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Focus practice"
                  >
                    <Play size={16} />
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={() => onArchive(word.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Archive word"
                  >
                    <Archive size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Get struggling words with analysis data.
 * Struggling words have accuracy < 50% and at least 3 attempts.
 */
export function getStrugglingWords(words: Word[]): StrugglingWord[] {
  const struggling: StrugglingWord[] = [];

  for (const word of words) {
    if (word.isActive === false) continue;

    // Calculate attempts and accuracy from attemptHistory
    const attempts = word.attemptHistory || [];
    const totalAttempts = attempts.length;
    if (totalAttempts < 3) continue;

    const correctAttempts = attempts.filter(a => a.wasCorrect).length;
    const accuracy = totalAttempts > 0
      ? Math.round((correctAttempts / totalAttempts) * 100)
      : 0;

    if (accuracy >= 50) continue;

    // Get recent wrong attempts
    const recentAttempts = (word.attemptHistory || [])
      .filter(a => !a.wasCorrect)
      .slice(0, 3)
      .map(a => a.typedText);

    // Analyze patterns from wrong attempts
    const patternCounts = new Map<string, number>();
    for (const attempt of word.attemptHistory || []) {
      if (!attempt.wasCorrect) {
        const patterns = analyzeError(attempt.typedText, word.text);
        for (const pattern of patterns) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }
      }
    }

    // Get most common patterns
    const patterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ErrorPatternType from string key
      .map(([pattern]) => getPatternName(pattern as any));

    struggling.push({
      ...word,
      accuracy,
      recentAttempts,
      patterns,
    });
  }

  // Sort by lowest accuracy first
  return struggling.sort((a, b) => a.accuracy - b.accuracy);
}
