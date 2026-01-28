import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContextDB';
import type { WordBank, GameStatistics, LearningProgress } from '@/types';

/**
 * Hook that fetches fresh data from WatermelonDB on mount.
 *
 * This addresses a timing issue where WatermelonDB subscriptions are async:
 * when recordGame() completes, the database write is done but subscriptions
 * haven't fired yet. Screens that mount immediately after navigation would
 * show stale data until the subscription callback runs.
 *
 * This hook queries the database directly on mount, bypassing the subscription
 * timing issue and guaranteeing fresh data is displayed.
 */
export function useFreshGameData() {
  const ctx = useGameContext();
  const [hasFetched, setHasFetched] = useState(false);
  const [freshData, setFreshData] = useState<{
    wordBank: WordBank;
    statistics: GameStatistics;
    learningProgress: LearningProgress;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!ctx.isLoading && !hasFetched) {
      ctx.fetchFreshData()
        .then(data => {
          if (!cancelled) {
            setFreshData(data);
            setHasFetched(true);
          }
        })
        .catch(() => {
          // On error, still mark as fetched so we fall back to context data
          if (!cancelled) {
            setHasFetched(true);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [ctx.isLoading, hasFetched, ctx.fetchFreshData]);

  return {
    wordBank: freshData?.wordBank || ctx.wordBank,
    statistics: freshData?.statistics || ctx.statistics,
    learningProgress: freshData?.learningProgress || ctx.learningProgress,
    isLoading: ctx.isLoading || !hasFetched,
  };
}
