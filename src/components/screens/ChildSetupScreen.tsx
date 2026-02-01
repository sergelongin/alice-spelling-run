import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sparkles, AlertCircle, Calendar } from 'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import { useAuth } from '@/context/AuthContext';
import { GradeLevel } from '@/data/gradeWords';
import { useWordCatalog } from '@/hooks/useWordCatalog';

const GRADE_OPTIONS = [
  { value: 3 as const, label: 'Grade 3', description: 'Ages 8-9' },
  { value: 4 as const, label: 'Grade 4', description: 'Ages 9-10' },
  { value: 5 as const, label: 'Grade 5', description: 'Ages 10-11' },
  { value: 6 as const, label: 'Grade 6', description: 'Ages 11-12' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// Generate years from 2010 to current year
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2010 + 1 }, (_, i) => 2010 + i).reverse();

type SelectionMode = 'detect' | GradeLevel | null;

function GradeExampleWords({ grade }: { grade: GradeLevel }) {
  const { getWordsForGrade } = useWordCatalog();
  const examples = getWordsForGrade(grade).slice(0, 5).map(w => w.word);
  return (
    <div className="mt-2 text-sm text-gray-500">
      Examples: {examples.length > 0 ? examples.join(', ') : 'Loading...'}
    </div>
  );
}

function calculateAge(birthMonth: number | undefined, birthYear: number | undefined): string | null {
  if (!birthMonth || !birthYear) return null;

  const now = new Date();
  const birth = new Date(birthYear, birthMonth - 1, 1);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0) {
    age--;
  }

  if (age < 1) return null;
  return `${age} yrs`;
}

export function ChildSetupScreen() {
  const { addChild, isLoading, error } = useChildren();
  const { children, selectProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [birthMonth, setBirthMonth] = useState<number | undefined>();
  const [birthYear, setBirthYear] = useState<number | undefined>();
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isAddingAnother = children.length > 0;
  const calculatedAge = calculateAge(birthMonth, birthYear);
  const isValidSelection = selectionMode !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please enter your child's name");
      return;
    }

    if (!selectionMode) {
      setFormError("Please select a spelling level option");
      return;
    }

    if (selectionMode === 'detect') {
      // Create child with default grade 4 (calibration will determine actual level)
      const child = await addChild({
        name: name.trim(),
        gradeLevel: 4,
        birthMonth,
        birthYear,
      });

      if (child) {
        // Select this child's profile and navigate to calibration
        selectProfile(child.id);
        navigate('/calibration', { replace: true });
      }
    } else {
      // Manual grade selection - create child with pending import flag
      const child = await addChild({
        name: name.trim(),
        gradeLevel: selectionMode,
        birthMonth,
        birthYear,
        pendingGradeImport: selectionMode,
      });

      if (child) {
        // Navigate to profile selection (words will import when child is selected)
        navigate('/profiles', { replace: true });
      }
    }
  };

  const handleSkip = () => {
    // Only allow skip if they already have at least one child
    if (isAddingAnother) {
      navigate('/profiles', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <User className="text-green-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isAddingAnother ? 'Add Another Child' : "Let's Get Started"}
          </h1>
          <p className="text-gray-600">
            {isAddingAnother
              ? 'Add another child to your account'
              : "Tell us about your child so we can personalize their experience"}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(formError || error) && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle size={18} />
                <span className="text-sm">{formError || error}</span>
              </div>
            )}

            {/* Child's Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Child's Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  placeholder="Enter their name"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Birth Date (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  Birth Date
                  <span className="text-gray-400 font-normal">(optional)</span>
                </div>
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={birthMonth ?? ''}
                  onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-white"
                  disabled={isLoading}
                >
                  <option value="">Month</option>
                  {MONTHS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <select
                  value={birthYear ?? ''}
                  onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-white"
                  disabled={isLoading}
                >
                  <option value="">Year</option>
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {calculatedAge && (
                  <span className="text-sm text-gray-500 whitespace-nowrap">
                    {calculatedAge}
                  </span>
                )}
              </div>
            </div>

            {/* Spelling Level Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spelling Level
              </label>

              {/* Detect Spelling Level - Recommended */}
              <button
                type="button"
                onClick={() => setSelectionMode('detect')}
                disabled={isLoading}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all mb-3 ${
                  selectionMode === 'detect'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${selectionMode === 'detect' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Sparkles className={selectionMode === 'detect' ? 'text-green-600' : 'text-gray-500'} size={20} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      Detect Spelling Level
                      <span className="ml-2 text-xs font-normal px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      Quick assessment finds the right starting level
                    </div>
                  </div>
                </div>
              </button>

              {/* Manual Grade Selection */}
              <div className="text-sm text-gray-500 mb-2">Or choose a grade:</div>
              <div className="grid grid-cols-2 gap-2">
                {GRADE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectionMode(option.value)}
                    disabled={isLoading}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectionMode === option.value
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </button>
                ))}
              </div>

              {/* Example words for selected grade */}
              {typeof selectionMode === 'number' && (
                <GradeExampleWords grade={selectionMode} />
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValidSelection}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Setting up...
                </>
              ) : (
                "Let's Go!"
              )}
            </button>

            {isAddingAnother && (
              <button
                type="button"
                onClick={handleSkip}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
