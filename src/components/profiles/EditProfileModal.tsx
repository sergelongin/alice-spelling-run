import { useState, type FormEvent } from 'react';
import { X, User, GraduationCap, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ChildProfile } from '@/types/auth';

interface EditProfileModalProps {
  child: ChildProfile;
  onClose: () => void;
  onSaved: () => void;
}

const GRADE_OPTIONS = [
  { value: 3, label: 'Grade 3', description: 'Ages 8-9' },
  { value: 4, label: 'Grade 4', description: 'Ages 9-10' },
  { value: 5, label: 'Grade 5', description: 'Ages 10-11' },
  { value: 6, label: 'Grade 6', description: 'Ages 11-12' },
];

export function EditProfileModal({ child, onClose, onSaved }: EditProfileModalProps) {
  const { updateChild } = useAuth();
  const [name, setName] = useState(child.name);
  const [gradeLevel, setGradeLevel] = useState(child.grade_level);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      grade_level: gradeLevel,
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
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
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                  }`}
                >
                  <div className="font-medium text-white">{option.label}</div>
                  <div className="text-xs text-gray-400">{option.description}</div>
                </button>
              ))}
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
