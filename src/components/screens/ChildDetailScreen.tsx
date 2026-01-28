import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Flower2, TreePalm, ChevronRight } from 'lucide-react';
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
} from '@/components/wordbank';
import { AccuracyTrendChart, GameSessionDialog } from '@/components/statistics';
import { categorizeWordsByState } from '@/utils/wordSelection';
import { GameResult } from '@/types';
import { getTrophyEmoji } from '@/utils';

// Format date to a friendly string
function formatSessionDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Format duration in seconds to a human-readable string
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

interface RecentSessionsListProps {
  sessions: GameResult[];
  onSessionClick: (session: GameResult) => void;
}

/**
 * Recent Sessions List - Shows last 5 game sessions with click-to-view details
 */
function RecentSessionsList({ sessions, onSessionClick }: RecentSessionsListProps) {
  // Get the 5 most recent sessions (already sorted newest first in gameHistory)
  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="bg-white rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="text-blue-500" size={24} />
        Recent Sessions
      </h2>

      <div className="space-y-2">
        {recentSessions.map((session) => {
          const isMeadow = session.mode === 'meadow';
          const firstTryCount = session.completedWords.filter(w => w.attempts === 1).length;
          const totalWords = session.completedWords.length;

          return (
            <button
              key={session.id}
              onClick={() => onSessionClick(session)}
              className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50
                       transition-colors text-left group"
            >
              {/* Mode icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isMeadow ? 'bg-green-100' : session.won ? 'bg-amber-100' : 'bg-red-100'
              }`}>
                {isMeadow ? (
                  <Flower2 className="w-5 h-5 text-green-500" />
                ) : session.won && session.trophy ? (
                  <span className="text-lg">{getTrophyEmoji(session.trophy)}</span>
                ) : (
                  <TreePalm className={`w-5 h-5 ${session.won ? 'text-amber-500' : 'text-red-500'}`} />
                )}
              </div>

              {/* Session info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 capitalize">
                    {session.mode === 'meadow' ? 'Chill Mode' :
                     session.mode === 'savannah' ? 'Chase Mode' : 'Wildlands'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatSessionDate(session.date)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {firstTryCount}/{totalWords} first try
                  <span className="mx-2">·</span>
                  {formatDuration(session.totalTime)}
                </div>
              </div>

              {/* Chevron */}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          );
        })}
      </div>

      {sessions.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          No practice sessions yet. Start practicing to see history here!
        </p>
      )}
    </div>
  );
}

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

  const [expandedPanel, setExpandedPanel] = useState<'patterns' | null>('patterns');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GameResult | null>(null);

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
        />

        {/* Activity Heatmap */}
        <ActivityHeatmap words={wordBank.words} />

        {/* Accuracy Trend Chart */}
        {statistics && (
          <AccuracyTrendChart gameHistory={statistics.gameHistory} />
        )}

        {/* Recent Sessions */}
        {statistics && statistics.gameHistory.length > 0 && (
          <RecentSessionsList
            sessions={statistics.gameHistory}
            onSessionClick={setSelectedSession}
          />
        )}

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

      {/* Game Session Dialog */}
      <GameSessionDialog
        game={selectedSession}
        isOpen={selectedSession !== null}
        onClose={() => setSelectedSession(null)}
      />

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
