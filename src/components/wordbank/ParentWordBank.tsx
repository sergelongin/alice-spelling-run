import { useState, useMemo } from 'react';
import {
  Plus,
  GraduationCap,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { Button, Modal, WordDetailModal } from '../common';
import { WordManagementTable } from './WordManagementTable';
import { WordCatalogModal } from './WordCatalogModal';
import { AddWordsModal } from './AddWordsModal';
import { WordDistributionSummary } from './WordDistributionSummary';
import { useGameContext } from '@/context/GameContextDB';
import { Word } from '@/types';
import { GRADE_INFO, GradeLevel, WordDefinition } from '@/data/gradeWords';

interface ParentWordBankProps {
  /** When true, hides the "Word Bank Analytics" header (used when inside ChildWordBankScreen) */
  hideHeader?: boolean;
  /** Child's name for personalized messaging in modals */
  childName?: string;
}

/**
 * Parent Mode view of the Word Bank.
 * Data-rich analytics, word management, and actionable insights.
 */
export function ParentWordBank({ hideHeader = false, childName }: ParentWordBankProps) {
  const {
    wordBank,
    removeWord,
    archiveWord,
    unarchiveWord,
    forceIntroduceWord,
    importGradeWords,
    clearWordBank,
    addWordsFromCatalog,
    importCustomWords,
  } = useGameContext();

  // UI state
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showAddWordsModal, setShowAddWordsModal] = useState(false);
  const [importResult, setImportResult] = useState<{ grade: number; count: number } | null>(null);
  const [catalogImportResult, setCatalogImportResult] = useState<number | null>(null);
  const [customImportResult, setCustomImportResult] = useState<number | null>(null);

  // Set of existing word texts (lowercase) for duplicate checking
  const existingWordTexts = useMemo(() =>
    new Set(wordBank.words.map(w => w.text.toLowerCase())),
    [wordBank.words]
  );

  // Handlers
  const handleImportGrade = async (grade: GradeLevel) => {
    const count = await importGradeWords(grade);
    setImportResult({ grade, count });
    if (count > 0) {
      setTimeout(() => {
        setShowGradeModal(false);
        setImportResult(null);
      }, 1500);
    }
  };

  const handleAddFromCatalog = async (words: WordDefinition[]) => {
    const count = await addWordsFromCatalog(words);
    setCatalogImportResult(count);
    setTimeout(() => setCatalogImportResult(null), 3000);
  };

  const handleImportCustomWords = async (wordTexts: string[]) => {
    const count = await importCustomWords(wordTexts);
    setCustomImportResult(count);
    setTimeout(() => setCustomImportResult(null), 3000);
  };

  const handleExport = () => {
    // Export words as CSV
    const headers = ['Word', 'Status', 'Level', 'Accuracy', 'Attempts', 'Correct', 'Last Practiced'];
    const rows = wordBank.words.map(word => {
      const attempts = word.attemptHistory || [];
      const totalAttempts = attempts.length;
      const correctAttempts = attempts.filter(a => a.wasCorrect).length;
      const accuracy = totalAttempts > 0
        ? Math.round((correctAttempts / totalAttempts) * 100)
        : 0;
      const status = word.isActive === false ? 'Archived' :
        word.introducedAt === null ? 'Waiting' :
        word.masteryLevel === 5 ? 'Mastered' :
        word.masteryLevel <= 1 ? 'Learning' : 'Reviewing';

      return [
        word.text,
        status,
        word.masteryLevel,
        `${accuracy}%`,
        totalAttempts,
        correctAttempts,
        word.lastAttemptAt ? new Date(word.lastAttemptAt).toLocaleDateString() : 'Never',
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alice-spelling-words-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={hideHeader ? '' : 'flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full'}>
      {/* Header - only show if not hidden */}
      {!hideHeader && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Word Bank Management
          </h1>
        </div>
      )}

      {/* Main content */}
      <div className="space-y-6">
        {/* Add Words Section */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Add Words</h3>

          {/* Success messages */}
          {catalogImportResult !== null && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
              Added {catalogImportResult} word{catalogImportResult === 1 ? '' : 's'} from the catalog!
            </div>
          )}
          {customImportResult !== null && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
              Added {customImportResult} word{customImportResult === 1 ? '' : 's'}!
            </div>
          )}

          {/* Button row */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowAddWordsModal(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus size={18} />
              Add Words
            </Button>
            <Button
              onClick={() => setShowCatalogModal(true)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <BookOpen size={18} />
              Browse Catalog
            </Button>
            <Button
              onClick={() => setShowGradeModal(true)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <GraduationCap size={18} />
              Import Grade
            </Button>
            {wordBank.words.length > 0 && (
              <Button
                onClick={() => setShowClearModal(true)}
                variant="danger"
                className="flex items-center gap-2 ml-auto"
              >
                <Trash2 size={18} />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Word Distribution Summary */}
        <WordDistributionSummary words={wordBank.words} childName={childName} />

        {/* Word Management Table */}
        <WordManagementTable
          words={wordBank.words}
          onRemove={removeWord}
          onArchive={archiveWord}
          onUnarchive={unarchiveWord}
          onForceIntroduce={forceIntroduceWord}
          onExport={handleExport}
          onWordClick={setSelectedWord}
        />
      </div>

      {/* Add Words Modal */}
      <AddWordsModal
        isOpen={showAddWordsModal}
        onClose={() => setShowAddWordsModal(false)}
        existingWords={existingWordTexts}
        onImport={handleImportCustomWords}
        childName={childName}
      />

      {/* Clear confirmation modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Word Bank"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete all {wordBank.words.length} words? This
          action cannot be undone.
        </p>
        <div className="flex gap-4 justify-end">
          <Button variant="secondary" onClick={() => setShowClearModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              clearWordBank();
              setShowClearModal(false);
            }}
          >
            Delete All
          </Button>
        </div>
      </Modal>

      {/* Grade selection modal */}
      <Modal
        isOpen={showGradeModal}
        onClose={() => {
          setShowGradeModal(false);
          setImportResult(null);
        }}
        title="Import Words by Grade Level"
      >
        <p className="text-gray-600 mb-4">
          Choose a grade level to import curated spelling words. Words you already have will be skipped.
        </p>

        {importResult && (
          <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
            importResult.count > 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {importResult.count > 0
              ? `Added ${importResult.count} new words from Grade ${importResult.grade}!`
              : `You already have all Grade ${importResult.grade} words.`}
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {GRADE_INFO.map(info => (
            <button
              key={info.grade}
              onClick={() => handleImportGrade(info.grade)}
              className="w-full p-4 text-left border-2 border-gray-200 rounded-xl
                       hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-800 text-lg">{info.name}</div>
                  <div className="text-sm text-gray-500">{info.ageRange}</div>
                  <div className="text-sm text-gray-600 mt-1">{info.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{info.wordCount}</div>
                  <div className="text-xs text-gray-500">words</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Word detail modal */}
      <WordDetailModal
        word={selectedWord}
        isOpen={selectedWord !== null}
        onClose={() => setSelectedWord(null)}
        onForceIntroduce={forceIntroduceWord}
        onArchive={archiveWord}
        onUnarchive={unarchiveWord}
      />

      {/* Word catalog modal */}
      <WordCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        existingWords={existingWordTexts}
        onAddWords={handleAddFromCatalog}
      />
    </div>
  );
}
