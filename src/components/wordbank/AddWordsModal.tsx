import { useState, useMemo, useCallback } from 'react';
import { AlertCircle, Check, Loader2, Sparkles, SkipForward, ChevronRight } from 'lucide-react';
import { Button, Modal } from '@/components/common';
import { useAuth } from '@/context/AuthContext';
import { generateWordDefinition, isAIAvailable } from '@/services/aiProvider';
import {
  insertCustomWord,
  CustomWordInput,
  CustomWord,
  GradeLevel,
  wordExistsInCatalog,
} from '@/data/gradeWords';

type WizardStep = 'bulk-entry' | 'word-wizard' | 'completion';

interface WordWizardData {
  word: string;
  definition: string;
  example: string;
  gradeLevel: GradeLevel;
  isValid: boolean;
  isGenerating: boolean;
  aiGenerated: boolean;
}

interface AddWordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWords: Set<string>;
  onImport: (wordTexts: string[]) => void;
  childName?: string;
}

/**
 * Modal for adding multiple words via textarea input with AI-powered wizard.
 * Step 1: Bulk entry with comma/newline separated words
 * Step 2: Per-word wizard with AI validation and definition generation
 * Step 3: Completion summary with option to add to child's word bank
 */
export function AddWordsModal({
  isOpen,
  onClose,
  existingWords,
  onImport,
  childName,
}: AddWordsModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>('bulk-entry');
  const [textValue, setTextValue] = useState('');

  // Wizard state
  const [wordsToProcess, setWordsToProcess] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wizardData, setWizardData] = useState<WordWizardData | null>(null);
  const [addedWords, setAddedWords] = useState<CustomWord[]>([]);
  const [skippedWords, setSkippedWords] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Parse text into words with validation
  const parsedResult = useMemo(() => {
    if (!textValue.trim()) {
      return { words: [], duplicates: 0, invalid: 0 };
    }

    // Split by commas or newlines
    const rawWords = textValue
      .split(/[,\n]/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);

    // Deduplicate within the input
    const uniqueWords = [...new Set(rawWords)];

    // Validate words (letters only, 2+ chars)
    const validWords: string[] = [];
    let invalidCount = 0;
    for (const word of uniqueWords) {
      if (/^[a-z]+$/.test(word) && word.length >= 2) {
        validWords.push(word);
      } else {
        invalidCount++;
      }
    }

    // Check for duplicates in existing bank
    const newWords = validWords.filter(w => !existingWords.has(w));
    const duplicateCount = validWords.length - newWords.length;

    return {
      words: newWords,
      duplicates: duplicateCount,
      invalid: invalidCount,
    };
  }, [textValue, existingWords]);

  // Initialize wizard for a word
  const initializeWordWizard = useCallback(async (word: string) => {
    setWizardData({
      word,
      definition: '',
      example: '',
      gradeLevel: 4,
      isValid: false,
      isGenerating: true,
      aiGenerated: false,
    });

    // Check if word exists in catalog
    const exists = await wordExistsInCatalog(word);
    if (exists) {
      setWizardData(prev => prev ? {
        ...prev,
        isGenerating: false,
        isValid: false,
      } : null);
      return;
    }

    // Generate definition with AI if available
    if (isAIAvailable()) {
      try {
        const result = await generateWordDefinition(word);
        if (result) {
          setWizardData(prev => prev ? {
            ...prev,
            definition: result.definition,
            example: result.sentence,
            gradeLevel: result.gradeLevel,
            isValid: true,
            isGenerating: false,
            aiGenerated: true,
          } : null);
          return;
        }
      } catch (error) {
        console.error('AI generation failed:', error);
      }
    }

    // Fallback: mark as valid but without AI content
    setWizardData(prev => prev ? {
      ...prev,
      isValid: true,
      isGenerating: false,
      aiGenerated: false,
    } : null);
  }, []);

  // Start the wizard
  const handleStartWizard = useCallback(() => {
    if (parsedResult.words.length === 0) return;

    setWordsToProcess(parsedResult.words);
    setCurrentIndex(0);
    setAddedWords([]);
    setSkippedWords([]);
    setStep('word-wizard');
    initializeWordWizard(parsedResult.words[0]);
  }, [parsedResult.words, initializeWordWizard]);

  // Save current word and move to next
  const handleSaveAndNext = useCallback(async () => {
    if (!wizardData || !user) return;

    setIsSaving(true);

    const input: CustomWordInput = {
      word: wizardData.word,
      definition: wizardData.definition,
      example: wizardData.example || undefined,
      gradeLevel: wizardData.gradeLevel,
    };

    const { word: savedWord, error } = await insertCustomWord(input, user.id);

    setIsSaving(false);

    if (error) {
      console.error('Failed to save word:', error);
      // Still move to next even on error
    } else if (savedWord) {
      setAddedWords(prev => [...prev, savedWord]);
    }

    // Move to next word or completion
    const nextIndex = currentIndex + 1;
    if (nextIndex < wordsToProcess.length) {
      setCurrentIndex(nextIndex);
      initializeWordWizard(wordsToProcess[nextIndex]);
    } else {
      setStep('completion');
    }
  }, [wizardData, user, currentIndex, wordsToProcess, initializeWordWizard]);

  // Skip current word
  const handleSkip = useCallback(() => {
    if (!wizardData) return;

    setSkippedWords(prev => [...prev, wizardData.word]);

    const nextIndex = currentIndex + 1;
    if (nextIndex < wordsToProcess.length) {
      setCurrentIndex(nextIndex);
      initializeWordWizard(wordsToProcess[nextIndex]);
    } else {
      setStep('completion');
    }
  }, [wizardData, currentIndex, wordsToProcess, initializeWordWizard]);

  // Add to word bank and close
  const handleAddToWordBank = useCallback(() => {
    if (addedWords.length > 0) {
      onImport(addedWords.map(w => w.word));
    }
    handleReset();
    onClose();
  }, [addedWords, onImport, onClose]);

  // Reset all state
  const handleReset = useCallback(() => {
    setStep('bulk-entry');
    setTextValue('');
    setWordsToProcess([]);
    setCurrentIndex(0);
    setWizardData(null);
    setAddedWords([]);
    setSkippedWords([]);
    setIsSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const hasContent = textValue.trim().length > 0;
  const hasNewWords = parsedResult.words.length > 0;

  // Render based on current step
  const renderContent = () => {
    switch (step) {
      case 'bulk-entry':
        return (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Enter words separated by commas or new lines:
            </p>

            <textarea
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              placeholder="adventure, beautiful, curious&#10;delicious&#10;enormous"
              className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg resize-none
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none
                       text-sm font-mono"
              autoFocus
            />

            {/* Preview tags */}
            {hasNewWords && parsedResult.words.length <= 30 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                <div className="flex flex-wrap gap-2">
                  {parsedResult.words.map(word => (
                    <span
                      key={word}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Validation feedback */}
            {hasContent && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {hasNewWords ? (
                  <span className="text-green-700 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                    <Check size={14} />
                    {parsedResult.words.length} new {parsedResult.words.length === 1 ? 'word' : 'words'}
                  </span>
                ) : (
                  <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                    <AlertCircle size={14} />
                    No new words to add
                  </span>
                )}
                {parsedResult.duplicates > 0 && (
                  <span className="text-gray-500">
                    {parsedResult.duplicates} already in bank
                  </span>
                )}
                {parsedResult.invalid > 0 && (
                  <span className="text-amber-600">
                    {parsedResult.invalid} invalid
                  </span>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={handleStartWizard}
                disabled={!hasNewWords}
                className="flex items-center gap-2"
              >
                Add {hasNewWords ? parsedResult.words.length : ''} {parsedResult.words.length === 1 ? 'Word' : 'Words'}
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        );

      case 'word-wizard': {
        if (!wizardData) return null;

        const progress = ((currentIndex + 1) / wordsToProcess.length) * 100;
        const canSave = wizardData.isValid && wizardData.definition.trim().length > 0;

        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800">
                Word {currentIndex + 1} of {wordsToProcess.length}:{' '}
                <span className="text-blue-600 capitalize">{wizardData.word}</span>
              </h3>
              {wizardData.isGenerating ? (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Generating...
                </span>
              ) : wizardData.isValid ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check size={14} />
                  Valid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertCircle size={14} />
                  Already exists
                </span>
              )}
            </div>

            {/* Definition field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Definition
              </label>
              <textarea
                value={wizardData.definition}
                onChange={e => setWizardData(prev => prev ? { ...prev, definition: e.target.value } : null)}
                placeholder="Enter a child-friendly definition..."
                disabled={wizardData.isGenerating}
                className="w-full h-24 px-3 py-2 border border-gray-200 rounded-lg resize-none
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none
                         text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
              {wizardData.aiGenerated && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-purple-500" />
                  AI-generated (editable)
                </p>
              )}
            </div>

            {/* Example sentence field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Example sentence
              </label>
              <textarea
                value={wizardData.example}
                onChange={e => setWizardData(prev => prev ? { ...prev, example: e.target.value } : null)}
                placeholder="Enter an example sentence using this word..."
                disabled={wizardData.isGenerating}
                className="w-full h-20 px-3 py-2 border border-gray-200 rounded-lg resize-none
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none
                         text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
              {wizardData.aiGenerated && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-purple-500" />
                  AI-generated (editable)
                </p>
              )}
            </div>

            {/* Grade level selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade level
              </label>
              <select
                value={wizardData.gradeLevel}
                onChange={e => setWizardData(prev => prev ? { ...prev, gradeLevel: Number(e.target.value) as GradeLevel } : null)}
                disabled={wizardData.isGenerating}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none
                         text-sm disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value={3}>Grade 3 (8-9 years)</option>
                <option value={4}>Grade 4 (9-10 years)</option>
                <option value={5}>Grade 5 (10-11 years)</option>
                <option value={6}>Grade 6 (11-12 years)</option>
              </select>
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{currentIndex + 1}/{wordsToProcess.length}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between pt-2">
              <Button
                variant="secondary"
                onClick={handleSkip}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <SkipForward size={16} />
                Skip
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveAndNext}
                disabled={!canSave || isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save & Next
                    <ChevronRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      }

      case 'completion':
        return (
          <div className="space-y-4">
            {/* Success message */}
            {addedWords.length > 0 ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {addedWords.length} {addedWords.length === 1 ? 'Word' : 'Words'} Added!
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Added to the word catalog
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <AlertCircle size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  No Words Added
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  All words were skipped
                </p>
              </div>
            )}

            {/* Added words preview */}
            {addedWords.length > 0 && addedWords.length <= 20 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {addedWords.map(word => (
                  <span
                    key={word.id}
                    className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm"
                  >
                    {word.word}
                  </span>
                ))}
              </div>
            )}

            {/* Skipped words info */}
            {skippedWords.length > 0 && (
              <p className="text-sm text-gray-500 text-center">
                {skippedWords.length} {skippedWords.length === 1 ? 'word' : 'words'} skipped
              </p>
            )}

            {/* Add to word bank prompt */}
            {addedWords.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600 text-center mb-4">
                  Add to {childName ? `${childName}'s` : 'the'} word bank now?
                </p>
                <div className="flex justify-center gap-3">
                  <Button variant="secondary" onClick={handleClose}>
                    Not Now
                  </Button>
                  <Button variant="primary" onClick={handleAddToWordBank}>
                    Add to Word Bank
                  </Button>
                </div>
              </div>
            )}

            {/* Close button if no words added */}
            {addedWords.length === 0 && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" onClick={handleClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        );
    }
  };

  // Dynamic title based on step
  const getTitle = () => {
    switch (step) {
      case 'bulk-entry':
        return 'Add Words';
      case 'word-wizard':
        return 'Define Word';
      case 'completion':
        return 'Words Added!';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getTitle()}
      maxWidth="max-w-lg"
    >
      {renderContent()}
    </Modal>
  );
}
