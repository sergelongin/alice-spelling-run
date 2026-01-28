import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button, WordDetailModal } from '../common';
import { TodaysMissionCard } from './TodaysMissionCard';
import { ProgressJourney } from './ProgressJourney';
import { AchievementBadges } from './AchievementBadges';
import { StarWordsShowcase } from './StarWordsShowcase';
import { useGameContext } from '@/context/GameContextDB';
import { useFreshGameData } from '@/hooks';
import {
  calculateAchievements,
  getRecentlyMasteredWords,
  getWordsDueCount,
} from '@/types/achievements';
import { categorizeWordsByState, canIntroduceNewWords } from '@/utils/wordSelection';
import { Word } from '@/types';

/**
 * Child Mode view of the Word Bank.
 * Maximum visual appeal, minimum text, game-like experience.
 */
export function ChildWordBank() {
  const navigate = useNavigate();
  const { wordBank, statistics, isLoading } = useFreshGameData();
  const { forceIntroduceWord, archiveWord, unarchiveWord } = useGameContext();

  const [selectedWord, setSelectedWord] = React.useState<Word | null>(null);

  // Calculate derived data - ALL hooks must run before any early return
  const activeWords = useMemo(() =>
    wordBank.words.filter(w => w.isActive !== false),
    [wordBank.words]
  );

  const wordStates = useMemo(() =>
    categorizeWordsByState(activeWords),
    [activeWords]
  );

  const dueWordCount = useMemo(() =>
    getWordsDueCount(wordBank.words),
    [wordBank.words]
  );

  const canIntroduce = useMemo(() =>
    canIntroduceNewWords(activeWords).canIntroduce,
    [activeWords]
  );

  const achievements = useMemo(() =>
    calculateAchievements(wordBank.words, statistics),
    [wordBank.words, statistics]
  );

  const recentlyMastered = useMemo(() =>
    getRecentlyMasteredWords(wordBank.words, 8),
    [wordBank.words]
  );

  // Show loading spinner while WatermelonDB subscriptions initialize
  // IMPORTANT: This early return is AFTER all hooks (per React rules of hooks)
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
      </div>
    );
  }

  const handlePractice = () => {
    // Navigate to game with meadow mode (practice mode)
    navigate('/game', { state: { mode: 'meadow' } });
  };

  const handleWordClick = (word: Word) => {
    setSelectedWord(word);
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          My Spelling Adventure
        </h1>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main content - left side */}
        <div className="flex-1 space-y-6">
          {/* Today's Mission Card */}
          <TodaysMissionCard
            dueWordCount={dueWordCount}
            canIntroduceNew={canIntroduce}
            masteredCount={wordStates.mastered.length}
            totalActiveWords={activeWords.length}
            onPractice={handlePractice}
          />

          {/* Achievement Badges - mobile only */}
          <div className="md:hidden">
            <AchievementBadges achievements={achievements} />
          </div>

          {/* Progress Journey */}
          <ProgressJourney
            words={wordBank.words}
            onWordClick={handleWordClick}
          />

          {/* Star Words Showcase - mobile only */}
          {recentlyMastered.length > 0 && (
            <div className="md:hidden">
              <StarWordsShowcase words={recentlyMastered} />
            </div>
          )}

          {/* Empty state */}
          {activeWords.length === 0 && (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="text-5xl mb-4">📚</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">No words yet!</h3>
              <p className="text-gray-500 mb-4">
                Ask a parent to add some words for you to practice.
              </p>
              <Button
                onClick={() => navigate('/parent-dashboard')}
                variant="primary"
                className="inline-flex items-center gap-2"
              >
                <Users size={18} />
                Go to Parent Dashboard
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar - desktop only */}
        <aside className="hidden md:block w-72 flex-shrink-0">
          <div className="sticky top-8 space-y-6">
            <AchievementBadges achievements={achievements} variant="compact" />
            {recentlyMastered.length > 0 && (
              <StarWordsShowcase words={recentlyMastered} variant="sidebar" />
            )}
          </div>
        </aside>
      </div>

      {/* Word detail modal */}
      <WordDetailModal
        word={selectedWord}
        isOpen={selectedWord !== null}
        onClose={() => setSelectedWord(null)}
        onForceIntroduce={forceIntroduceWord}
        onArchive={archiveWord}
        onUnarchive={unarchiveWord}
      />
    </div>
  );
}
