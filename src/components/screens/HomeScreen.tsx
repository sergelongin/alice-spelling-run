import { useNavigate } from 'react-router-dom';
import { BookOpen, BarChart3, Sparkles } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { GameModeId } from '@/types';
import {
  HomeBackground,
  HomeCharacterScene,
  PlayButton,
  NewUserWelcome,
  ReturningUserDashboard,
  ModeDrawer,
} from '@/components/home';

export function HomeScreen() {
  const navigate = useNavigate();
  const { wordBank, statistics, hasCompletedCalibration } = useGameContext();

  const wordCount = wordBank.words.length;
  const canPlay = wordCount >= 5;
  const isNewUser = statistics.totalGamesPlayed === 0;
  const needsCalibration = !hasCompletedCalibration && wordCount < 5;

  // Count words at mastery level 3+ as "learned"
  const wordsLearned = wordBank.words.filter(w => (w.masteryLevel || 0) >= 3).length;

  const handleModeSelect = (modeId: GameModeId) => {
    if (modeId === 'wildlands') {
      navigate('/wildlands');
    } else {
      navigate('/game', { state: { mode: modeId } });
    }
  };

  const handleQuickPlay = () => {
    handleModeSelect('savannah-quick');
  };

  const handleGoToWordBank = () => {
    navigate('/word-bank');
  };

  // Show new user experience if they haven't calibrated and have no words
  if (needsCalibration) {
    return <NewUserWelcome />;
  }

  // Returning user experience
  return (
    <HomeBackground>
      <div className="flex flex-col items-center px-6 pt-6 pb-32">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-1 flex items-center justify-center gap-2">
            <Sparkles className="text-amber-500" size={24} />
            Alice Spelling Run
            <Sparkles className="text-amber-500" size={24} />
          </h1>
          <p className="text-amber-700 font-medium">
            {isNewUser ? 'Ready for your first adventure?' : 'Welcome back!'}
          </p>
        </div>

        {/* Character scene */}
        <HomeCharacterScene
          mood={canPlay ? 'ready' : 'tense'}
          showSpeechBubble={true}
          speechText={
            canPlay
              ? "Let's go! I'm ready to run!"
              : 'I need more words to practice!'
          }
        />

        {/* User stats (only for returning users with some history) */}
        {statistics.totalGamesPlayed > 0 && (
          <div className="mb-6 w-full flex justify-center">
            <ReturningUserDashboard
              streak={statistics.streakCurrent}
              totalWins={statistics.totalWins}
              wordsLearned={wordsLearned}
              gamesPlayed={statistics.totalGamesPlayed}
            />
          </div>
        )}

        {/* Main CTA */}
        <div className="mb-4 text-center">
          {!canPlay ? (
            <div className="mb-4">
              <p className="text-gray-600 text-sm mb-3">
                Add {5 - wordCount} more word{5 - wordCount !== 1 ? 's' : ''} to start playing!
              </p>
              <PlayButton
                label="Add Words"
                onClick={handleGoToWordBank}
                variant="secondary"
                size="normal"
              />
            </div>
          ) : (
            <PlayButton
              label="Quick Escape"
              sublabel="8 words • ~5 minutes"
              onClick={handleQuickPlay}
              variant="adventure"
              size="large"
            />
          )}
        </div>

        {/* More modes (collapsed by default) */}
        {canPlay && (
          <div className="mb-6 w-full flex justify-center">
            <ModeDrawer
              onSelectMode={handleModeSelect}
              disabled={!canPlay}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={handleGoToWordBank}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-lg text-gray-700 hover:bg-white transition-colors text-sm font-medium"
          >
            <BookOpen size={16} />
            Words ({wordCount})
          </button>

          <button
            onClick={() => navigate('/statistics')}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur rounded-lg text-gray-700 hover:bg-white transition-colors text-sm font-medium"
          >
            <BarChart3 size={16} />
            Stats
          </button>
        </div>
      </div>
    </HomeBackground>
  );
}
