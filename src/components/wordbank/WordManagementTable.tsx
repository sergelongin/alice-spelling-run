import { useState, useMemo } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Archive,
  RotateCcw,
  Play,
  Download,
  Filter,
  Table,
} from 'lucide-react';
import { Word } from '@/types';
import { getWordState, WordState } from '@/utils/wordSelection';

type SortField = 'word' | 'level' | 'accuracy' | 'attempts' | 'lastPracticed';
type SortDirection = 'asc' | 'desc';
type FilterState = 'all' | 'learning' | 'review' | 'mastered' | 'available' | 'archived';

interface WordManagementTableProps {
  words: Word[];
  onRemove: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onForceIntroduce: (id: string) => void;
  onExport: () => void;
  onWordClick: (word: Word) => void;
}

/**
 * Sortable, filterable table of all words with full management capabilities.
 * Supports search, sort, filter, and bulk actions.
 */
export function WordManagementTable({
  words,
  onRemove,
  onArchive,
  onUnarchive,
  onForceIntroduce,
  onExport,
  onWordClick,
}: WordManagementTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('word');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterState, setFilterState] = useState<FilterState>('all');

  // Filter and sort words
  const filteredWords = useMemo(() => {
    let result = [...words];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(w => w.text.includes(query));
    }

    // Apply filter
    if (filterState !== 'all') {
      if (filterState === 'archived') {
        result = result.filter(w => w.isActive === false);
      } else {
        result = result.filter(w => {
          if (w.isActive === false) return false;
          return getWordState(w) === filterState;
        });
      }
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'word':
          comparison = a.text.localeCompare(b.text);
          break;
        case 'level':
          comparison = a.masteryLevel - b.masteryLevel;
          break;
        case 'accuracy':
          const accA = a.timesUsed > 0 ? a.timesCorrect / a.timesUsed : 0;
          const accB = b.timesUsed > 0 ? b.timesCorrect / b.timesUsed : 0;
          comparison = accA - accB;
          break;
        case 'attempts':
          comparison = a.timesUsed - b.timesUsed;
          break;
        case 'lastPracticed':
          const dateA = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
          const dateB = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [words, searchQuery, sortField, sortDirection, filterState]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">⇅</span>;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStateLabel = (state: WordState) => {
    const labels: Record<WordState, { text: string; color: string }> = {
      available: { text: 'Waiting', color: 'bg-gray-100 text-gray-600' },
      learning: { text: 'Learning', color: 'bg-orange-100 text-orange-700' },
      review: { text: 'Reviewing', color: 'bg-blue-100 text-blue-700' },
      mastered: { text: 'Mastered', color: 'bg-green-100 text-green-700' },
    };
    return labels[state];
  };

  // Count words by filter state for badges
  const stateCounts = useMemo(() => {
    const counts: Record<FilterState, number> = {
      all: words.length,
      learning: 0,
      review: 0,
      mastered: 0,
      available: 0,
      archived: 0,
    };

    for (const word of words) {
      if (word.isActive === false) {
        counts.archived++;
      } else {
        const state = getWordState(word);
        counts[state]++;
      }
    }

    return counts;
  }, [words]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
          <Table className="w-5 h-5 text-gray-500" />
          <span className="font-semibold text-gray-800">Word Management</span>
          <span className="text-sm text-gray-500">({words.length} words)</span>
        </div>
      </button>

      {!isCollapsed && (
        <>
          {/* Search and filters */}
          <div className="px-5 py-4 border-t border-gray-100">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search words..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                />
              </div>

              {/* Filter dropdown */}
              <div className="relative">
                <select
                  value={filterState}
                  onChange={e => setFilterState(e.target.value as FilterState)}
                  className="appearance-none pl-10 pr-8 py-2 border border-gray-200 rounded-lg text-sm
                           focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none bg-white"
                >
                  <option value="all">All ({stateCounts.all})</option>
                  <option value="learning">Learning ({stateCounts.learning})</option>
                  <option value="review">Reviewing ({stateCounts.review})</option>
                  <option value="mastered">Mastered ({stateCounts.mastered})</option>
                  <option value="available">Waiting ({stateCounts.available})</option>
                  {stateCounts.archived > 0 && (
                    <option value="archived">Archived ({stateCounts.archived})</option>
                  )}
                </select>
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              {/* Export button */}
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700
                         border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th
                    onClick={() => handleSort('word')}
                    className="px-5 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  >
                    Word <SortIcon field="word" />
                  </th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600">
                    Status
                  </th>
                  <th
                    onClick={() => handleSort('level')}
                    className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  >
                    Level <SortIcon field="level" />
                  </th>
                  <th
                    onClick={() => handleSort('accuracy')}
                    className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  >
                    Accuracy <SortIcon field="accuracy" />
                  </th>
                  <th
                    onClick={() => handleSort('attempts')}
                    className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                  >
                    Attempts <SortIcon field="attempts" />
                  </th>
                  <th
                    onClick={() => handleSort('lastPracticed')}
                    className="px-3 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 hidden md:table-cell"
                  >
                    Last Practiced <SortIcon field="lastPracticed" />
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredWords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      {searchQuery ? 'No words match your search.' : 'No words in this category.'}
                    </td>
                  </tr>
                ) : (
                  filteredWords.map(word => {
                    const isArchived = word.isActive === false;
                    const state = getWordState(word);
                    const stateLabel = getStateLabel(state);
                    const accuracy = word.timesUsed > 0
                      ? Math.round((word.timesCorrect / word.timesUsed) * 100)
                      : null;

                    return (
                      <tr
                        key={word.id}
                        onClick={() => onWordClick(word)}
                        className={`hover:bg-gray-50 cursor-pointer ${isArchived ? 'opacity-50' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <span className="font-medium text-gray-800 capitalize">{word.text}</span>
                        </td>
                        <td className="px-3 py-3">
                          {isArchived ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Archived
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stateLabel.color}`}>
                              {stateLabel.text}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {word.masteryLevel}/5
                        </td>
                        <td className="px-3 py-3">
                          {accuracy !== null ? (
                            <span className={accuracy < 50 ? 'text-red-600' : accuracy < 80 ? 'text-amber-600' : 'text-green-600'}>
                              {accuracy}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {word.timesUsed}
                        </td>
                        <td className="px-3 py-3 text-gray-500 hidden md:table-cell">
                          {formatDate(word.lastAttemptAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            {state === 'available' && !isArchived && (
                              <button
                                onClick={() => onForceIntroduce(word.id)}
                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Start learning"
                              >
                                <Play size={14} />
                              </button>
                            )}
                            {isArchived ? (
                              <button
                                onClick={() => onUnarchive(word.id)}
                                className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded"
                                title="Restore"
                              >
                                <RotateCcw size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => onArchive(word.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                title="Archive"
                              >
                                <Archive size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => onRemove(word.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with count */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-500">
            Showing {filteredWords.length} of {words.length} words
          </div>
        </>
      )}
    </div>
  );
}
