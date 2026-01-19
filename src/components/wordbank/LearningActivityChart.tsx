import { useState, useMemo } from 'react';
import { Word } from '@/types';

type TimeRange = '7d' | '30d' | 'all';

interface LearningActivityChartProps {
  words: Word[];
}

interface DayData {
  date: string;
  label: string;
  correct: number;
  incorrect: number;
  total: number;
}

/**
 * Simple bar chart showing learning activity over time.
 * Shows practice frequency and accuracy trend.
 */
export function LearningActivityChart({ words }: LearningActivityChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const chartData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data: DayData[] = [];
    const now = new Date();

    // Initialize days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const label = timeRange === '7d'
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      data.push({
        date: dateStr,
        label,
        correct: 0,
        incorrect: 0,
        total: 0,
      });
    }

    // Aggregate attempts by date
    for (const word of words) {
      if (word.attemptHistory) {
        for (const attempt of word.attemptHistory) {
          const attemptDate = attempt.timestamp.split('T')[0];
          const dayData = data.find(d => d.date === attemptDate);
          if (dayData) {
            dayData.total++;
            if (attempt.wasCorrect) {
              dayData.correct++;
            } else {
              dayData.incorrect++;
            }
          }
        }
      }
    }

    return data;
  }, [words, timeRange]);

  // Calculate max for scaling
  const maxTotal = Math.max(1, ...chartData.map(d => d.total));

  // Calculate overall stats for the period
  const totalAttempts = chartData.reduce((sum, d) => sum + d.total, 0);
  const totalCorrect = chartData.reduce((sum, d) => sum + d.correct, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const daysWithPractice = chartData.filter(d => d.total > 0).length;

  if (totalAttempts === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Learning Activity</h3>
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>No practice data yet.</p>
          <p className="text-sm mt-1">Start practicing to see activity trends!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Learning Activity</h3>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Attempts: </span>
          <span className="font-medium text-gray-800">{totalAttempts}</span>
        </div>
        <div>
          <span className="text-gray-500">Accuracy: </span>
          <span className={`font-medium ${accuracy >= 70 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {accuracy}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">Active days: </span>
          <span className="font-medium text-gray-800">{daysWithPractice}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-32">
        <div className="flex items-end justify-between h-full gap-1">
          {chartData.map((day) => {
            const height = (day.total / maxTotal) * 100;
            const correctHeight = day.total > 0 ? (day.correct / day.total) * height : 0;
            const incorrectHeight = height - correctHeight;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center group"
              >
                {/* Bar */}
                <div
                  className="w-full relative flex flex-col justify-end rounded-t-sm overflow-hidden"
                  style={{ height: `${height}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                >
                  {/* Correct portion */}
                  <div
                    className="w-full bg-green-400 transition-all group-hover:bg-green-500"
                    style={{ height: `${(correctHeight / height) * 100 || 0}%` }}
                  />
                  {/* Incorrect portion */}
                  <div
                    className="w-full bg-red-300 transition-all group-hover:bg-red-400"
                    style={{ height: `${(incorrectHeight / height) * 100 || 0}%` }}
                  />
                </div>

                {/* Tooltip on hover */}
                {day.total > 0 && (
                  <div className="absolute bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded
                                 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                                 whitespace-nowrap z-10">
                    {day.label}: {day.correct}/{day.total} correct
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-gray-400">
          {timeRange === '7d' ? (
            chartData.map((day) => (
              <span key={day.date} className="flex-1 text-center">{day.label}</span>
            ))
          ) : (
            <>
              <span>{chartData[0]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-8 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-400 rounded-sm" />
          <span>Correct</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-300 rounded-sm" />
          <span>Incorrect</span>
        </div>
      </div>
    </div>
  );
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const options: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors
                    ${value === option.value
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
