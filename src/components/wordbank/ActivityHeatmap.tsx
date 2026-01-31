import { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { Word } from '@/types';

interface ActivityHeatmapProps {
  words: Word[];
}

interface DayActivity {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

/**
 * GitHub-style contribution heatmap showing practice activity over the last year.
 * Shows daily practice frequency with color intensity.
 * Dynamically adjusts to container width to show only visible months.
 */
export function ActivityHeatmap({ words }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(element);
    // Initial measurement
    setContainerWidth(element.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate how many weeks we can show based on container width
  const dayLabelWidth = 24; // ~24px for day labels (S, M, T, etc.)
  const cellSize = 12; // w-3 = 12px
  const gap = 4; // gap-1 = 4px
  const padding = 40; // padding for container
  const weeksToShow = containerWidth > 0
    ? Math.max(8, Math.floor((containerWidth - dayLabelWidth - padding) / (cellSize + gap)))
    : 52; // Default to full year if not measured yet

  const { gridData, stats } = useMemo(() => {
    // Generate last 364 days (52 weeks)
    const days = 364;
    const now = new Date();
    const activityMap = new Map<string, DayActivity>();

    // Initialize all days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, {
        date: dateStr,
        attempts: 0,
        correct: 0,
        accuracy: 0,
      });
    }

    // Aggregate attempts by date
    for (const word of words) {
      if (word.attemptHistory) {
        for (const attempt of word.attemptHistory) {
          const attemptDate = attempt.timestamp.split('T')[0];
          const dayData = activityMap.get(attemptDate);
          if (dayData) {
            dayData.attempts++;
            if (attempt.wasCorrect) {
              dayData.correct++;
            }
          }
        }
      }
    }

    // Calculate accuracy for each day
    activityMap.forEach(day => {
      if (day.attempts > 0) {
        day.accuracy = Math.round((day.correct / day.attempts) * 100);
      }
    });

    // Convert to array and organize into weeks
    const allDays = Array.from(activityMap.values());
    const weeks: DayActivity[][] = [];

    // Find the first day (should be a Sunday for proper alignment)
    const firstDate = new Date(allDays[0].date);
    const dayOfWeek = firstDate.getDay(); // 0 = Sunday

    // Pad the beginning with empty days if needed
    const paddedDays = [...Array(dayOfWeek).fill(null), ...allDays];

    // Split into weeks
    for (let i = 0; i < paddedDays.length; i += 7) {
      weeks.push(paddedDays.slice(i, i + 7));
    }

    // Generate month labels
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let currentMonth = '';

    weeks.forEach((week, weekIndex) => {
      const firstRealDay = week.find(d => d !== null);
      if (firstRealDay) {
        const date = new Date(firstRealDay.date);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        if (monthName !== currentMonth && date.getDate() <= 7) {
          labels.push({ month: monthName, weekIndex });
          currentMonth = monthName;
        }
      }
    });

    // Calculate overall stats
    const activeDays = allDays.filter(d => d.attempts > 0).length;
    const totalAttempts = allDays.reduce((sum, d) => sum + d.attempts, 0);

    return {
      gridData: weeks,
      monthLabels: labels,  // Used in full-width mode
      stats: { activeDays, totalAttempts },
    };
  }, [words]);

  // Slice gridData to show only visible weeks (most recent)
  const visibleGridData = useMemo(() => {
    return gridData.slice(-weeksToShow);
  }, [gridData, weeksToShow]);

  // Recalculate month labels for visible weeks only
  const visibleMonthLabels = useMemo(() => {
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let currentMonth = '';

    visibleGridData.forEach((week, weekIndex) => {
      const firstRealDay = week.find(d => d !== null);
      if (firstRealDay) {
        const date = new Date(firstRealDay.date);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        if (monthName !== currentMonth && date.getDate() <= 7) {
          labels.push({ month: monthName, weekIndex });
          currentMonth = monthName;
        }
      }
    });

    return labels;
  }, [visibleGridData]);

  // Color scale based on attempts
  const getActivityColor = (attempts: number): string => {
    if (attempts === 0) return 'bg-gray-100';
    if (attempts <= 2) return 'bg-green-200';
    if (attempts <= 5) return 'bg-green-400';
    if (attempts <= 9) return 'bg-green-500';
    return 'bg-green-700';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="bg-white rounded-xl p-5 shadow-lg" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="text-green-500" size={24} />
          Practice Activity
        </h2>
        <div className="text-sm text-gray-500">
          {stats.activeDays} active days
        </div>
      </div>

      {/* Chart container */}
      <div className="relative">
        {/* Month labels */}
        <div className="flex mb-2 ml-6 h-4 relative">
          {visibleMonthLabels.map(({ month, weekIndex }) => (
            <div
              key={`${month}-${weekIndex}`}
              className="text-xs text-gray-500"
              style={{
                position: 'absolute',
                left: `${weekIndex * 16 + 20}px`,
              }}
            >
              {month}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-1 mt-2">
          {/* Day labels */}
          <div className="flex flex-col gap-1 mr-1">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="w-4 h-3 text-xs text-gray-400 flex items-center justify-end pr-1"
              >
                {i % 2 === 1 ? label : ''}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {visibleGridData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <div key={dayIndex} className="w-3 h-3" />;
                }

                const date = new Date(day.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${getActivityColor(day.attempts)}
                              group relative cursor-pointer hover:ring-2 hover:ring-gray-400 transition-all`}
                    title={`${formattedDate}: ${day.attempts} attempts`}
                  >
                    {/* Tooltip */}
                    {day.attempts > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
                                    bg-gray-800 text-white text-xs rounded whitespace-nowrap
                                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="font-medium">{formattedDate}</div>
                        <div>{day.attempts} attempts</div>
                        <div>{day.correct} correct ({day.accuracy}%)</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded-sm" />
            <div className="w-3 h-3 bg-green-200 rounded-sm" />
            <div className="w-3 h-3 bg-green-400 rounded-sm" />
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <div className="w-3 h-3 bg-green-700 rounded-sm" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Empty state */}
      {stats.totalAttempts === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No practice data yet.</p>
          <p className="text-sm mt-1">Start practicing to see activity trends!</p>
        </div>
      )}
    </div>
  );
}
