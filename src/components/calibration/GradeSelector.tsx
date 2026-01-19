import { BookOpen, ChevronRight } from 'lucide-react';
import { GradeLevel, GRADE_INFO } from '@/data/gradeWords';

interface GradeSelectorProps {
  onSelect: (grade: GradeLevel) => void;
  onBack: () => void;
}

export function GradeSelector({ onSelect, onBack }: GradeSelectorProps) {
  const gradeColors: Record<GradeLevel, { bg: string; hover: string; border: string }> = {
    3: { bg: 'bg-green-50', hover: 'hover:bg-green-100', border: 'border-green-200' },
    4: { bg: 'bg-blue-50', hover: 'hover:bg-blue-100', border: 'border-blue-200' },
    5: { bg: 'bg-purple-50', hover: 'hover:bg-purple-100', border: 'border-purple-200' },
    6: { bg: 'bg-amber-50', hover: 'hover:bg-amber-100', border: 'border-amber-200' },
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <BookOpen className="mx-auto text-purple-500 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Choose Your Level
          </h1>
          <p className="text-gray-600">
            Select the grade level that matches your spelling skills
          </p>
        </div>

        {/* Grade options */}
        <div className="space-y-3 mb-8">
          {GRADE_INFO.map((info) => {
            const colors = gradeColors[info.grade];
            return (
              <button
                key={info.grade}
                onClick={() => onSelect(info.grade)}
                className={`w-full p-4 rounded-xl ${colors.bg} ${colors.hover} ${colors.border} border-2 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-800">
                      {info.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {info.ageRange} • {info.wordCount} words
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {info.description}
                    </div>
                  </div>
                  <ChevronRight
                    className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all"
                    size={20}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Back button */}
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 text-sm underline underline-offset-2 transition-colors"
          >
            ← Back to calibration
          </button>
        </div>
      </div>
    </div>
  );
}
