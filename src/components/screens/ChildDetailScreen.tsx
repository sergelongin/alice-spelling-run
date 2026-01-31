import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useParentDashboardAccess,
  useChildData,
  countActiveWords,
  countMasteredWords,
  calculateStreak,
} from '@/hooks';
import { PinModal } from '@/components/wordbank';
import { Button } from '@/components/common';
import { EditProfileModal, DeleteConfirmDialog, ResetProgressDialog } from '@/components/profiles';
import { ChildHeaderCard } from '@/components/parent';
import {
  QuickStatsDashboard,
  ActivityHeatmap,
  ErrorPatternAnalysis,
  RecommendationsPanel,
  StrugglingWordsPanel,
  getStrugglingWords,
} from '@/components/wordbank';
import { AccuracyTrendChart } from '@/components/statistics';
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
  const { children, isParentOrSuperAdmin, hasChildren } = useAuth();
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Find the current child
  const currentChild = useMemo(
    () => children.find(c => c.id === childId),
    [children, childId]
  );

  // Load child data from WatermelonDB
  const { wordBank, statistics } = useChildData(childId || '');

  // Calculated stats
  const activeWords = useMemo(() =>
    wordBank.words.filter(w => w.isActive !== false),
    [wordBank.words]
  );

  const wordStates = useMemo(() =>
    categorizeWordsByState(activeWords),
    [activeWords]
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

  const strugglingWords = useMemo(() =>
    getStrugglingWords(wordBank.words),
    [wordBank.words]
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
  if (!isParentOrSuperAdmin || !hasChildren) {
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
      {/* Child navigation card */}
      <ChildHeaderCard
        child={currentChild}
        allChildren={children}
        onEdit={() => setShowEditModal(true)}
        onResetProgress={() => setShowResetDialog(true)}
        onExport={handleExport}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* Main analytics content */}
      <div className="space-y-6">
        {/* Quick Stats Dashboard */}
        <QuickStatsDashboard
          totalWords={totalWords}
          masteredWords={masteredCount}
          streak={streak}
          childId={childId || ''}
        />

        {/* Recommendations - right after QuickStats */}
        {statistics && (
          <RecommendationsPanel
            words={wordBank.words}
            errorPatterns={statistics.errorPatterns}
            recentMasteredCount={wordStates.mastered.length}
          />
        )}

        {/* Activity Heatmap + Accuracy Trend Chart (side-by-side on md+) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ActivityHeatmap words={wordBank.words} />
          {statistics && (
            <AccuracyTrendChart gameHistory={statistics.gameHistory} />
          )}
        </div>

        {/* Error Pattern Analysis - always expanded */}
        {statistics && (
          <ErrorPatternAnalysis patterns={statistics.errorPatterns} />
        )}

        {/* Struggling Words Panel - always expanded */}
        <StrugglingWordsPanel words={strugglingWords} />
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && currentChild && (
        <EditProfileModal
          child={currentChild}
          onClose={() => setShowEditModal(false)}
          onSaved={() => setShowEditModal(false)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteDialog && currentChild && (
        <DeleteConfirmDialog
          child={currentChild}
          onClose={() => setShowDeleteDialog(false)}
          onDeleted={() => {
            setShowDeleteDialog(false);
            navigate('/parent-dashboard');
          }}
        />
      )}

      {/* Reset Progress Dialog */}
      {showResetDialog && currentChild && (
        <ResetProgressDialog
          child={currentChild}
          onClose={() => setShowResetDialog(false)}
          onReset={() => {
            setShowResetDialog(false);
            // Force page refresh to show updated (empty) stats
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
