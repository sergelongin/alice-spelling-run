import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Flower2, TreePalm, ChevronRight, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboardAccess, useChildData } from '@/hooks';
import { PinModal } from '@/components/wordbank';
import { Button } from '@/components/common';
import { EditProfileModal, DeleteConfirmDialog, ResetProgressDialog } from '@/components/profiles';
import { ChildHeaderCard } from '@/components/parent';
import { GameSessionDialog } from '@/components/statistics';
import { GameResult, WordAttempt } from '@/types';
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
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

// Group sessions by date
function groupSessionsByDate(sessions: GameResult[]): Map<string, GameResult[]> {
  const groups = new Map<string, GameResult[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    let groupKey: string;

    if (sessionDate.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (sessionDate.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (sessionDate >= thisWeekStart) {
      groupKey = 'This Week';
    } else {
      groupKey = sessionDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(session);
  }

  return groups;
}

type ModeFilter = 'all' | 'meadow' | 'savannah' | 'wildlands';

interface SessionListProps {
  sessions: GameResult[];
  onSessionClick: (session: GameResult) => void;
}

function SessionList({ sessions, onSessionClick }: SessionListProps) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const filteredSessions = useMemo(() => {
    if (modeFilter === 'all') return sessions;
    return sessions.filter(s => s.mode === modeFilter);
  }, [sessions, modeFilter]);

  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  return (
    <div className="bg-white rounded-xl shadow-lg">
      {/* Header with filter */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-blue-500" size={24} />
          Session History
        </h2>

        {/* Mode filter dropdown */}
        <div className="relative">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
            className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 pr-8
                     text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Modes</option>
            <option value="meadow">Chill Mode</option>
            <option value="savannah">Chase Mode</option>
            <option value="wildlands">Wildlands</option>
          </select>
          <Filter size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Session list grouped by date */}
      <div className="divide-y divide-gray-100">
        {Array.from(groupedSessions.entries()).map(([dateGroup, groupSessions]) => (
          <div key={dateGroup}>
            {/* Date group header */}
            <div className="px-5 py-2 bg-gray-50">
              <span className="text-sm font-medium text-gray-600">{dateGroup}</span>
              <span className="text-sm text-gray-400 ml-2">({groupSessions.length} sessions)</span>
            </div>

            {/* Sessions in this group */}
            <div className="divide-y divide-gray-50">
              {groupSessions.map((session) => {
                const isMeadow = session.mode === 'meadow';
                const firstTryCount = session.completedWords.filter(w => w.attempts === 1).length;
                const totalWords = session.completedWords.length;

                return (
                  <button
                    key={session.id}
                    onClick={() => onSessionClick(session)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50
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
                        {!isMeadow && session.finalLives !== undefined && (
                          <>
                            <span className="mx-2">·</span>
                            {session.finalLives} lives left
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredSessions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {modeFilter === 'all' ? (
            <>
              <p>No practice sessions yet.</p>
              <p className="text-sm mt-1">Start practicing to see history here!</p>
            </>
          ) : (
            <p>No {modeFilter === 'meadow' ? 'Chill Mode' : modeFilter === 'savannah' ? 'Chase Mode' : 'Wildlands'} sessions yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Child Session History Screen - Full game session list with filters
 *
 * Features:
 * - Shows all game sessions (not just 5)
 * - Mode filter dropdown
 * - Grouped by date (Today, Yesterday, This Week, etc.)
 * - Click to view session details
 */
export function ChildSessionHistoryScreen() {
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
  const [selectedSession, setSelectedSession] = useState<GameResult | null>(null);

  // Find the current child
  const currentChild = useMemo(
    () => children.find(c => c.id === childId),
    [children, childId]
  );

  // Load child data from WatermelonDB
  const { wordBank, statistics } = useChildData(childId || '');

  // Build attempts map from word bank - all historical attempts for each word
  const attemptsMap = useMemo(() => {
    const map = new Map<string, WordAttempt[]>();
    for (const word of wordBank.words) {
      if (word.attemptHistory?.length > 0) {
        map.set(word.text.toLowerCase(), word.attemptHistory);
      }
    }
    return map;
  }, [wordBank.words]);

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

      {/* Session History */}
      <SessionList
        sessions={statistics?.gameHistory || []}
        onSessionClick={setSelectedSession}
      />

      {/* Game Session Dialog */}
      <GameSessionDialog
        game={selectedSession}
        isOpen={selectedSession !== null}
        onClose={() => setSelectedSession(null)}
        attemptsMap={attemptsMap}
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
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
