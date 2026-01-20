import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, GraduationCap, AlertCircle } from 'lucide-react';
import { useChildren } from '@/hooks/useChildren';
import { useAuth } from '@/context/AuthContext';

const GRADE_OPTIONS = [
  { value: 3, label: 'Grade 3', description: 'Ages 8-9' },
  { value: 4, label: 'Grade 4', description: 'Ages 9-10' },
  { value: 5, label: 'Grade 5', description: 'Ages 10-11' },
  { value: 6, label: 'Grade 6', description: 'Ages 11-12' },
];

export function ChildSetupScreen() {
  const { addChild, isLoading, error } = useChildren();
  const { children } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<number>(4);
  const [formError, setFormError] = useState<string | null>(null);

  const isAddingAnother = children.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please enter your child's name");
      return;
    }

    const child = await addChild({
      name: name.trim(),
      gradeLevel,
    });

    if (child) {
      // Redirect to profile selection screen to pick the new/existing profile
      navigate('/profiles', { replace: true });
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
        <div className="text-center mb-8">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {(formError || error) && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle size={18} />
                <span className="text-sm">{formError || error}</span>
              </div>
            )}

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} />
                  Grade Level
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {GRADE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGradeLevel(option.value)}
                    disabled={isLoading}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      gradeLevel === option.value
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
