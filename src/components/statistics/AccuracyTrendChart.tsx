import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GameResult } from '@/types';

interface AccuracyTrendChartProps {
  gameHistory: GameResult[];
}

interface GameAccuracyPoint {
  gameIndex: number;
  firstTryPercent: number;
  gameDate: string;
  wordsCount: number;
  firstTryCount: number;
}

/**
 * Calculates first-try accuracy for each game.
 * First-try accuracy = (words with attempts === 1) / (total words) * 100
 */
function calculateAccuracyTrend(gameHistory: GameResult[]): GameAccuracyPoint[] {
  const gamesWithData = gameHistory
    .filter(game => game.completedWords && game.completedWords.length > 0)
    .slice(0, 10)
    .reverse(); // Oldest first for left-to-right display

  return gamesWithData.map((game, index) => {
    const totalWords = game.completedWords.length;
    const firstTryWords = game.completedWords.filter(cw => cw.attempts === 1).length;
    return {
      gameIndex: index + 1,
      firstTryPercent: Math.round((firstTryWords / totalWords) * 100),
      gameDate: new Date(game.date).toLocaleDateString(),
      wordsCount: totalWords,
      firstTryCount: firstTryWords,
    };
  });
}

/**
 * Line chart showing first-try accuracy trend over last 10 games using Recharts.
 */
export function AccuracyTrendChart({ gameHistory }: AccuracyTrendChartProps) {
  const dataPoints = useMemo(() => calculateAccuracyTrend(gameHistory), [gameHistory]);

  // Need at least 2 games to show a trend
  if (dataPoints.length < 2) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="text-purple-500" size={24} />
          Accuracy Trend
        </h2>
        <div className="text-center py-8 text-gray-500">
          <p>Play more games to see your accuracy trend!</p>
          <p className="text-sm mt-1">Need at least 2 games with words practiced.</p>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const latestPercent = dataPoints[dataPoints.length - 1].firstTryPercent;
  const averagePercent = Math.round(
    dataPoints.reduce((sum, p) => sum + p.firstTryPercent, 0) / dataPoints.length
  );
  const trendChange = dataPoints.length >= 2
    ? dataPoints[dataPoints.length - 1].firstTryPercent - dataPoints[0].firstTryPercent
    : 0;

  return (
    <div className="bg-white rounded-xl p-5 shadow-lg">
      {/* Header */}
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <TrendingUp className="text-purple-500" size={24} />
        Accuracy Trend
      </h2>

      {/* Summary stats */}
      <div className="flex gap-4 mb-4 text-sm flex-wrap">
        <div>
          <span className="text-gray-500">Latest: </span>
          <span className={`font-medium ${getAccuracyColor(latestPercent)}`}>
            {latestPercent}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">Average: </span>
          <span className={`font-medium ${getAccuracyColor(averagePercent)}`}>
            {averagePercent}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Trend: </span>
          <TrendIndicator change={trendChange} />
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="gameIndex"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="firstTryPercent"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#7c3aed' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-4 text-xs text-gray-500">
        <Info size={12} />
        <span>Words spelled correctly on first try</span>
      </div>
    </div>
  );
}

function getAccuracyColor(percent: number): string {
  if (percent >= 70) return 'text-green-600';
  if (percent >= 50) return 'text-amber-600';
  return 'text-red-600';
}

interface TrendIndicatorProps {
  change: number;
}

function TrendIndicator({ change }: TrendIndicatorProps) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-green-600 font-medium">
        <TrendingUp size={14} />
        +{change}%
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-0.5 text-red-600 font-medium">
        <TrendingDown size={14} />
        {change}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-gray-500 font-medium">
      <Minus size={14} />
      0%
    </span>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GameAccuracyPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 shadow-lg">
      <div className="font-medium">{data.gameDate}</div>
      <div>{data.firstTryCount}/{data.wordsCount} first try ({data.firstTryPercent}%)</div>
    </div>
  );
}
