import { useState, useEffect, useCallback } from 'react';
import { Challenge, LeaderboardEntry, ChallengeResult } from '@/types';
import { wildlandsApi, calculateScore } from '@/services/wildlandsApi';

interface UseWildlandsReturn {
  // Challenge data
  dailyChallenge: Challenge | null;
  weeklyChallenge: Challenge | null;
  isLoadingChallenges: boolean;
  challengeError: string | null;

  // Leaderboard data
  leaderboard: LeaderboardEntry[];
  leaderboardTotal: number;
  userRank: number | null;
  isLoadingLeaderboard: boolean;
  leaderboardError: string | null;

  // Actions
  refreshChallenges: () => Promise<void>;
  loadLeaderboard: (challengeId: string) => Promise<void>;
  submitScore: (result: ChallengeResult) => Promise<{ rank: number; totalParticipants: number }>;
}

export function useWildlands(): UseWildlandsReturn {
  // Challenge state
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<Challenge | null>(null);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTotal, setLeaderboardTotal] = useState(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  // Load challenges on mount
  const refreshChallenges = useCallback(async () => {
    setIsLoadingChallenges(true);
    setChallengeError(null);

    try {
      const [daily, weekly] = await Promise.all([
        wildlandsApi.getDailyChallenge(),
        wildlandsApi.getWeeklyChallenge(),
      ]);
      setDailyChallenge(daily);
      setWeeklyChallenge(weekly);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : 'Failed to load challenges');
    } finally {
      setIsLoadingChallenges(false);
    }
  }, []);

  // Load leaderboard
  const loadLeaderboard = useCallback(async (challengeId: string) => {
    setIsLoadingLeaderboard(true);
    setLeaderboardError(null);

    try {
      const result = await wildlandsApi.getLeaderboard(challengeId);
      setLeaderboard(result.entries);
      setLeaderboardTotal(result.total);
      setUserRank(result.userRank ?? null);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : 'Failed to load leaderboard');
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, []);

  // Submit score
  const submitScore = useCallback(async (result: ChallengeResult) => {
    return wildlandsApi.submitResult(result);
  }, []);

  // Auto-load challenges on mount
  useEffect(() => {
    refreshChallenges();
  }, [refreshChallenges]);

  return {
    dailyChallenge,
    weeklyChallenge,
    isLoadingChallenges,
    challengeError,
    leaderboard,
    leaderboardTotal,
    userRank,
    isLoadingLeaderboard,
    leaderboardError,
    refreshChallenges,
    loadLeaderboard,
    submitScore,
  };
}

// Re-export calculateScore for convenience
export { calculateScore };
