import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Edit2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboardAccess } from '@/hooks';
import { PinModal } from '@/components/wordbank';
import { Button } from '@/components/common';
import { ProfileAvatar } from '@/components/profiles';
import { ChildSwitcher } from '@/components/parent/ChildSwitcher';
import {
  QuickStatsDashboard,
  LearningActivityChart,
  StrugglingWordsPanel,
  ErrorPatternAnalysis,
  RecommendationsPanel,
  getStrugglingWords,
} from '@/components/wordbank';
import {
  getChildWordBank,
  getChildStatistics,
  calculateAccuracy,
  countActiveWords,
  countMasteredWords,
  calculateStreak,
} from '@/utils/childDataReader';
import { categorizeWordsByState } from '@/utils/wordSelection';

/**
 * Child Detail Screen - Detailed view of a single child's progress
 *
 * Features:
 * - Child switcher tabs at top
 * - Comprehensive analytics
 * - Word bank management
 * - Error pattern analysis
 * - Export functionality
 */
export function ChildDetailScreen() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { children, isParent, hasChildren } = useAuth();
  const {
    isAuthorized,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    requestAccess,
    verifyPin,
    createPin,
    closePinModal,
  } = useParentDashboardAccess();

  const [expandedPanel, setExpandedPanel] = useState<'struggling' | 'patterns' | null>('patterns');

  // Find the current child
  const currentChild = useMemo(
    () => children.find(c => c.id === childId),
    [children, childId]
  );

  // Load child data
  const wordBank = useMemo(
    () => childId ? getChildWordBank(childId) : { words: [], lastUpdated: '', lastNewWordDate: null, newWordsIntroducedToday: 0 },
    [childId]
  );

  const statistics = useMemo(
    () => childId ? getChildStatistics(childId) : null,
    [childId]
  );

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

  const overallAccuracy = useMemo(() =>
    calculateAccuracy(wordBank),
    [wordBank]
  );

  const streak = useMemo(() =>
    calculateStreak(wordBank),
    [wordBank]
  );

  const masteredCount = useMemo(() =>
    countMasteredWords(wordBank),
    [wordBank]
  );

  const totalWords = useMemo(() =>
    countActiveWords(wordBank),
    [wordBank]
  );

  // Request PIN on mount if not authorized
  useEffect(() => {
    if (!isAuthorized) {
      requestAccess();
    }
  }, [isAuthorized, requestAccess]);

  // Handle PIN submission
  const handlePinSubmit = (pin: string) => {
    if (isCreatingPin) {
      createPin(pin);
    } else {
      verifyPin(pin);
    }
  };

  // Handle PIN modal close - navigate back if not authorized
  const handlePinClose = () => {
    closePinModal();
    if (!isAuthorized) {
      navigate('/parent-dashboard');
    }
  };

  // Handle export
  const handleExport = () => {
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
    a.download = `${currentChild?.name || 'child'}-spelling-words-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show PIN modal if not authorized
  if (!isAuthorized) {
    return (
      <PinModal
        isOpen={isPinModalOpen}
        onClose={handlePinClose}
        onSubmit={handlePinSubmit}
        isCreating={isCreatingPin}
        error={pinError}
      />
    );
  }

  // Redirect if not parent or no children
  if (!isParent || !hasChildren) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">Parent Dashboard is only available for parent accounts with children.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  // Handle child not found
  if (!currentChild) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">Child not found.</p>
        <Button onClick={() => navigate('/parent-dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          onClick={() => navigate('/parent-dashboard')}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Dashboard
        </Button>
      </div>

      {/* Child switcher */}
      <ChildSwitcher
        children={children}
        activeChildId={childId || ''}
        onSelectChild={(id) => navigate(`/parent-dashboard/child/${id}`)}
      />

      {/* Child header */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              name={currentChild.name}
              gradeLevel={currentChild.grade_level}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{currentChild.name}</h1>
              <p className="text-gray-500">Grade {currentChild.grade_level}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/profiles/manage')}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Edit2 size={16} />
              Edit
            </Button>
            <Button
              onClick={handleExport}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download size={16} />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Quick stats inline */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{totalWords}</p>
            <p className="text-xs text-gray-500">Words</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{masteredCount}</p>
            <p className="text-xs text-gray-500">Mastered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{overallAccuracy}%</p>
            <p className="text-xs text-gray-500">Accuracy</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{streak}</p>
            <p className="text-xs text-gray-500">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Main analytics content */}
      <div className="space-y-6">
        {/* Quick Stats Dashboard */}
        <QuickStatsDashboard
          totalWords={totalWords}
          masteredWords={masteredCount}
          accuracy={overallAccuracy}
          streak={streak}
        />

        {/* Learning Activity Chart */}
        <LearningActivityChart words={wordBank.words} />

        {/* Struggling Words Panel */}
        <div id="panel-struggling">
          <StrugglingWordsPanel
            words={strugglingWords}
            isExpanded={expandedPanel === 'struggling'}
            onToggleExpand={() => setExpandedPanel(expandedPanel === 'struggling' ? null : 'struggling')}
            onForcePractice={() => {}} // No-op since we're viewing another child's data
            onArchive={() => {}} // No-op since we're viewing another child's data
          />
        </div>

        {/* Error Pattern Analysis */}
        {statistics && (
          <div id="panel-patterns">
            <ErrorPatternAnalysis
              patterns={statistics.errorPatterns}
              isExpanded={expandedPanel === 'patterns'}
              onToggleExpand={() => setExpandedPanel(expandedPanel === 'patterns' ? null : 'patterns')}
            />
          </div>
        )}

        {/* Recommendations */}
        {statistics && (
          <RecommendationsPanel
            words={wordBank.words}
            errorPatterns={statistics.errorPatterns}
            recentMasteredCount={wordStates.mastered.length}
          />
        )}
      </div>
    </div>
  );
}
