import { Challenge, LeaderboardEntry, ChallengeResult } from '@/types';

// API base URL - will be configured for production
const API_BASE = import.meta.env.VITE_WILDLANDS_API_URL || '';

// Mock data for development
const mockDailyChallenge: Challenge = {
  id: `daily-${new Date().toISOString().split('T')[0]}`,
  type: 'daily',
  date: new Date().toISOString().split('T')[0],
  words: ['adventure', 'beautiful', 'challenge', 'discover', 'excellent', 'fantastic', 'gorgeous', 'happiness', 'important', 'joyful'],
  wordCount: 10,
  participants: 142,
  endsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours from now
};

const mockWeeklyChallenge: Challenge = {
  id: `weekly-${new Date().getFullYear()}-w${Math.ceil((new Date().getDate()) / 7)}`,
  type: 'weekly',
  date: `Week ${Math.ceil((new Date().getDate()) / 7)}, ${new Date().getFullYear()}`,
  words: ['achievement', 'beautiful', 'celebration', 'determined', 'environment', 'friendship', 'generation', 'historical', 'incredible', 'knowledge', 'leadership', 'magnificent', 'neighborhood', 'opportunity', 'perspective'],
  wordCount: 15,
  participants: 523,
  endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
};

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: 'SpellingChamp', score: 1250, wordsCorrect: 10, livesRemaining: 5, completedAt: new Date().toISOString() },
  { rank: 2, username: 'WordWizard', score: 1180, wordsCorrect: 10, livesRemaining: 4, completedAt: new Date().toISOString() },
  { rank: 3, username: 'AlphabetAce', score: 1100, wordsCorrect: 10, livesRemaining: 3, completedAt: new Date().toISOString() },
  { rank: 4, username: 'LetterLegend', score: 1050, wordsCorrect: 9, livesRemaining: 5, completedAt: new Date().toISOString() },
  { rank: 5, username: 'SpellStar', score: 980, wordsCorrect: 9, livesRemaining: 4, completedAt: new Date().toISOString() },
  { rank: 6, username: 'VocabVictor', score: 920, wordsCorrect: 9, livesRemaining: 3, completedAt: new Date().toISOString() },
  { rank: 7, username: 'GrammarGuru', score: 850, wordsCorrect: 8, livesRemaining: 5, completedAt: new Date().toISOString() },
  { rank: 8, username: 'WordWhiz', score: 800, wordsCorrect: 8, livesRemaining: 4, completedAt: new Date().toISOString() },
  { rank: 9, username: 'SpellingSensei', score: 750, wordsCorrect: 8, livesRemaining: 3, completedAt: new Date().toISOString() },
  { rank: 10, username: 'LetterLover', score: 700, wordsCorrect: 7, livesRemaining: 5, completedAt: new Date().toISOString() },
];

// Helper to check if we should use mock data
const useMockData = !API_BASE;

// Calculate score from game result
export function calculateScore(wordsCorrect: number, livesRemaining: number, totalTime: number): number {
  const baseScore = wordsCorrect * 100;
  const lifeBonus = livesRemaining * 50;
  const timeBonus = Math.max(0, Math.floor((300 - totalTime) / 10) * 10); // Bonus for finishing under 5 minutes
  return baseScore + lifeBonus + timeBonus;
}

// API functions
export const wildlandsApi = {
  // Get daily challenge
  async getDailyChallenge(): Promise<Challenge> {
    if (useMockData) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockDailyChallenge;
    }

    const response = await fetch(`${API_BASE}/api/challenges/daily`);
    if (!response.ok) {
      throw new Error('Failed to fetch daily challenge');
    }
    return response.json();
  },

  // Get weekly challenge
  async getWeeklyChallenge(): Promise<Challenge> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockWeeklyChallenge;
    }

    const response = await fetch(`${API_BASE}/api/challenges/weekly`);
    if (!response.ok) {
      throw new Error('Failed to fetch weekly challenge');
    }
    return response.json();
  },

  // Submit challenge result
  async submitResult(result: ChallengeResult): Promise<{ rank: number; totalParticipants: number }> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock response: random rank between 10-50
      return {
        rank: Math.floor(Math.random() * 40) + 10,
        totalParticipants: result.challengeId.includes('daily') ? 142 : 523,
      };
    }

    const response = await fetch(`${API_BASE}/api/challenges/${result.challengeId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      throw new Error('Failed to submit result');
    }
    return response.json();
  },

  // Get leaderboard for a challenge
  async getLeaderboard(challengeId: string, limit = 50, offset = 0): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    userRank?: number;
  }> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        entries: mockLeaderboard.slice(offset, offset + limit),
        total: 142,
        userRank: 15,
      };
    }

    const response = await fetch(
      `${API_BASE}/api/leaderboards/${challengeId}?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }
    return response.json();
  },

  // Register or update user
  async registerUser(username: string, deviceId: string): Promise<{ userId: string }> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { userId: `mock-${deviceId}` };
    }

    const response = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, deviceId }),
    });
    if (!response.ok) {
      throw new Error('Failed to register user');
    }
    return response.json();
  },
};
