import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '@/context/GameContextDB';
import { GameModeId } from '@/types';
import {
  HomeCharacterScene,
  NewUserWelcome,
  ModeCards,
  HomeHeroMission,
} from '@/components/home';
import { LevelMapBackground } from '@/components/levelMap';
import {
  getWordsDueCount,
  countMasteredWords,
} from '@/types/achievements';
import { canIntroduceNewWords } from '@/utils/wordSelection';
import { calculateLevelMapProgress } from '@/utils/levelMapUtils';

export function HomeScreen() {
  const navigate = useNavigate();
  const { wordBank, statistics, learningProgress, hasCompletedCalibration, isLoading } = useGameContext();

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
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

  // Level map progress for hero mission card
  const levelMapProgress = useMemo(() =>
    calculateLevelMapProgress(learningProgress),
    [learningProgress]
  );

  // Show loading spinner while WatermelonDB subscriptions initialize
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
      </div>
    );
  }

  const wordCount = wordBank.words.length;
  const canPlay = wordCount >= 5;
  const needsCalibration = !hasCompletedCalibration && wordCount < 5;


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
    <LevelMapBackground>
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
          levelMapProgress={levelMapProgress}
        />

        {/* Chase Mode - optional secondary action */}
        {canPlay && (
          <ModeCards
            onSelectMode={handleModeSelect}
            disabled={!canPlay}
          />
        )}
      </div>
    </LevelMapBackground>
  );
}
