// Challenge types for Wildlands League
export type ChallengeType = 'daily' | 'weekly';

export interface Challenge {
  id: string;
  type: ChallengeType;
  date: string; // ISO date string (YYYY-MM-DD for daily, "Week N, YYYY" for weekly)
  words: string[];
  wordCount: number;
  participants: number;
  endsAt: string; // ISO timestamp
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  wordsCorrect: number;
  totalWords?: number;
  livesRemaining: number;
  timeUsed?: number;
  completedAt: string;
  isCurrentUser?: boolean;
}

// Result submitted after completing a challenge
export interface ChallengeResult {
  challengeId: string;
  userId?: string;
  username?: string;
  wordsCorrect: number;
  totalWords: number;
  livesRemaining: number;
  totalTime: number;
  score: number;
  completedWords: { word: string; attempts: number }[];
}

export interface Leaderboard {
  challengeId: string;
  challengeType: ChallengeType;
  entries: LeaderboardEntry[];
  userEntry?: LeaderboardEntry;
  totalParticipants: number;
  lastUpdated: string;
}

export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
  totalChallengesCompleted: number;
  bestDailyRank?: number;
  bestWeeklyRank?: number;
}

// Score calculation result
export interface ScoreCalculation {
  wordsScore: number; // wordsCorrect * 100
  livesBonus: number; // livesRemaining * 50
  timeBonus: number; // Based on time remaining
  totalScore: number;
}

// Calculate score for a Wildlands challenge
export function calculateWildlandsScore(
  wordsCorrect: number,
  livesRemaining: number,
  timeUsedSeconds: number,
  maxTimeSeconds: number
): ScoreCalculation {
  const wordsScore = wordsCorrect * 100;
  const livesBonus = livesRemaining * 50;
  // Time bonus: up to 200 points based on how fast you completed
  const timeRatio = Math.max(0, (maxTimeSeconds - timeUsedSeconds) / maxTimeSeconds);
  const timeBonus = Math.round(timeRatio * 200);

  return {
    wordsScore,
    livesBonus,
    timeBonus,
    totalScore: wordsScore + livesBonus + timeBonus,
  };
}

// Challenge submission payload
export interface ChallengeSubmission {
  challengeId: string;
  username: string;
  userId: string;
  wordsCorrect: number;
  totalWords: number;
  livesRemaining: number;
  timeUsed: number;
  score: number;
  completedWords: { word: string; attempts: number }[];
}

// API response types
export interface ChallengeResponse {
  success: boolean;
  challenge?: Challenge;
  error?: string;
}

export interface LeaderboardResponse {
  success: boolean;
  leaderboard?: Leaderboard;
  error?: string;
}

export interface SubmitScoreResponse {
  success: boolean;
  rank?: number;
  totalParticipants?: number;
  error?: string;
}

// Local storage types for Wildlands
export interface WildlandsUserData {
  id: string;
  username: string;
  completedChallenges: string[]; // Array of challenge IDs
  pendingSubmissions: ChallengeSubmission[]; // For offline queue
}

export const createInitialWildlandsUserData = (): WildlandsUserData => ({
  id: crypto.randomUUID(),
  username: '',
  completedChallenges: [],
  pendingSubmissions: [],
});
