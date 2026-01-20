import type { ChildProfile } from './auth';
import type { WordBank, GameStatistics } from './index';

/**
 * Status indicator for a child's learning progress
 */
export type ChildStatus = 'excellent' | 'on-track' | 'needs-attention';

/**
 * Summary statistics for a single child
 */
export interface ChildSummary {
  childId: string;
  child: ChildProfile;
  totalWords: number;
  masteredWords: number;
  accuracy: number;
  streak: number;
  status: ChildStatus;
  lastActivityDate: string | null;
  daysSinceActivity: number | null;
}

/**
 * Aggregated statistics across all children
 */
export interface FamilyOverview {
  totalWords: number;
  totalMastered: number;
  averageAccuracy: number;
  childCount: number;
}

/**
 * An issue that needs parent attention
 */
export interface AttentionItem {
  type: 'inactivity' | 'struggling-words' | 'error-pattern';
  childId: string;
  childName: string;
  message: string;
  severity: 'warning' | 'alert';
}

/**
 * Time range for filtering dashboard data
 */
export type TimeRange = '7d' | '30d' | '90d';

/**
 * Child data bundle for parent dashboard
 */
export interface ChildData {
  wordBank: WordBank;
  statistics: GameStatistics;
}
