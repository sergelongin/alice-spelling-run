import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Target, Flame, Flower2, TreePalm, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../common';
import { AccuracyTrendChart, GameSessionDialog } from '../statistics';
import { useFreshGameData } from '@/hooks';
import { TrophyTier, StatsModeId, ModeStatistics, GameResult, createInitialModeStatistics } from '@/types';
import { getTrophyEmoji, getTrophyColor } from '@/utils';

const ITEMS_PER_PAGE = 10;

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
];

export function StatisticsScreen() {
  const navigate = useNavigate();
  const { statistics, isLoading } = useFreshGameData();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<GameResult | null>(null);

  // Show loading spinner while WatermelonDB subscriptions initialize
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto" />
      </div>
    );
  }

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

  const winRate =
    activeStats.totalGamesPlayed > 0
      ? Math.round((activeStats.totalWins / activeStats.totalGamesPlayed) * 100)
      : 0;

  const getTabColorClasses = (tab: ModeTab, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      gray: { active: 'bg-gray-600 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
      green: { active: 'bg-green-600 text-white', inactive: 'bg-green-100 text-green-600 hover:bg-green-200' },
      amber: { active: 'bg-amber-600 text-white', inactive: 'bg-amber-100 text-amber-600 hover:bg-amber-200' },
    };
    return isActive ? colors[tab.color].active : colors[tab.color].inactive;
  };

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Statistics</h1>

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
          <div className="grid grid-cols-3 gap-4 mb-8">
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
          </div>

          {/* Trophy collection - only show for modes that award trophies */}
          {activeTab !== 'meadow' && (
            <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} />
                Savannah Trophy Collection
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

          {/* Accuracy Trend Chart */}
          <div className="mb-8">
            <AccuracyTrendChart gameHistory={activeStats.gameHistory} />
          </div>

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
              <>
                {(() => {
                  const totalPages = Math.ceil(activeStats.gameHistory.length / ITEMS_PER_PAGE);
                  const safePage = Math.min(currentPage, totalPages);
                  const paginatedGames = activeStats.gameHistory.slice(
                    (safePage - 1) * ITEMS_PER_PAGE,
                    safePage * ITEMS_PER_PAGE
                  );

                  return (
                    <>
                      <div className="space-y-3">
                        {paginatedGames.map((game, index) => {
                          const isMeadowGame = game.mode === 'meadow';
                          const hasCompletedWords = game.completedWords && game.completedWords.length > 0;

                          return (
                            <div
                              key={game.id || index}
                              onClick={() => hasCompletedWords && setSelectedGame(game)}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                isMeadowGame
                                  ? 'bg-green-50'
                                  : game.won
                                  ? 'bg-green-50'
                                  : 'bg-red-50'
                              } ${hasCompletedWords ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 transition-all' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                {isMeadowGame ? (
                                  <Flower2 className="w-6 h-6 text-green-500" />
                                ) : game.won ? (
                                  <span className="text-2xl">{game.trophy ? getTrophyEmoji(game.trophy) : '🏆'}</span>
                                ) : (
                                  <span className="text-2xl">❌</span>
                                )}
                                <div>
                                  <div className="font-medium text-gray-800">
                                    {isMeadowGame
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
                                  {game.wordsCorrect} word{game.wordsCorrect !== 1 ? 's' : ''} {isMeadowGame ? 'practiced' : 'correct'}
                                </div>
                                {!isMeadowGame && (
                                  <div className="text-sm text-gray-500">
                                    {game.finalLives} lives left
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>
                          <span className="text-sm text-gray-600">
                            Page {safePage} of {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:hover:bg-gray-100"
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </>
      )}

      {/* Game Session Dialog */}
      <GameSessionDialog
        game={selectedGame}
        isOpen={selectedGame !== null}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
