import { useRef, useEffect } from 'react';
import { Lightbulb, Loader2, Volume2 } from 'lucide-react';
import { CharacterSlot } from './CharacterSlot';
import { WrongAttempt, LetterFeedbackResult } from '@/types';
import { computeWordleFeedback } from '@/utils';

interface WordInputProps {
  wordLength: number;
  currentInput: string;
  wrongAttempts: WrongAttempt[];
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  feedbackStyle?: 'simple' | 'wordle';
  targetWord?: string; // Required for wordle feedback
  // Hint props (for Meadow mode)
  hint?: string | null;
  hintLoading?: boolean;
  onRepeatHint?: () => void;
}

export function WordInput({
  wordLength,
  currentInput,
  wrongAttempts,
  onInputChange,
  onSubmit,
  disabled,
  feedbackStyle = 'simple',
  targetWord,
  hint,
  hintLoading,
  onRepeatHint,
}: WordInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount and when enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentInput.length === wordLength) {
      onSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
    if (value.length <= wordLength) {
      onInputChange(value);
    }
  };

  // Create array of slots for current input
  const slots = [];
  for (let i = 0; i < wordLength; i++) {
    const letter = currentInput[i] || null;
    const isActive = i === currentInput.length;

    slots.push(
      <CharacterSlot
        key={i}
        letter={letter}
        isActive={isActive && !disabled}
      />
    );
  }

  // Render the hint callout below an attempt
  const renderHintCallout = () => {
    if (!hint && !hintLoading) return null;

    return (
      <div className="mt-2 mb-2 animate-fadeIn">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-3 shadow-md max-w-sm mx-auto">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 bg-purple-100 rounded-full">
              {hintLoading ? (
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4 text-purple-500" />
              )}
            </div>
            <span className="font-semibold text-purple-700 text-xs">
              {hintLoading ? 'Thinking...' : 'Helpful Hint'}
            </span>
            {/* Repeat button */}
            {onRepeatHint && hint && !hintLoading && (
              <button
                onClick={onRepeatHint}
                onMouseDown={(e) => e.preventDefault()}
                className="ml-auto p-1 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors"
                title="Hear hint again"
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-500" />
              </button>
            )}
          </div>
          {/* Content */}
          <div className="text-gray-700 text-sm leading-relaxed pl-6">
            {hintLoading ? (
              <span className="text-purple-400 italic text-xs">
                Coming up with a hint for you...
              </span>
            ) : (
              <p className="text-xs">{hint}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render wrong attempts based on feedback style (newest first)
  const renderWrongAttempts = () => {
    if (wrongAttempts.length === 0) return null;

    // Reverse to show newest attempts first
    const reversedAttempts = [...wrongAttempts].reverse();

    return (
      <div className="mt-4 space-y-2">
        <p className="text-sm text-gray-500 text-center">Previous attempts:</p>
        <div className="flex flex-col gap-2 items-center">
          {reversedAttempts.map((attempt, attemptIndex) => (
            <div key={wrongAttempts.length - 1 - attemptIndex}>
              {/* The attempt letters */}
              <div className="flex gap-1 justify-center">
                {feedbackStyle === 'wordle' && targetWord ? (
                  // Wordle-style feedback
                  renderWordleFeedback(attempt.input, targetWord)
                ) : (
                  // Simple feedback (green/red)
                  renderSimpleFeedback(attempt)
                )}
              </div>
              {/* Show hint below the most recent attempt (first in reversed list) */}
              {attemptIndex === 0 && renderHintCallout()}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Wordle-style feedback for an attempt
  const renderWordleFeedback = (input: string, target: string) => {
    const feedback = computeWordleFeedback(input, target);
    return feedback.map((result, index) => (
      <WordleFeedbackSlot key={index} result={result} />
    ));
  };

  // Render simple feedback (existing behavior)
  const renderSimpleFeedback = (attempt: WrongAttempt) => {
    return attempt.input.split('').map((letter, letterIndex) => {
      const isWrong = attempt.incorrectIndices.includes(letterIndex);
      return (
        <span
          key={letterIndex}
          className={`w-8 h-10 flex items-center justify-center text-lg font-bold uppercase rounded ${
            isWrong
              ? 'bg-red-200 text-red-700 border-2 border-red-400'
              : 'bg-green-200 text-green-700 border-2 border-green-400'
          }`}
        >
          {letter}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Visual slots for current input */}
      <div
        className="flex gap-2"
        onClick={() => inputRef.current?.focus()}
      >
        {slots}
      </div>

      {/* Hidden input for keyboard capture */}
      <input
        ref={inputRef}
        type="text"
        value={currentInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="sr-only"
        aria-label="Type your spelling"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* Submit hint */}
      {currentInput.length === wordLength && !disabled && (
        <p className="text-gray-600 text-sm animate-pulse">
          Press Enter to submit
        </p>
      )}

      {/* Wrong attempts display */}
      {renderWrongAttempts()}

      {/* Wordle hint legend for Meadow mode */}
      {feedbackStyle === 'wordle' && wrongAttempts.length > 0 && (
        <div className="mt-2 flex gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span>Wrong spot</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-400 rounded" />
            <span>Not in word</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for Wordle feedback slot
function WordleFeedbackSlot({ result }: { result: LetterFeedbackResult }) {
  const bgClass = {
    correct: 'bg-green-500 text-white border-green-600',
    present: 'bg-yellow-500 text-white border-yellow-600',
    absent: 'bg-gray-400 text-white border-gray-500',
    empty: 'bg-gray-100 text-gray-800 border-gray-300',
  }[result.feedback];

  return (
    <span
      className={`w-8 h-10 flex items-center justify-center text-lg font-bold uppercase rounded border-2 ${bgClass}`}
    >
      {result.letter}
    </span>
  );
}
