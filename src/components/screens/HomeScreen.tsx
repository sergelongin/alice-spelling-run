import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '@/context/GameContext';
import { GameModeId } from '@/types';
import {
  HomeBackground,
  HomeCharacterScene,
  NewUserWelcome,
  ModeCards,
  HomeHeroMission,
  MotivationalProgress,
} from '@/components/home';
import {
  getWordsDueCount,
  countMasteredWords,
  calculateAchievements,
} from '@/types/achievements';
import { canIntroduceNewWords } from '@/utils/wordSelection';

export function HomeScreen() {
  const navigate = useNavigate();
  const { wordBank, statistics, hasCompletedCalibration } = useGameContext();

  const wordCount = wordBank.words.length;
  const canPlay = wordCount >= 5;
  const needsCalibration = !hasCompletedCalibration && wordCount < 5;

  // Derived data
  const activeWords = useMemo(() =>
    wordBank.words.filter(w => w.isActive !== false),
    [wordBank.words]
  );

  const dueWordCount = useMemo(() =>
    getWordsDueCount(wordBank.words),
    [wordBank.words]
  );

  const masteredCount = useMemo(() =>
    countMasteredWords(wordBank.words),
    [wordBank.words]
  );

  const { canIntroduce } = useMemo(() =>
    canIntroduceNewWords(wordBank.words),
    [wordBank.words]
  );

  const achievements = useMemo(() =>
    calculateAchievements(wordBank.words, statistics),
    [wordBank.words, statistics]
  );

  // Find next unearned streak achievement
  const nextStreakAchievement = useMemo(() => {
    const unearnedStreak = achievements
      .filter(a => a.id.startsWith('streak-master') && !a.isEarned)
      .sort((a, b) => (a.tier || 0) - (b.tier || 0));
    return unearnedStreak[0] || null;
  }, [achievements]);

  // Find next unearned mastery achievement
  const nextMasteryAchievement = useMemo(() => {
    const unearnedMastery = achievements
      .filter(a => a.id.startsWith('word-wizard') && !a.isEarned)
      .sort((a, b) => (a.tier || 0) - (b.tier || 0));
    return unearnedMastery[0] || null;
  }, [achievements]);

  // Check if all achievements are earned
  const allBadgesEarned = useMemo(() =>
    achievements.every(a => a.isEarned),
    [achievements]
  );


  const handleModeSelect = (modeId: GameModeId) => {
    if (modeId === 'wildlands') {
      navigate('/wildlands');
    } else {
      navigate('/game', { state: { mode: modeId } });
    }
  };

  // Handler for "Practice Now" from hero mission - starts Chill Mode (meadow)
  const handleStartPractice = () => {
    navigate('/game', { state: { mode: 'meadow' } });
  };

  // Handler for "Add Words" from hero mission
  const handleAddWords = () => {
    navigate('/word-bank');
  };

  // Show new user experience if they haven't calibrated and have no words
  if (needsCalibration) {
    return <NewUserWelcome />;
  }

  // Determine speech bubble text
  const getSpeechText = () => {
    if (!canPlay) return 'I need more words to practice!';
    if (statistics.streakCurrent >= 3) return "You're on fire! Keep it up!";
    if (dueWordCount > 0) return `Ready to play? ${dueWordCount} words to go!`;
    return "Ready when you are!";
  };

  return (
    <HomeBackground>
      <div className="flex flex-col items-center px-4 pt-4 pb-24 gap-4 max-w-2xl mx-auto w-full">
        {/* Compact character scene */}
        <HomeCharacterScene
          mood={canPlay ? 'ready' : 'tense'}
          showSpeechBubble={true}
          speechText={getSpeechText()}
        />

        {/* Hero mission card - primary CTA (green, launches Chill Mode) */}
        <HomeHeroMission
          dueWordCount={dueWordCount}
          canIntroduceNew={canIntroduce}
          masteredCount={masteredCount}
          totalActiveWords={activeWords.length}
          canPlay={canPlay}
          wordsNeeded={Math.max(0, 5 - wordCount)}
          onPractice={handleStartPractice}
          onAddWords={handleAddWords}
        />

        {/* Chase Mode - optional secondary action */}
        {canPlay && (
          <ModeCards
            onSelectMode={handleModeSelect}
            disabled={!canPlay}
          />
        )}

        {/* Goal-oriented progress - combines streak + mastery badges */}
        {(statistics.streakCurrent > 0 || nextMasteryAchievement || allBadgesEarned) && (
          <MotivationalProgress
            streak={statistics.streakCurrent}
            masteredCount={masteredCount}
            nextStreakAchievement={nextStreakAchievement}
            nextMasteryAchievement={nextMasteryAchievement}
            allBadgesEarned={allBadgesEarned}
          />
        )}
      </div>
    </HomeBackground>
  );
}
