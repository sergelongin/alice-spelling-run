import { useMemo } from 'react';
import { Sparkles, Lightbulb, Volume2 } from 'lucide-react';
import { Word, ErrorPattern } from '@/types';
import { useTextToSpeech } from '@/hooks';
import { analyzeError, getPatternHint } from '@/utils/errorPatternAnalysis';

interface AlmostThereWord {
  word: Word;
  accuracy: number;
  correctNeeded: number;
  primaryPattern: ErrorPattern | null;
}

interface AlmostThereSectionProps {
  words: Word[];
}

/**
 * Child-friendly "Almost There" section that positively frames struggling words.
 * Shows words close to being mastered with progress bars and encouraging tips.
 */
export function AlmostThereSection({ words }: AlmostThereSectionProps) {
  const { speak, isSupported: ttsSupported } = useTextToSpeech();

  // Find words that need more practice (attempted 3+ times, accuracy < 80%)
  const almostThereWords = useMemo((): AlmostThereWord[] => {
    const candidates: AlmostThereWord[] = [];

    for (const word of words) {
      if (word.isActive === false) continue;
      if (word.timesUsed < 2) continue;

      const accuracy = word.timesUsed > 0
        ? Math.round((word.timesCorrect / word.timesUsed) * 100)
        : 0;

      // Include words with accuracy < 80% (not yet mastered)
      if (accuracy >= 80) continue;

      // Calculate how many more correct answers needed to reach 80%
      // (correct + x) / (total + x) >= 0.8
      // Solving for x: x >= (0.8 * total - correct) / 0.2
      const neededForMastery = Math.ceil((0.8 * word.timesUsed - word.timesCorrect) / 0.2);
      const correctNeeded = Math.max(1, neededForMastery);

      // Find the primary error pattern from attempt history
      let primaryPattern: ErrorPattern | null = null;
      const patternCounts = new Map<ErrorPattern, number>();

      for (const attempt of word.attemptHistory || []) {
        if (!attempt.wasCorrect) {
          const patterns = analyzeError(attempt.typedText, word.text);
          for (const pattern of patterns) {
            patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
          }
        }
      }

      if (patternCounts.size > 0) {
        const sorted = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1]);
        primaryPattern = sorted[0][0];
      }

      candidates.push({
        word,
        accuracy,
        correctNeeded,
        primaryPattern,
      });
    }

    // Sort by accuracy (highest first - closest to mastery) and limit to 3
    return candidates
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3);
  }, [words]);

  // Get an encouraging tip based on the most common error pattern across all shown words
  const encouragingTip = useMemo(() => {
    if (almostThereWords.length === 0) return null;

    // Find the most common pattern among these words
    const patternCounts = new Map<ErrorPattern, { count: number; word: string }>();

    for (const item of almostThereWords) {
      if (item.primaryPattern) {
        const existing = patternCounts.get(item.primaryPattern);
        if (!existing || existing.count < (item.word.timesUsed - item.word.timesCorrect)) {
          patternCounts.set(item.primaryPattern, {
            count: item.word.timesUsed - item.word.timesCorrect,
            word: item.word.text,
          });
        }
      }
    }

    if (patternCounts.size === 0) return null;

    const sorted = Array.from(patternCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    const [pattern, { word }] = sorted[0];

    return getPatternHint(pattern, word);
  }, [almostThereWords]);

  const handleSpeak = (word: string) => {
    if (ttsSupported) {
      speak(word);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 shadow-sm border border-purple-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Almost There!</h3>
          <p className="text-sm text-gray-500">You're so close to mastering these words</p>
        </div>
      </div>

      {/* Word cards or empty state */}
      {almostThereWords.length === 0 ? (
        <div className="bg-white/60 rounded-lg p-6 text-center border border-purple-100 mb-4">
          <div className="text-4xl mb-3">🌟</div>
          <p className="text-gray-600 font-medium mb-1">Keep practicing!</p>
          <p className="text-sm text-gray-500">
            Words you're working on will appear here with tips to help you master them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {almostThereWords.map(({ word, accuracy, correctNeeded }) => (
          <div
            key={word.id}
            className="bg-white rounded-lg p-4 border border-purple-100 hover:border-purple-200 transition-colors"
          >
            {/* Word with speaker button */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800 capitalize">{word.text}</span>
              {ttsSupported && (
                <button
                  onClick={() => handleSpeak(word.text)}
                  className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Listen"
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(accuracy, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">{accuracy}%</span>
                <span className="text-xs text-purple-600 font-medium">80% to master</span>
              </div>
            </div>

            {/* Encouraging message */}
            <p className="text-xs text-gray-500">
              {correctNeeded === 1 ? (
                <span className="text-purple-600 font-medium">Just 1 more to go!</span>
              ) : (
                <span>{correctNeeded} more correct to master!</span>
              )}
            </p>
          </div>
          ))}
        </div>
      )}

      {/* Helpful tip */}
      {encouragingTip && (
        <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3 border border-purple-100">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-medium text-gray-700">Tip: </span>
            {encouragingTip}
          </p>
        </div>
      )}
    </div>
  );
}
