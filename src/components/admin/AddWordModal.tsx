/**
 * Modal for adding a new word to the word bank (2-step wizard)
 * Step 1: Enter word and validate as dictionary word
 * Step 2: Review AI-generated definition/example and confirm
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, Check, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { addWord, checkDuplicate } from '@/services/wordBankService';
import { generateWordDefinition, isAIAvailable } from '@/services/aiProvider';
import type { GradeLevel } from '@/data/gradeWords';

type WizardStep = 'entry' | 'review';

export interface AddedWordData {
  word: string;
  definition: string;
  example?: string;
  gradeLevel: GradeLevel;
}

interface AddWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWordAdded: (wordData: AddedWordData) => void;
  defaultGrade?: GradeLevel;
}

export function AddWordModal({ isOpen, onClose, onWordAdded, defaultGrade = 4 }: AddWordModalProps) {
  // Wizard step state
  const [step, setStep] = useState<WizardStep>('entry');

  // Form state
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(defaultGrade);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Word validation state
  const [isValidatingWord, setIsValidatingWord] = useState(false);
  const [isValidWord, setIsValidWord] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('entry');
      setWord('');
      setDefinition('');
      setExample('');
      setGradeLevel(defaultGrade);
      setError(null);
      setIsDuplicate(false);
      setIsValidWord(false);
      setIsValidatingWord(false);
      setValidationError(null);
    }
  }, [isOpen, defaultGrade]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Check for duplicates when word changes
  const checkForDuplicate = useCallback(async (wordValue: string) => {
    if (!wordValue.trim()) {
      setIsDuplicate(false);
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      const exists = await checkDuplicate(wordValue);
      setIsDuplicate(exists);
      if (exists) {
        setError(`Word "${wordValue}" already exists`);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('[AddWordModal] Error checking duplicate:', err);
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []);

  // Debounced duplicate check
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForDuplicate(word);
    }, 300);

    return () => clearTimeout(timer);
  }, [word, checkForDuplicate]);

  // Auto-validate word after duplicate check passes
  useEffect(() => {
    const validateWord = async () => {
      // Skip if word is empty, is a duplicate, or still checking for duplicate
      if (!word.trim() || isDuplicate || isCheckingDuplicate) {
        setIsValidWord(false);
        setValidationError(null);
        return;
      }

      // Skip validation if AI is not available
      if (!isAIAvailable()) {
        setValidationError('Word validation requires AI. Please configure an API key.');
        setIsValidWord(false);
        return;
      }

      setIsValidatingWord(true);
      setValidationError(null);

      try {
        const result = await generateWordDefinition(word.trim());
        if (result) {
          setIsValidWord(true);
          setValidationError(null);
          // Auto-populate fields for review step
          setDefinition(result.definition);
          setExample(result.sentence);
          setGradeLevel(result.gradeLevel);
        } else {
          setIsValidWord(false);
          setValidationError(`"${word}" is not recognized as a valid English word`);
        }
      } catch (err) {
        console.error('[AddWordModal] Error validating word:', err);
        setValidationError('Validation failed. Please try again.');
        setIsValidWord(false);
      } finally {
        setIsValidatingWord(false);
      }
    };

    // Debounce validation to avoid rapid API calls
    const timer = setTimeout(validateWord, 500);
    return () => clearTimeout(timer);
  }, [word, isDuplicate, isCheckingDuplicate]);

  const handleNext = () => {
    if (isValidWord && !isDuplicate && !isValidatingWord) {
      setStep('review');
    }
  };

  const handleBack = () => {
    setStep('entry');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!word.trim() || !definition.trim()) {
      setError('Word and definition are required');
      return;
    }

    if (isDuplicate) {
      setError(`Word "${word}" already exists`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await addWord({
        word: word.trim(),
        definition: definition.trim(),
        example: example.trim() || undefined,
        gradeLevel,
      });

      if (!result.success) {
        setError(result.error || 'Failed to add word');
        return;
      }

      // Pass the word data to parent for audio preview
      onWordAdded({
        word: word.trim(),
        definition: definition.trim(),
        example: example.trim() || undefined,
        gradeLevel,
      });
      onClose();
    } catch (err) {
      console.error('[AddWordModal] Error adding word:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canProceedToReview = isValidWord && !isDuplicate && !isValidatingWord && !isCheckingDuplicate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Word</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === 'entry'
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-600 text-white'
                }`}
              >
                {step === 'review' ? <Check size={16} /> : '1'}
              </div>
              <span className={`text-sm font-medium ${step === 'entry' ? 'text-blue-600' : 'text-green-600'}`}>
                Enter Word
              </span>
            </div>
            <div className="w-12 h-0.5 bg-gray-200">
              <div
                className={`h-full transition-all duration-300 ${
                  step === 'review' ? 'w-full bg-blue-600' : 'w-0'
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === 'review'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                2
              </div>
              <span className={`text-sm font-medium ${step === 'review' ? 'text-blue-600' : 'text-gray-500'}`}>
                Review
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI required warning */}
          {!isAIAvailable() && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <strong>AI Required:</strong> Word validation requires an AI provider to be configured.
              Please add an API key in your environment settings.
            </div>
          )}

          {/* Step 1: Word Entry */}
          {step === 'entry' && (
            <>
              <div>
                <label htmlFor="word" className="block text-sm font-medium text-gray-700 mb-1">
                  Word <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="word"
                    value={word}
                    onChange={(e) => {
                      setWord(e.target.value);
                      setIsValidWord(false);
                    }}
                    disabled={!isAIAvailable()}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isDuplicate || validationError ? 'border-red-300 bg-red-50' :
                      isValidWord ? 'border-green-300 bg-green-50' : 'border-gray-300'
                    } ${!isAIAvailable() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="Enter the word"
                    autoFocus
                  />
                  {/* Status indicator */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {(isCheckingDuplicate || isValidatingWord) && (
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    )}
                    {!isCheckingDuplicate && !isValidatingWord && word && isValidWord && !isDuplicate && (
                      <Check size={16} className="text-green-500" />
                    )}
                    {!isCheckingDuplicate && !isValidatingWord && word && (isDuplicate || validationError) && (
                      <AlertCircle size={16} className="text-red-500" />
                    )}
                  </div>
                </div>
                {/* Status messages */}
                {isDuplicate && (
                  <p className="mt-1 text-sm text-red-600">This word already exists in the word bank</p>
                )}
                {validationError && !isDuplicate && (
                  <p className="mt-1 text-sm text-red-600">{validationError}</p>
                )}
                {isValidatingWord && (
                  <p className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                    <Sparkles size={12} className="text-purple-500" />
                    Validating word...
                  </p>
                )}
                {isValidWord && !isValidatingWord && (
                  <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                    <Check size={12} />
                    Valid word - definition found
                  </p>
                )}
              </div>

              {/* Actions for Step 1 */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceedToReview}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <>
              {/* Word display (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Word
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium">
                  {word}
                </div>
              </div>

              {/* Definition input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="definition" className="block text-sm font-medium text-gray-700">
                    Definition <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-purple-600 flex items-center gap-1">
                    <Sparkles size={12} />
                    AI-generated
                  </span>
                </div>
                <textarea
                  id="definition"
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter the definition"
                />
              </div>

              {/* Example sentence input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="example" className="block text-sm font-medium text-gray-700">
                    Example Sentence
                  </label>
                  {example && (
                    <span className="text-xs text-purple-600 flex items-center gap-1">
                      <Sparkles size={12} />
                      AI-generated
                    </span>
                  )}
                </div>
                <textarea
                  id="example"
                  value={example}
                  onChange={(e) => setExample(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter an example sentence (optional)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The example sentence will be used for audio pronunciation
                </p>
              </div>

              {/* Grade level select */}
              <div>
                <label htmlFor="gradeLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Grade Level
                </label>
                <select
                  id="gradeLevel"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(parseInt(e.target.value) as GradeLevel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={3}>Grade 3 (ages 8-9)</option>
                  <option value={4}>Grade 4 (ages 9-10)</option>
                  <option value={5}>Grade 5 (ages 10-11)</option>
                  <option value={6}>Grade 6 (ages 11-12)</option>
                </select>
              </div>

              {/* Actions for Step 2 */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !word.trim() || !definition.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Word'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
