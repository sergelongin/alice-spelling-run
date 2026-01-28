import { useState, useEffect, type FormEvent } from 'react';
import { X, User, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ChildProfile } from '@/types/auth';

interface EditProfileModalProps {
  child: ChildProfile;
  onClose: () => void;
  onSaved: () => void;
}

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

function calculateAge(birthMonth: number | null | undefined, birthYear: number | null | undefined): string | null {
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

export function EditProfileModal({ child, onClose, onSaved }: EditProfileModalProps) {
  const { updateChild } = useAuth();
  const [name, setName] = useState(child.name);
  const [birthMonth, setBirthMonth] = useState<number | null>(child.birth_month);
  const [birthYear, setBirthYear] = useState<number | null>(child.birth_year);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedAge = calculateAge(birthMonth, birthYear);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setIsLoading(true);

    const result = await updateChild(child.id, {
      name: name.trim(),
      birth_month: birthMonth,
      birth_year: birthYear,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gray-800 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter name"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Birth Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                Birth Date
                <span className="text-gray-500 font-normal">(optional)</span>
              </div>
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={birthMonth ?? ''}
                onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {calculatedAge}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
