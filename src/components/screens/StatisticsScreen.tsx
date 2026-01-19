import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Trash2, Calendar, Target, Flame, Flower2, TreePalm } from 'lucide-react';
import { Button, Modal } from '../common';
import { useGameContext } from '@/context/GameContext';
import { TrophyTier, StatsModeId, ModeStatistics, createInitialModeStatistics } from '@/types';
import { getTrophyEmoji, getTrophyColor } from '@/utils';

const TROPHY_TIERS: TrophyTier[] = ['platinum', 'gold', 'silver', 'bronze', 'participant'];

// Use StatsModeId for tabs since savannah-quick shares stats with savannah
type TabId = 'all' | StatsModeId;

interface ModeTab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const MODE_TABS: ModeTab[] = [
  { id: 'all', label: 'All Modes', icon: <Target size={18} />, color: 'gray' },
  { id: 'meadow', label: 'Meadow', icon: <Flower2 size={18} />, color: 'green' },
  { id: 'savannah', label: 'Savannah', icon: <TreePalm size={18} />, color: 'amber' },
  { id: 'wildlands', label: 'Wildlands', icon: <Trophy size={18} />, color: 'purple' },
];

export function StatisticsScreen() {
  const navigate = useNavigate();
  const { statistics, clearHistory } = useGameContext();
  const [showClearModal, setShowClearModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Get stats for the active tab
  const getActiveStats = (): ModeStatistics => {
    if (activeTab === 'all') {
      // Return aggregated legacy stats
      return {
        totalGamesPlayed: statistics.totalGamesPlayed,
        totalWins: statistics.totalWins,
        totalWordsAttempted: statistics.totalWordsAttempted,
        totalWordsCorrect: statistics.totalWordsCorrect,
        trophyCounts: statistics.trophyCounts,
        gameHistory: statistics.gameHistory,
        streakCurrent: statistics.streakCurrent,
        streakBest: statistics.streakBest,
      };
    }
    return statistics.modeStats?.[activeTab] || createInitialModeStatistics();
  };

  const activeStats = getActiveStats();

  const accuracy =
    activeStats.totalWordsAttempted > 0
      ? Math.round(
          (activeStats.totalWordsCorrect / activeStats.totalWordsAttempted) * 100
        )
      : 0;

  const winRate =
    activeStats.totalGamesPlayed > 0
      ? Math.round((activeStats.totalWins / activeStats.totalGamesPlayed) * 100)
      : 0;

  const handleClearHistory = () => {
    clearHistory();
    setShowClearModal(false);
  };

  const getTabColorClasses = (tab: ModeTab, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      gray: { active: 'bg-gray-600 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
      green: { active: 'bg-green-600 text-white', inactive: 'bg-green-100 text-green-600 hover:bg-green-200' },
      amber: { active: 'bg-amber-600 text-white', inactive: 'bg-amber-100 text-amber-600 hover:bg-amber-200' },
      purple: { active: 'bg-purple-600 text-white', inactive: 'bg-purple-100 text-purple-600 hover:bg-purple-200' },
    };
    return isActive ? colors[tab.color].active : colors[tab.color].inactive;
  };

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Statistics</h1>
        </div>

        {statistics.totalGamesPlayed > 0 && (
          <Button
            onClick={() => setShowClearModal(true)}
            variant="danger"
            size="sm"
            className="flex items-center gap-2"
          >
            <Trash2 size={18} />
            Clear History
          </Button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${getTabColorClasses(tab, activeTab === tab.id)}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeStats.totalGamesPlayed === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-lg text-center">
          <Trophy className="mx-auto text-gray-300 mb-4" size={64} />
          <h2 className="text-xl font-bold text-gray-600 mb-2">No Games Yet</h2>
          <p className="text-gray-500 mb-6">
            Play some games to see your statistics here!
          </p>
          <Button onClick={() => navigate('/game')} variant="primary">
            Start Playing
          </Button>
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <Target className="mx-auto text-blue-500 mb-2" size={32} />
              <div className="text-3xl font-bold text-gray-800">
                {activeStats.totalGamesPlayed}
              </div>
              <div className="text-sm text-gray-600">
                {activeTab === 'meadow' ? 'Sessions' : 'Games Played'}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <Trophy className="mx-auto text-green-500 mb-2" size={32} />
              <div className="text-3xl font-bold text-gray-800">
                {activeTab === 'meadow' ? activeStats.totalWordsCorrect : activeStats.totalWins}
              </div>
              <div className="text-sm text-gray-600">
                {activeTab === 'meadow' ? 'Words Practiced' : `Wins (${winRate}%)`}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <Flame className="mx-auto text-orange-500 mb-2" size={32} />
              <div className="text-3xl font-bold text-gray-800">
                {activeStats.streakBest}
              </div>
              <div className="text-sm text-gray-600">Best Streak</div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg text-center">
              <div className="text-3xl font-bold text-purple-500 mb-2">
                {accuracy}%
              </div>
              <div className="text-sm text-gray-600">
                Word Accuracy
                <span className="block text-xs">
                  ({activeStats.totalWordsCorrect}/{activeStats.totalWordsAttempted})
                </span>
              </div>
            </div>
          </div>

          {/* Trophy collection - only show for modes that award trophies */}
          {activeTab !== 'meadow' && (
            <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} />
                Trophy Collection
              </h2>

              <div className="grid grid-cols-5 gap-4">
                {TROPHY_TIERS.map(tier => {
                  const count = activeStats.trophyCounts[tier] || 0;
                  const color = getTrophyColor(tier);

                  return (
                    <div
                      key={tier}
                      className="text-center p-4 rounded-lg transition-all"
                      style={{
                        backgroundColor: count > 0 ? `${color}20` : '#f5f5f5',
                        opacity: count > 0 ? 1 : 0.5,
                      }}
                    >
                      <div className="text-4xl mb-2">{getTrophyEmoji(tier)}</div>
                      <div className="text-2xl font-bold text-gray-800">{count}</div>
                      <div className="text-xs text-gray-600 capitalize">
                        {tier}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent games/sessions */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-blue-500" size={24} />
              {activeTab === 'meadow' ? 'Practice Sessions' : 'Recent Games'}
            </h2>

            {activeStats.gameHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No {activeTab === 'meadow' ? 'practice sessions' : 'games'} yet for this mode.
              </p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {activeStats.gameHistory.slice(0, 20).map((game, index) => (
                  <div
                    key={game.id || index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      activeTab === 'meadow'
                        ? 'bg-green-50'
                        : game.won
                        ? 'bg-green-50'
                        : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {activeTab === 'meadow' ? (
                        <Flower2 className="w-6 h-6 text-green-500" />
                      ) : game.trophy ? (
                        <span className="text-2xl">{getTrophyEmoji(game.trophy)}</span>
                      ) : (
                        <span className="text-2xl">❌</span>
                      )}
                      <div>
                        <div className="font-medium text-gray-800">
                          {activeTab === 'meadow'
                            ? 'Practice Complete'
                            : game.won
                            ? 'Victory!'
                            : 'Game Over'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(game.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium text-gray-800">
                        {game.wordsCorrect} word{game.wordsCorrect !== 1 ? 's' : ''} {activeTab === 'meadow' ? 'practiced' : 'correct'}
                      </div>
                      {activeTab !== 'meadow' && (
                        <div className="text-sm text-gray-500">
                          {game.finalLives} lives left
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Clear confirmation modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Statistics"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to clear all your statistics and game history? This
          action cannot be undone.
        </p>
        <div className="flex gap-4 justify-end">
          <Button variant="secondary" onClick={() => setShowClearModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearHistory}>
            Clear All
          </Button>
        </div>
      </Modal>
    </div>
  );
}
