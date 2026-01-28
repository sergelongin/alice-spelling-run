import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCalibration } from '@/hooks';
import { useGameContext } from '@/context/GameContextDB';
import { GradeLevel } from '@/data/gradeWords';
import {
  CalibrationWelcome,
  CalibrationGame,
  CalibrationResults,
  GradeSelector,
} from '@/components/calibration';

type ScreenPhase = 'welcome' | 'grade-select' | 'playing' | 'results';

function getInitialPhase(searchParams: URLSearchParams): ScreenPhase {
  const phaseParam = searchParams.get('phase');
  if (phaseParam === 'playing' || phaseParam === 'grade-select') {
    return phaseParam;
  }
  return 'welcome';
}

export function CalibrationScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { importGradeWords, setCalibrationComplete } = useGameContext();
  const {
    state,
    currentWord,
    currentGrade,
    progress,
    result,
    actions,
  } = useCalibration();

  const [phase, setPhase] = useState<ScreenPhase>(() => getInitialPhase(searchParams));
  const [initialized, setInitialized] = useState(false);

  // Initialize calibration if starting directly in playing phase
  useEffect(() => {
    if (!initialized) {
      const initialPhase = getInitialPhase(searchParams);
      if (initialPhase === 'playing' && state.status === 'not_started') {
        actions.start();
      }
      setInitialized(true);
    }
  }, [initialized, searchParams, state.status, actions]);

  // Handle starting the calibration
  const handleStart = () => {
    actions.start();
    setPhase('playing');
  };

  // Handle skip - show grade selector
  const handleSkipToSelector = () => {
    setPhase('grade-select');
  };

  // Handle grade selection from skip flow
  const handleGradeSelect = (grade: GradeLevel) => {
    actions.skip(grade);
    setPhase('results');
  };

  // Handle back from grade selector
  const handleBackFromSelector = () => {
    setPhase('welcome');
  };

  // Handle answer submission
  const handleSubmitAnswer = (isCorrect: boolean) => {
    actions.submitAnswer(isCorrect);

    // Check if calibration is now complete
    if (state.status === 'completed' || state.status === 'skipped') {
      setPhase('results');
    }
  };

  // Handle confirming results and importing words
  const handleConfirmResults = async () => {
    if (result) {
      // Import the recommended grade words
      await importGradeWords(result.recommendedGrade);

      // Mark calibration as complete
      await setCalibrationComplete(result);

      // Navigate to home
      navigate('/');
    }
  };

  // Handle recalibration
  const handleRecalibrate = () => {
    actions.reset();
    setPhase('welcome');
  };

  // Determine current phase based on state
  // If we're playing but the state machine completed, we should be in results
  const effectivePhase =
    phase === 'playing' && (state.status === 'completed' || state.status === 'skipped')
      ? 'results'
      : phase;

  // Render based on effective phase
  switch (effectivePhase) {
    case 'welcome':
      return (
        <CalibrationWelcome
          onStart={handleStart}
          onSkip={handleSkipToSelector}
        />
      );

    case 'grade-select':
      return (
        <GradeSelector
          onSelect={handleGradeSelect}
          onBack={handleBackFromSelector}
        />
      );

    case 'playing':
      return (
        <CalibrationGame
          currentWord={currentWord}
          currentGrade={currentGrade}
          wordsCompleted={state.totalWordsPresented}
          progress={progress}
          onSubmit={handleSubmitAnswer}
        />
      );

    case 'results':
      if (!result) {
        // Shouldn't happen, but fallback
        return (
          <CalibrationWelcome
            onStart={handleStart}
            onSkip={handleSkipToSelector}
          />
        );
      }
      return (
        <CalibrationResults
          result={result}
          onConfirm={handleConfirmResults}
          onRecalibrate={handleRecalibrate}
        />
      );

    default:
      return null;
  }
}
