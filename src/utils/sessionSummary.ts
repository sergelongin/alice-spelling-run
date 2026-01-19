import { GameResult, GameStatistics } from '@/types';

export interface SessionWin {
  type: 'first-time' | 'streak' | 'improvement' | 'milestone' | 'consistency';
  message: string;
}

/**
 * Check if a word was spelled correctly for the first time
 */
const isFirstTimeCorrect = (word: string, stats: GameStatistics): boolean => {
  const wordKey = word.toLowerCase();
  // If we don't have a firstCorrectDates entry, it's the first time
  return !stats.firstCorrectDates?.[wordKey];
};

/**
 * Calculate the average words correct from recent game results
 */
const getRecentAverage = (previousResults: GameResult[], count: number): number => {
  if (previousResults.length === 0) return 0;

  const recent = previousResults.slice(0, count);
  const total = recent.reduce((sum, r) => sum + r.wordsCorrect, 0);
  return total / recent.length;
};

/**
 * Find positive things to celebrate from a game session
 * Always returns at least one positive message to end sessions on a win
 */
export const findSessionWins = (
  result: GameResult,
  stats: GameStatistics,
  previousResults: GameResult[]
): SessionWin[] => {
  const wins: SessionWin[] = [];

  // 1. First-time correct words (most exciting!)
  for (const completed of result.completedWords) {
    if (isFirstTimeCorrect(completed.word, stats)) {
      wins.push({
        type: 'first-time',
        message: `First time spelling "${completed.word}"!`,
      });
      // Only show max 2 first-time wins to avoid overwhelming
      if (wins.filter(w => w.type === 'first-time').length >= 2) break;
    }
  }

  // 2. Improvement over recent sessions
  const recentAvg = getRecentAverage(previousResults, 5);
  if (result.wordsCorrect > recentAvg && previousResults.length > 0) {
    const improvement = result.wordsCorrect - Math.floor(recentAvg);
    if (improvement > 0) {
      wins.push({
        type: 'improvement',
        message: `${improvement} more ${improvement === 1 ? 'word' : 'words'} than your average!`,
      });
    }
  }

  // 3. Beat previous best in session (if we have history)
  if (previousResults.length > 0) {
    const previousBest = Math.max(...previousResults.map(r => r.wordsCorrect));
    if (result.wordsCorrect > previousBest) {
      wins.push({
        type: 'improvement',
        message: `New personal best: ${result.wordsCorrect} words!`,
      });
    }
  }

  // 4. Streaks (daily play streak)
  // Note: We check streakCurrent from the mode stats, but it's already been updated
  // So we need to look at the pre-game value. For now, just celebrate if there's a streak.
  const modeStats = stats.modeStats?.savannah; // TODO: Make this mode-aware
  if (modeStats && modeStats.streakCurrent > 0) {
    wins.push({
      type: 'streak',
      message: `${modeStats.streakCurrent} day play streak!`,
    });
  }

  // 5. Milestones (total words spelled)
  const totalWords = (modeStats?.totalWordsCorrect || 0);
  const newTotal = totalWords + result.wordsCorrect;

  // Check for round number milestones
  const milestones = [10, 25, 50, 100, 150, 200, 250, 500, 1000];
  for (const milestone of milestones) {
    if (totalWords < milestone && newTotal >= milestone) {
      wins.push({
        type: 'milestone',
        message: `${milestone} words spelled total!`,
      });
      break; // Only show one milestone
    }
  }

  // 6. Games played milestone
  const totalGames = (modeStats?.totalGamesPlayed || 0) + 1;
  const gameMilestones = [5, 10, 25, 50, 100];
  for (const milestone of gameMilestones) {
    if (totalGames === milestone) {
      wins.push({
        type: 'milestone',
        message: `${milestone} games played!`,
      });
      break;
    }
  }

  // 7. Fallback: always have at least one positive thing to say
  if (wins.length === 0) {
    if (result.wordsCorrect > 0) {
      wins.push({
        type: 'consistency',
        message: `You spelled ${result.wordsCorrect} ${result.wordsCorrect === 1 ? 'word' : 'words'} correctly!`,
      });
    } else if (result.wordsAttempted > 0) {
      wins.push({
        type: 'consistency',
        message: `You attempted ${result.wordsAttempted} ${result.wordsAttempted === 1 ? 'word' : 'words'} - keep practicing!`,
      });
    } else {
      wins.push({
        type: 'consistency',
        message: `${(modeStats?.totalGamesPlayed || 0) + 1} games played - every try counts!`,
      });
    }
  }

  // Return top 3 wins to keep the UI clean
  return wins.slice(0, 3);
};

/**
 * Generate an encouraging message based on the session result
 */
export const getEncouragingMessage = (result: GameResult): string => {
  if (result.wordsCorrect === result.wordsAttempted && result.wordsCorrect > 0) {
    return "Perfect round! You're on fire!";
  }

  if (result.wordsCorrect > 0) {
    const accuracy = result.wordsCorrect / result.wordsAttempted;
    if (accuracy >= 0.8) {
      return "Great accuracy! You're getting really good!";
    } else if (accuracy >= 0.5) {
      return "Nice progress! Keep practicing and you'll improve!";
    } else {
      return "Every word you try makes you better. Keep going!";
    }
  }

  return "Don't give up! Every attempt is practice.";
};
