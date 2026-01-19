import { Trophy, Star, ChevronRight, RotateCcw } from 'lucide-react';
import { CalibrationResult } from '@/types/calibration';
import { getGradeInfo, GradeLevel } from '@/data/gradeWords';
import { PlayerSprite } from '@/components/game/PlayerSprite';
import ConfettiExplosion from 'react-confetti-explosion';

interface CalibrationResultsProps {
  result: CalibrationResult;
  onConfirm: () => void;
  onRecalibrate: () => void;
}

export function CalibrationResults({
  result,
  onConfirm,
  onRecalibrate,
}: CalibrationResultsProps) {
  const gradeInfo = getGradeInfo(result.recommendedGrade);

  // Calculate stats
  const totalAttempts = result.attempts.length;
  const correctCount = result.attempts.filter((a) => a.isCorrect).length;
  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

  // Grade color mapping
  const gradeColors: Record<GradeLevel, { bg: string; text: string; border: string }> = {
    3: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    4: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    5: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    6: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  };

  const colors = gradeColors[result.recommendedGrade];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-amber-50">
      {/* Confetti */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2">
        <ConfettiExplosion
          particleCount={150}
          duration={3000}
          colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
        />
      </div>

      {/* Celebration header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Star className="text-yellow-500 fill-yellow-500" size={32} />
          <Trophy className="text-amber-500" size={40} />
          <Star className="text-yellow-500 fill-yellow-500" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Adventure Complete!
        </h1>
        <p className="text-gray-600">Alice discovered your spelling power!</p>
      </div>

      {/* Character celebration */}
      <div className="mb-8">
        <div className="relative">
          <PlayerSprite isRunning={false} />
          {/* Celebration sparkles */}
          <div className="absolute -top-2 -right-2 text-yellow-500 animate-bounce">
            <Star size={16} className="fill-current" />
          </div>
          <div className="absolute -top-4 left-0 text-yellow-500 animate-bounce" style={{ animationDelay: '0.2s' }}>
            <Star size={12} className="fill-current" />
          </div>
        </div>
      </div>

      {/* Grade result card */}
      <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 max-w-md w-full mb-6 shadow-lg`}>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-2">
            Your Spelling Level
          </p>
          <h2 className={`text-4xl font-bold ${colors.text} mb-2`}>
            {gradeInfo?.name || `Grade ${result.recommendedGrade}`}
          </h2>
          <p className="text-gray-600 text-sm">
            {gradeInfo?.ageRange || ''}
          </p>
        </div>

        {/* Grade description */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-gray-700 text-center text-sm">
            {gradeInfo?.description || 'Perfect words for your level!'}
          </p>
        </div>

        {/* Confidence indicator */}
        {result.confidence !== 'low' && (
          <div className="mt-4 flex justify-center">
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              result.confidence === 'high'
                ? 'bg-green-200 text-green-800'
                : 'bg-yellow-200 text-yellow-800'
            }`}>
              {result.confidence === 'high' ? (
                <>
                  <Star size={12} className="fill-current" />
                  High confidence match
                </>
              ) : (
                <>Good match</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="bg-white/80 backdrop-blur rounded-xl p-4 max-w-md w-full mb-8">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{totalAttempts}</div>
            <div className="text-xs text-gray-500">Words Tried</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{correctCount}</div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{accuracy}%</div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
        </div>
      </div>

      {/* What's next */}
      <div className="text-center mb-8 max-w-md">
        <p className="text-gray-600">
          We'll load <span className="font-semibold text-purple-600">{gradeInfo?.wordCount || 'lots of'}</span> words
          perfectly matched to your level. Ready to help Alice escape?
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onConfirm}
          className="group flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Let's Go!
          <ChevronRight className="group-hover:translate-x-1 transition-transform" size={24} />
        </button>

        <button
          onClick={onRecalibrate}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          <RotateCcw size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}
