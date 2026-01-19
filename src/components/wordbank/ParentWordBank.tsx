import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Plus,
  Download,
  GraduationCap,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button, Modal, WordDetailModal } from '../common';
import { QuickStatsDashboard } from './QuickStatsDashboard';
import { AttentionNeededAlert } from './AttentionNeededAlert';
import { LearningActivityChart } from './LearningActivityChart';
import { StrugglingWordsPanel, getStrugglingWords } from './StrugglingWordsPanel';
import { ErrorPatternAnalysis, getActivePatternCount } from './ErrorPatternAnalysis';
import { WordManagementTable } from './WordManagementTable';
import { RecommendationsPanel } from './RecommendationsPanel';
import { useGameContext } from '@/context/GameContext';
import { Word } from '@/types';
import { validateWord, categorizeWordsByState } from '@/utils/wordSelection';
import { calculatePracticeStreak, getRecentlyMasteredWords } from '@/types/achievements';
import { GRADE_INFO, GradeLevel } from '@/data/gradeWords';

interface ParentWordBankProps {
  onSwitchToChildMode: () => void;
}

/**
 * Parent Mode view of the Word Bank.
 * Data-rich analytics, word management, and actionable insights.
 */
export function ParentWordBank({ onSwitchToChildMode }: ParentWordBankProps) {
  const navigate = useNavigate();
  const {
    wordBank,
    statistics,
    addWord,
    removeWord,
    archiveWord,
    unarchiveWord,
    forceIntroduceWord,
    importGradeWords,
    importDefaultWords,
    clearWordBank,
  } = useGameContext();

  // UI state
  const [newWord, setNewWord] = useState('');
  const [wordError, setWordError] = useState('');
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [importResult, setImportResult] = useState<{ grade: number; count: number } | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<'struggling' | 'patterns' | null>('patterns');

  // Calculated stats
  const activeWords = useMemo(() =>
    wordBank.words.filter(w => w.isActive !== false),
    [wordBank.words]
  );

  const wordStates = useMemo(() =>
    categorizeWordsByState(activeWords),
    [activeWords]
  );

  const strugglingWords = useMemo(() =>
    getStrugglingWords(wordBank.words),
    [wordBank.words]
  );

  const errorPatternCount = useMemo(() =>
    getActivePatternCount(statistics.errorPatterns),
    [statistics.errorPatterns]
  );

  const overallAccuracy = useMemo(() => {
    let total = 0;
    let correct = 0;
    for (const word of wordBank.words) {
      total += word.timesUsed;
      correct += word.timesCorrect;
    }
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [wordBank.words]);

  const streak = useMemo(() =>
    calculatePracticeStreak(wordBank.words),
    [wordBank.words]
  );

  const recentlyMastered = useMemo(() =>
    getRecentlyMasteredWords(wordBank.words, 10),
    [wordBank.words]
  );

  // Handlers
  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    setWordError('');

    const validation = validateWord(newWord);
    if (!validation.valid) {
      setWordError(validation.error || 'Invalid word');
      return;
    }

    const success = addWord(newWord);
    if (!success) {
      setWordError('This word already exists in your word bank');
      return;
    }

    setNewWord('');
  };

  const handleImportGrade = (grade: GradeLevel) => {
    const count = importGradeWords(grade);
    setImportResult({ grade, count });
    if (count > 0) {
      setTimeout(() => {
        setShowGradeModal(false);
        setImportResult(null);
      }, 1500);
    }
  };

  const handleExport = () => {
    // Export words as CSV
    const headers = ['Word', 'Status', 'Level', 'Accuracy', 'Attempts', 'Correct', 'Last Practiced'];
    const rows = wordBank.words.map(word => {
      const accuracy = word.timesUsed > 0
        ? Math.round((word.timesCorrect / word.timesUsed) * 100)
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
        word.timesUsed,
        word.timesCorrect,
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

  const scrollToPanel = (panel: 'struggling' | 'patterns') => {
    setExpandedPanel(panel);
    // Allow time for expand animation, then scroll
    setTimeout(() => {
      document.getElementById(`panel-${panel}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Word Bank Analytics
          </h1>
        </div>

        {/* Child Mode toggle */}
        <button
          onClick={onSwitchToChildMode}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200
                   text-indigo-700 hover:text-indigo-800 transition-colors text-sm font-medium"
        >
          <User size={18} />
          <span className="hidden sm:inline">Child Mode</span>
        </button>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        {/* Quick Stats + Attention Alert */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <QuickStatsDashboard
              totalWords={activeWords.length}
              masteredWords={wordStates.mastered.length}
              accuracy={overallAccuracy}
              streak={streak}
            />
          </div>
          <div className="lg:col-span-1">
            <AttentionNeededAlert
              strugglingWordCount={strugglingWords.length}
              errorPatternCount={errorPatternCount}
              onViewDetails={() => scrollToPanel('struggling')}
            />
          </div>
        </div>

        {/* Learning Activity Chart */}
        <LearningActivityChart words={wordBank.words} />

        {/* Struggling Words Panel */}
        <div id="panel-struggling">
          <StrugglingWordsPanel
            words={strugglingWords}
            isExpanded={expandedPanel === 'struggling'}
            onToggleExpand={() => setExpandedPanel(expandedPanel === 'struggling' ? null : 'struggling')}
            onForcePractice={forceIntroduceWord}
            onArchive={archiveWord}
          />
        </div>

        {/* Error Pattern Analysis */}
        <div id="panel-patterns">
          <ErrorPatternAnalysis
            patterns={statistics.errorPatterns}
            isExpanded={expandedPanel === 'patterns'}
            onToggleExpand={() => setExpandedPanel(expandedPanel === 'patterns' ? null : 'patterns')}
          />
        </div>

        {/* Recommendations */}
        <RecommendationsPanel
          words={wordBank.words}
          errorPatterns={statistics.errorPatterns}
          recentMasteredCount={recentlyMastered.length}
        />

        {/* Add Word Form + Import Actions */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Add Words</h3>

          <form onSubmit={handleAddWord} className="flex gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={newWord}
                onChange={e => {
                  setNewWord(e.target.value);
                  setWordError('');
                }}
                placeholder="Type a new word to add..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
              />
              {wordError && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {wordError}
                </p>
              )}
            </div>
            <Button type="submit" variant="primary" className="flex items-center gap-2">
              <Plus size={18} />
              Add
            </Button>
          </form>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowGradeModal(true)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <GraduationCap size={18} />
              Import by Grade
            </Button>
            <Button
              onClick={importDefaultWords}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Download size={18} />
              Import Starter Words
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
    </div>
  );
}
