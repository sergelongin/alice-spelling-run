import { useState, useRef, useEffect, useMemo } from 'react';
import { Volume2, Send, Sparkles } from 'lucide-react';
import { useTextToSpeech } from '@/hooks';
import { CalibrationProgress } from './CalibrationProgress';
import { PlayerSprite } from '@/components/game/PlayerSprite';
import { DefinitionCompact } from '@/components/game/DefinitionDisplay';
import { CALIBRATION_CONFIG } from '@/types/calibration';
import { GradeLevel, GRADE_WORDS } from '@/data/gradeWords';

interface CalibrationGameProps {
  currentWord: string;
  currentGrade: GradeLevel;
  wordsCompleted: number;
  progress: number;
  onSubmit: (isCorrect: boolean) => void;
}

// Encouraging messages for feedback
const CORRECT_MESSAGES = [
  'Great spelling!',
  'You got it!',
  'Excellent!',
  'Perfect!',
  'Well done!',
];

const INCORRECT_MESSAGES = [
  'Good try!',
  'Almost there!',
  'Keep going!',
  'Nice effort!',
  "Let's try the next one!",
];

export function CalibrationGame({
  currentWord,
  currentGrade,
  wordsCompleted,
  progress,
  onSubmit,
}: CalibrationGameProps) {
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'correct' | 'incorrect';
    message: string;
  } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, isSpeaking } = useTextToSpeech();

  // Look up the definition for the current word
  const currentDefinition = useMemo(() => {
    const wordLower = currentWord.toLowerCase();
    // Search in current grade first, then adjacent grades
    const gradesToSearch: GradeLevel[] = [currentGrade];
    if (currentGrade > 3) gradesToSearch.push((currentGrade - 1) as GradeLevel);
    if (currentGrade < 6) gradesToSearch.push((currentGrade + 1) as GradeLevel);

    for (const grade of gradesToSearch) {
      const gradeWords = GRADE_WORDS[grade] || [];
      const found = gradeWords.find(wd => wd.word.toLowerCase() === wordLower);
      if (found) return found.definition;
    }
    return undefined;
  }, [currentWord, currentGrade]);

  // Focus input on mount and word change
  useEffect(() => {
    if (!isTransitioning) {
      inputRef.current?.focus();
    }
  }, [currentWord, isTransitioning]);

  // Speak the word on mount and word change
  useEffect(() => {
    if (currentWord && !isTransitioning) {
      speak(currentWord);
    }
  }, [currentWord, isTransitioning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isTransitioning) return;

    const isCorrect = input.toLowerCase().trim() === currentWord.toLowerCase();

    // Show feedback
    const messages = isCorrect ? CORRECT_MESSAGES : INCORRECT_MESSAGES;
    const message = messages[Math.floor(Math.random() * messages.length)];
    setFeedback({ type: isCorrect ? 'correct' : 'incorrect', message });
    setIsTransitioning(true);

    // After feedback, move to next word
    setTimeout(() => {
      onSubmit(isCorrect);
      setInput('');
      setFeedback(null);
      setIsTransitioning(false);
    }, 1200);
  };

  const handlePlayWord = () => {
    speak(currentWord);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
      {/* Header with progress */}
      <div className="p-6 bg-white/50 backdrop-blur-sm">
        <CalibrationProgress
          progress={progress}
          wordsCompleted={wordsCompleted}
          maxWords={CALIBRATION_CONFIG.maxTotalWords}
        />
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Character encouragement */}
        <div className="mb-8 flex items-end gap-4">
          <div className="transform scale-90">
            <PlayerSprite isRunning={false} />
          </div>
          <div className="bg-white rounded-2xl px-4 py-3 shadow-md border border-amber-100 max-w-[200px]">
            <p className="text-sm text-gray-600">
              {feedback
                ? feedback.message
                : 'Listen carefully and spell the word!'}
            </p>
          </div>
        </div>

        {/* Feedback overlay */}
        {feedback && (
          <div className="mb-6 flex flex-col items-center gap-3">
            <div
              className={`px-6 py-3 rounded-full font-bold text-lg flex items-center gap-2 animate-bounce ${
                feedback.type === 'correct'
                  ? 'bg-green-100 text-green-700 border-2 border-green-300'
                  : 'bg-amber-100 text-amber-700 border-2 border-amber-300'
              }`}
            >
              {feedback.type === 'correct' && <Sparkles size={20} />}
              {feedback.message}
              {feedback.type === 'correct' && <Sparkles size={20} />}
            </div>
            {/* Show definition after feedback */}
            {currentDefinition && (
              <DefinitionCompact definition={currentDefinition} className="max-w-sm" />
            )}
          </div>
        )}

        {/* Word display area */}
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full">
          {/* Listen button */}
          <button
            onClick={handlePlayWord}
            disabled={isSpeaking || isTransitioning}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:from-purple-300 disabled:to-indigo-300 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 mb-6"
          >
            <Volume2 size={24} className={isSpeaking ? 'animate-pulse' : ''} />
            {isSpeaking ? 'Playing...' : 'Listen to the word'}
          </button>

          {/* Input form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Type what you hear:
              </label>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTransitioning}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full px-6 py-4 text-2xl text-center font-mono rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none transition-all disabled:bg-gray-50"
                placeholder="..."
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isTransitioning}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              <Send size={20} />
              Check Spelling
            </button>
          </form>
        </div>

        {/* Hint text */}
        <p className="mt-6 text-gray-500 text-sm text-center">
          Take your time - there's no timer!
        </p>
      </div>
    </div>
  );
}
