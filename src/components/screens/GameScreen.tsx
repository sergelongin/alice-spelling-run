import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Pause, Play, SkipForward } from 'lucide-react';
import { Button } from '../common';
import {
  GameCanvas,
  WordInput,
  TimerDisplay,
  LivesDisplay,
  RepeatButton,
  ContextButton,
  CompletedWordsList,
  ConfettiEffect,
  MeadowCanvas,
} from '../game';
import { useGameContext } from '@/context/GameContextDB';
import { useGameState, useGameTimer, useTextToSpeech, useSpellingHint, useWordContext } from '@/hooks';
import { selectWordsForSessionDetailed } from '@/utils';
import { GameModeId, getGameModeConfig } from '@/types';
import { defaultWords } from '@/data/defaultWords';
import { useWordCatalog } from '@/hooks/useWordCatalog';

export function GameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { wordBank, recordGame, recordWordAttempt, syncNow } = useGameContext();
  const { speak, isSupported: ttsSupported } = useTextToSpeech();

  // Get mode from route state, default to savannah
  const modeId: GameModeId = (location.state as { mode?: GameModeId })?.mode || 'savannah';
  const modeConfig = getGameModeConfig(modeId);

  const {
    gameState,
    startGame,
    setInput,
    submitAnswer,
    handleTimeUp,
    nextWord,
    skipWord,
    hideConfetti,
    getCurrentWord,
    getGameResult,
  } = useGameState();

  const [recentlyLostLife, setRecentlyLostLife] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const previousLives = useRef(gameState.lives);
  // Track if game was already initialized to prevent re-initialization on tab switch
  const gameInitializedRef = useRef(false);
  // Track current game status for use in setTimeout callbacks (avoids stale closure)
  const gameStatusRef = useRef(gameState.status);
  gameStatusRef.current = gameState.status;
  const previousWrongAttemptsCount = useRef(0);
  // Refs for context escalation tracking (non-Meadow modes)
  const previousWrongAttemptsForContext = useRef(0);
  const previousContextLevel = useRef<'word' | 'definition' | 'full'>('word');
  // Refs for real-time attempt recording
  const previousRecordedWrongAttempts = useRef(0);
  const previousCompletedCount = useRef(0);
  // Track if the current game has been recorded to prevent duplicate recordings
  // (React StrictMode can cause double-mount, each getGameResult() generates new UUID)
  const hasRecordedGameRef = useRef(false);

  // Word context for progressive disclosure pronunciation
  const {
    contextLevel,
    escalateContext,
    resetContext,
    canEscalate,
    formatPronunciation,
  } = useWordContext();

  // Word catalog for definition fallback lookups
  const { findWord: findCatalogWord } = useWordCatalog();

  // Look up the current word's full data (definition, example sentence) from wordBank
  // Falls back to defaultWords and word catalog for words imported before definitions were added
  const currentWordData = useMemo(() => {
    const currentWord = getCurrentWord();
    if (!currentWord) return null;

    const wordLower = currentWord.toLowerCase();
    const wordObj = wordBank.words.find(w => w.text.toLowerCase() === wordLower);

    // Get definition/example from wordBank first
    let definition = wordObj?.definition;
    let exampleSentence = wordObj?.exampleSentence;

    // Fall back to defaultWords if not in localStorage
    if (!definition || !exampleSentence) {
      const defaultWord = defaultWords.find(w => w.word.toLowerCase() === wordLower);
      if (defaultWord) {
        definition = definition || defaultWord.definition;
        exampleSentence = exampleSentence || defaultWord.example;
      }
    }

    // Fall back to word catalog (local cache or bundled files) if still not found
    if (!definition || !exampleSentence) {
      const catalogWord = findCatalogWord(currentWord);
      if (catalogWord) {
        definition = definition || catalogWord.definition;
        exampleSentence = exampleSentence || catalogWord.example;
      }
    }

    return {
      word: currentWord,
      definition,
      exampleSentence,
    };
  }, [getCurrentWord, wordBank.words, findCatalogWord]);

  // Spelling hint system (only for Meadow mode with Wordle feedback)
  const isMeadowMode = modeConfig.feedbackStyle === 'wordle';
  const {
    hint,
    isLoading: hintLoading,
    recordAttempt,
    clearHint,
  } = useSpellingHint({
    attemptsBeforeHint: 2,
    autoGenerate: isMeadowMode,
  });

  // Only use timer if mode has timer
  const timer = useGameTimer(
    modeConfig.hasTimer ? modeConfig.timePerWord : 999999,
    () => {
      if (gameState.status === 'playing' && modeConfig.hasTimer) {
        handleTimeUp();
      }
    }
  );

  // Initialize game on mount
  useEffect(() => {
    // Don't re-initialize if game was already initialized (prevents reset on status change)
    if (gameInitializedRef.current) {
      return;
    }

    const initializeGame = async () => {
      const { words } = selectWordsForSessionDetailed(
        wordBank.words,
        modeConfig.maxWordsPerSession
      );

      // DIAGNOSTIC: Log selection results
      const availableWords = wordBank.words.filter(w => w.introducedAt === null);
      const learningWords = wordBank.words.filter(w => w.introducedAt !== null && w.masteryLevel <= 1);
      console.log('[GameScreen] Word selection result:', {
        selectedWords: words,
        totalWordsInBank: wordBank.words.length,
        availableCount: availableWords.length,
        learningCount: learningWords.length,
      });

      if (words.length < 5) {
        navigate('/');
        return;
      }

      // NOTE: markWordsAsIntroduced is no longer called here.
      // introduced_at is now computed server-side from word_attempts (migration 037).
      // When word attempts are synced, the server computes introduced_at = MIN(attempted_at).
      // This is the event-sourced approach - if a word has been attempted, it has been introduced.

      startGame(words, modeConfig);
      gameInitializedRef.current = true;
      // Reset recording guard for new game
      hasRecordedGameRef.current = false;
    };

    initializeGame();
  }, [modeId, gameState.status]);

  // Reset the initialized ref when game ends or component unmounts
  useEffect(() => {
    return () => {
      gameInitializedRef.current = false;
    };
  }, []);

  // Start timer when game starts (only for timed modes)
  useEffect(() => {
    if (gameState.status === 'playing' && !isPaused && modeConfig.hasTimer) {
      timer.start();
    } else {
      timer.pause();
    }
  }, [gameState.status, isPaused, modeConfig.hasTimer]);

  // Speak word when it changes
  useEffect(() => {
    if (gameState.status === 'playing' && ttsSupported) {
      const currentWord = getCurrentWord();
      if (currentWord) {
        speak(currentWord);
      }
    }
  }, [gameState.currentWordIndex, gameState.status]);

  // Handle confetti and next word transition
  useEffect(() => {
    if (gameState.showConfetti && gameState.status === 'playing') {
      if (modeConfig.hasTimer) {
        timer.pause();
      }

      // After confetti, proceed to next word
      const timeout = setTimeout(() => {
        hideConfetti();
        // Check CURRENT status via ref to avoid stale closure issue
        // Game may have transitioned to 'won' while confetti was showing
        if (gameStatusRef.current === 'playing') {
          nextWord();
          if (modeConfig.hasTimer) {
            timer.reset();
            timer.start();
          }
        }
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [gameState.showConfetti]);

  // Track life loss for animation (only for modes with lives)
  useEffect(() => {
    if (modeConfig.hasLives && gameState.lives < previousLives.current) {
      setRecentlyLostLife(true);
      if (modeConfig.hasTimer) {
        timer.reset();
        timer.start();
      }

      const timeout = setTimeout(() => setRecentlyLostLife(false), 500);
      return () => clearTimeout(timeout);
    }
    previousLives.current = gameState.lives;
  }, [gameState.lives, modeConfig.hasLives, modeConfig.hasTimer]);

  // Track wrong attempts for hint generation (Meadow mode only)
  useEffect(() => {
    console.log('[GameScreen] Wrong attempts effect:', {
      isMeadowMode,
      wrongAttemptsLength: gameState.wrongAttempts.length,
      previousCount: previousWrongAttemptsCount.current,
    });
    if (isMeadowMode && gameState.wrongAttempts.length > previousWrongAttemptsCount.current) {
      const latestAttempt = gameState.wrongAttempts[gameState.wrongAttempts.length - 1];
      const currentWord = getCurrentWord();
      console.log('[GameScreen] New wrong attempt detected:', { latestAttempt, currentWord });
      if (latestAttempt && currentWord) {
        recordAttempt(latestAttempt.input, currentWord);
      }
    }
    previousWrongAttemptsCount.current = gameState.wrongAttempts.length;
  }, [gameState.wrongAttempts, isMeadowMode, getCurrentWord, recordAttempt]);

  // Clear hint and reset context when moving to next word
  useEffect(() => {
    if (isMeadowMode) {
      clearHint();
      previousWrongAttemptsCount.current = 0;
    }
    // Reset context level for new word (applies to all modes)
    resetContext();
    // Reset wrong attempts tracking for context escalation
    previousWrongAttemptsForContext.current = 0;
    previousContextLevel.current = 'word';
    // Reset recording tracker for new word
    previousRecordedWrongAttempts.current = 0;
  }, [gameState.currentWordIndex, isMeadowMode, clearHint, resetContext]);

  // Speak hint when it appears (Meadow mode only)
  useEffect(() => {
    if (isMeadowMode && hint && ttsSupported) {
      speak(hint);
    }
  }, [hint, isMeadowMode, ttsSupported, speak]);

  // Auto-escalate context and speak after wrong attempts
  useEffect(() => {
    // Check if we have a new wrong attempt
    if (gameState.wrongAttempts.length > previousWrongAttemptsForContext.current) {
      // Escalate context level and speak the new pronunciation
      if (canEscalate && currentWordData && ttsSupported) {
        escalateContext();
      }
    }
    previousWrongAttemptsForContext.current = gameState.wrongAttempts.length;
  }, [gameState.wrongAttempts.length, canEscalate, escalateContext, currentWordData, ttsSupported]);

  // Speak the escalated context after it changes (due to wrong attempt)
  useEffect(() => {
    // Only auto-speak when context level increases (not on reset or initial)
    // Skip speaking context when hint is available (hint takes priority)
    if (
      contextLevel !== 'word' &&
      contextLevel !== previousContextLevel.current &&
      currentWordData &&
      ttsSupported &&
      !hint // Don't speak context if hint exists - hint has priority
    ) {
      const pronunciation = formatPronunciation(currentWordData);
      speak(pronunciation);
    }
    previousContextLevel.current = contextLevel;
  }, [contextLevel, currentWordData, ttsSupported, formatPronunciation, speak, hint]);

  // Record wrong attempts immediately to database (for all modes)
  useEffect(() => {
    const currentWord = getCurrentWord();
    if (!currentWord) return;

    // Check if a new wrong attempt was added
    if (gameState.wrongAttempts.length > previousRecordedWrongAttempts.current) {
      const latestAttempt = gameState.wrongAttempts[gameState.wrongAttempts.length - 1];
      if (latestAttempt) {
        void recordWordAttempt(currentWord, latestAttempt.input, false, modeId);
      }
    }
    previousRecordedWrongAttempts.current = gameState.wrongAttempts.length;
  }, [gameState.wrongAttempts.length, getCurrentWord, recordWordAttempt, modeId]);

  // Record correct attempts immediately when word is completed
  useEffect(() => {
    if (gameState.completedWords.length > previousCompletedCount.current) {
      const latestCompleted = gameState.completedWords[gameState.completedWords.length - 1];
      if (latestCompleted) {
        void recordWordAttempt(
          latestCompleted.word,
          gameState.currentInput, // Record actual typed input
          true,
          modeId,
          latestCompleted.timeMs
        );
      }
    }
    previousCompletedCount.current = gameState.completedWords.length;
  }, [gameState.completedWords.length, gameState.currentInput, recordWordAttempt, modeId]);

  // Handle game end
  useEffect(() => {
    if (gameState.status === 'won' || gameState.status === 'lost') {
      // Prevent duplicate recording (StrictMode double-mount or re-renders)
      if (hasRecordedGameRef.current) {
        return;
      }
      hasRecordedGameRef.current = true;

      timer.pause();
      const result = getGameResult(modeId);

      // Record game and then navigate (await DB write to ensure data is persisted)
      (async () => {
        if (result) {
          await recordGame(result);

          // Fire-and-forget sync after game recording to push data to server
          syncNow().catch(err => {
            console.warn('[GameScreen] Post-game sync failed (ignored):', err);
          });
        }

        // Navigate to appropriate end screen based on mode after a delay
        const delay = gameState.status === 'lost' ? 2000 : 500;
        setTimeout(() => {
          if (modeId === 'meadow') {
            // Meadow mode goes to practice complete screen
            navigate('/practice-complete', { state: { result, mode: modeId } });
          } else {
            navigate(gameState.status === 'won' ? '/victory' : '/game-over', {
              state: { result, mode: modeId },
            });
          }
        }, delay);
      })();
    }
  }, [gameState.status, modeId, recordGame, syncNow, timer, getGameResult, navigate]);

  const handleRepeat = useCallback(async () => {
    const currentWord = getCurrentWord();
    if (currentWord && ttsSupported) {
      await speak(currentWord);
    }
  }, [getCurrentWord, speak, ttsSupported]);

  const handleRepeatHint = useCallback(async () => {
    if (hint && ttsSupported) {
      await speak(hint);
    }
  }, [hint, speak, ttsSupported]);

  // Handle "More Context" button click - escalate and speak
  const handleContextRequest = useCallback(async () => {
    if (!currentWordData || !ttsSupported) return;

    // In Meadow mode at full level, allow replaying the full context
    if (!canEscalate && isMeadowMode && contextLevel === 'full') {
      const text = formatPronunciation(currentWordData);
      await speak(text);
      return;
    }

    if (!canEscalate) return;

    // Escalate first, then the useEffect will handle speaking
    escalateContext();
  }, [canEscalate, isMeadowMode, contextLevel, currentWordData, ttsSupported, escalateContext, formatPronunciation, speak]);

  const handleSubmit = useCallback(() => {
    submitAnswer(modeConfig);
  }, [submitAnswer, modeConfig]);

  const handleSkip = useCallback(() => {
    if (modeConfig.unlimitedAttempts) {
      skipWord();
    }
  }, [skipWord, modeConfig.unlimitedAttempts]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  const currentWord = getCurrentWord();
  const isPlaying = gameState.status === 'playing' && !isPaused && !gameState.showConfetti;

  if (!currentWord && gameState.status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading {modeConfig.name}...</div>
      </div>
    );
  }

  // Render different canvas based on mode
  const renderCanvas = () => {
    if (modeConfig.theme === 'meadow') {
      return <MeadowCanvas isActive={isPlaying} />;
    }
    // Savannah and Wildlands use GameCanvas
    return (
      <GameCanvas
        timeRemaining={timer.timeRemaining}
        maxTime={modeConfig.timePerWord}
        isRunning={isPlaying}
        gameOver={gameState.status === 'lost'}
      />
    );
  };

  return (
    <div className="flex-1 p-4 max-w-6xl mx-auto w-full">
      {/* Confetti */}
      <ConfettiEffect show={gameState.showConfetti} />

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            preventFocusSteal
          >
            <Home size={18} />
          </Button>

          {/* Mode indicator */}
          <span className="px-3 py-1 bg-white/80 rounded-full text-sm font-medium text-gray-700">
            {modeConfig.name}
          </span>

          {modeConfig.hasTimer && (
            <Button
              onClick={togglePause}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
              disabled={gameState.status !== 'playing'}
              preventFocusSteal
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          )}
        </div>

        {/* Lives display (only for modes with lives) */}
        {modeConfig.hasLives && (
          <LivesDisplay
            currentLives={gameState.lives}
            maxLives={gameState.maxLives}
            recentlyLost={recentlyLostLife}
          />
        )}
      </div>

      {/* Timer (only for timed modes) */}
      {modeConfig.hasTimer && (
        <div className="mb-4">
          <TimerDisplay timeRemaining={timer.timeRemaining} maxTime={modeConfig.timePerWord} />
        </div>
      )}

      {/* Game canvas */}
      <div className="mb-6">
        {renderCanvas()}
      </div>

      {/* Main game area */}
      <div className="flex gap-6">
        {/* Input section */}
        <div className="flex-1">
          <div className="bg-white/90 rounded-xl p-6 shadow-lg">
            {/* Word info */}
            <div className="text-center mb-6">
              <div className="text-gray-500 text-sm mb-1">
                Word {gameState.currentWordIndex + 1} of {gameState.words.length}
              </div>
              <div className="text-lg text-gray-700">
                {currentWord.length} letters
              </div>
            </div>

            {/* Word input */}
            <div className="mb-6">
              <WordInput
                wordLength={currentWord.length}
                currentInput={gameState.currentInput}
                wrongAttempts={gameState.wrongAttempts}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                disabled={!isPlaying}
                feedbackStyle={modeConfig.feedbackStyle}
                targetWord={modeConfig.feedbackStyle === 'wordle' ? currentWord : undefined}
                hint={isMeadowMode ? hint : undefined}
                hintLoading={isMeadowMode ? hintLoading : undefined}
                onRepeatHint={isMeadowMode ? handleRepeatHint : undefined}
              />
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-4">
              <RepeatButton onRepeat={handleRepeat} disabled={!isPlaying} />

              {/* Context button for progressive disclosure */}
              <ContextButton
                contextLevel={contextLevel}
                onRequestContext={handleContextRequest}
                disabled={!isPlaying}
                allowReplayAtFull={isMeadowMode}
              />

              {/* Skip button for Meadow mode */}
              {modeConfig.unlimitedAttempts && (
                <Button
                  onClick={handleSkip}
                  variant="secondary"
                  size="sm"
                  disabled={!isPlaying}
                  className="flex items-center gap-2"
                  preventFocusSteal
                >
                  <SkipForward size={18} />
                  Skip Word
                </Button>
              )}
            </div>

            {/* TTS warning */}
            {!ttsSupported && (
              <p className="text-center text-amber-600 text-sm mt-4">
                Text-to-speech not supported in this browser
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden md:block">
          <CompletedWordsList
            words={gameState.completedWords}
            currentWordNumber={gameState.currentWordIndex + 1}
            totalWords={gameState.words.length}
          />
        </div>
      </div>

      {/* Pause overlay (only for timed modes) */}
      {isPaused && modeConfig.hasTimer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Game Paused</h2>
            <Button onClick={togglePause} variant="primary" size="lg" preventFocusSteal>
              <Play size={24} className="mr-2" />
              Resume Game
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
