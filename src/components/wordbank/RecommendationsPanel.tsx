import React from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, PartyPopper, BookOpen } from 'lucide-react';
import { Word, ErrorPattern, ErrorPatternStats } from '@/types';
import { categorizeWordsByState } from '@/utils/wordSelection';
import { getPatternName } from '@/utils/errorPatternAnalysis';

interface RecommendationsPanelProps {
  words: Word[];
  errorPatterns: Record<ErrorPattern, ErrorPatternStats>;
  recentMasteredCount: number;
}

interface Recommendation {
  type: 'success' | 'warning' | 'tip' | 'info';
  icon: React.ReactNode;
  message: string;
}

/**
 * AI-style recommendations panel with generated insights.
 * Provides actionable suggestions based on learning data.
 */
export function RecommendationsPanel({
  words,
  errorPatterns,
  recentMasteredCount,
}: RecommendationsPanelProps) {
  const recommendations = generateRecommendations(words, errorPatterns, recentMasteredCount);

  if (recommendations.length === 0) {
    return null;
  }

  const iconStyles: Record<Recommendation['type'], string> = {
    success: 'bg-green-100 text-green-600',
    warning: 'bg-amber-100 text-amber-600',
    tip: 'bg-blue-100 text-blue-600',
    info: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-amber-500" />
        Recommendations
      </h3>

      <div className="space-y-3">
        {recommendations.map((rec, index) => (
          <div
            key={index}
            className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-sm"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconStyles[rec.type]}`}>
              {rec.icon}
            </div>
            <p className="text-sm text-gray-700 pt-1">{rec.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Generate recommendations based on word and pattern data
 */
function generateRecommendations(
  words: Word[],
  errorPatterns: Record<ErrorPattern, ErrorPatternStats>,
  recentMasteredCount: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const activeWords = words.filter(w => w.isActive !== false);
  const { learning, mastered } = categorizeWordsByState(activeWords);

  // Celebration: Recent mastered words
  if (recentMasteredCount > 0) {
    recommendations.push({
      type: 'success',
      icon: <PartyPopper size={16} />,
      message: `Great progress! ${recentMasteredCount} word${recentMasteredCount !== 1 ? 's' : ''} mastered this week!`,
    });
  }

  // Find dominant error pattern
  const sortedPatterns = Object.entries(errorPatterns)
    .filter(([, stats]) => stats.count >= 3)
    .sort(([, a], [, b]) => b.count - a.count) as [ErrorPattern, ErrorPatternStats][];

  if (sortedPatterns.length > 0) {
    const [topPattern, topStats] = sortedPatterns[0];
    recommendations.push({
      type: 'tip',
      icon: <BookOpen size={16} />,
      message: `Focus on ${getPatternName(topPattern).toLowerCase()} this week - it's the most common challenge (${topStats.count} occurrences).`,
    });
  }

  // Warning: Too many learning words
  if (learning.length >= 15) {
    recommendations.push({
      type: 'warning',
      icon: <AlertTriangle size={16} />,
      message: `${learning.length} words are still being learned. Consider focusing on fewer words before adding new ones.`,
    });
  }

  // Find struggling words
  const strugglingWords = activeWords.filter(w => {
    if (w.timesUsed < 3) return false;
    const accuracy = w.timesCorrect / w.timesUsed;
    return accuracy < 0.5;
  });

  if (strugglingWords.length > 0) {
    // Find the word with lowest accuracy
    const hardestWord = strugglingWords.reduce((min, w) => {
      const minAcc = min.timesUsed > 0 ? min.timesCorrect / min.timesUsed : 1;
      const wAcc = w.timesUsed > 0 ? w.timesCorrect / w.timesUsed : 1;
      return wAcc < minAcc ? w : min;
    });

    recommendations.push({
      type: 'warning',
      icon: <AlertTriangle size={16} />,
      message: `"${hardestWord.text}" needs targeted practice - only ${Math.round((hardestWord.timesCorrect / hardestWord.timesUsed) * 100)}% accuracy after ${hardestWord.timesUsed} attempts.`,
    });
  }

  // Positive progress if high mastery rate
  const masteryRate = activeWords.length > 0 ? mastered.length / activeWords.length : 0;
  if (masteryRate >= 0.5 && mastered.length >= 10) {
    recommendations.push({
      type: 'success',
      icon: <TrendingUp size={16} />,
      message: `${Math.round(masteryRate * 100)}% of words mastered! Excellent work - keep up the momentum!`,
    });
  }

  // Suggest adding more words if mastery is high
  if (masteryRate >= 0.8 && activeWords.length < 50) {
    recommendations.push({
      type: 'info',
      icon: <BookOpen size={16} />,
      message: `Ready for more? Consider adding words from the next grade level to keep progressing.`,
    });
  }

  // No recent practice warning
  const lastPracticeDate = activeWords.reduce((latest, w) => {
    if (!w.lastAttemptAt) return latest;
    const wDate = new Date(w.lastAttemptAt);
    return wDate > latest ? wDate : latest;
  }, new Date(0));

  const daysSinceLastPractice = Math.floor((Date.now() - lastPracticeDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastPractice >= 3 && activeWords.length > 0) {
    recommendations.push({
      type: 'warning',
      icon: <AlertTriangle size={16} />,
      message: `It's been ${daysSinceLastPractice} days since last practice. Regular practice helps retention!`,
    });
  }

  return recommendations.slice(0, 5); // Limit to 5 recommendations
}
