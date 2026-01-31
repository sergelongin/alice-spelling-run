import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Check, X, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { Button, Modal } from '@/components/common';
import { useAuth } from '@/context/AuthContext';
import {
  GRADE_WORDS,
  GRADE_INFO,
  GradeLevel,
  WordDefinition,
  fetchCustomWords,
  deleteCustomWord,
  CustomWord,
} from '@/data/gradeWords';

interface WordCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingWords: Set<string>; // Lowercase word texts already in bank
  onAddWords: (words: WordDefinition[]) => void;
}

type StatusFilter = 'all' | 'available' | 'added';
type TabType = 'grade-words' | 'custom-words';

const WORDS_PER_PAGE = 50;

/**
 * Modal for browsing the word catalog and selecting words to add
 * Includes both grade-level words and custom parent-created words
 */
export function WordCatalogModal({
  isOpen,
  onClose,
  existingWords,
  onAddWords,
}: WordCatalogModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('grade-words');
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // Custom words state
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null);

  // Fetch custom words when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setIsLoadingCustom(true);
      fetchCustomWords(user.id)
        .then(words => setCustomWords(words))
        .catch(err => console.error('Failed to fetch custom words:', err))
        .finally(() => setIsLoadingCustom(false));
    }
  }, [isOpen, user]);

  // Get all words from all grades
  const allGradeWords = useMemo(() => {
    const words: (WordDefinition & { grade: GradeLevel })[] = [];
    for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
      for (const word of GRADE_WORDS[grade]) {
        words.push({ ...word, grade });
      }
    }
    return words;
  }, []);

  // Filter grade words based on search, grade, and status
  const filteredGradeWords = useMemo(() => {
    return allGradeWords.filter(word => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesWord = word.word.toLowerCase().includes(searchLower);
        const matchesDef = word.definition.toLowerCase().includes(searchLower);
        if (!matchesWord && !matchesDef) return false;
      }

      // Grade filter
      if (gradeFilter !== 'all' && word.grade !== gradeFilter) {
        return false;
      }

      // Status filter
      const isAdded = existingWords.has(word.word.toLowerCase());
      if (statusFilter === 'available' && isAdded) return false;
      if (statusFilter === 'added' && !isAdded) return false;

      return true;
    });
  }, [allGradeWords, search, gradeFilter, statusFilter, existingWords]);

  // Filter custom words based on search and status
  const filteredCustomWords = useMemo(() => {
    return customWords.filter(word => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesWord = word.word.toLowerCase().includes(searchLower);
        const matchesDef = word.definition.toLowerCase().includes(searchLower);
        if (!matchesWord && !matchesDef) return false;
      }

      // Status filter
      const isAdded = existingWords.has(word.word.toLowerCase());
      if (statusFilter === 'available' && isAdded) return false;
      if (statusFilter === 'added' && !isAdded) return false;

      return true;
    });
  }, [customWords, search, statusFilter, existingWords]);

  // Current filtered words based on active tab
  const filteredWords = activeTab === 'grade-words' ? filteredGradeWords : filteredCustomWords;

  // Pagination
  const totalPages = Math.ceil(filteredWords.length / WORDS_PER_PAGE);
  const paginatedWords = useMemo(() => {
    const start = (page - 1) * WORDS_PER_PAGE;
    return filteredWords.slice(start, start + WORDS_PER_PAGE);
  }, [filteredWords, page]);

  // Reset page when filters or tab change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleGradeChange = (value: GradeLevel | 'all') => {
    setGradeFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedWords(new Set());
  };

  // Selection handlers
  const toggleWord = (wordText: string) => {
    const isAdded = existingWords.has(wordText.toLowerCase());
    if (isAdded) return; // Can't select words already in bank

    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(wordText)) {
        next.delete(wordText);
      } else {
        next.add(wordText);
      }
      return next;
    });
  };

  const selectAllOnPage = () => {
    const available = paginatedWords.filter(
      w => !existingWords.has(w.word.toLowerCase())
    );
    setSelectedWords(prev => {
      const next = new Set(prev);
      for (const word of available) {
        next.add(word.word);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
  };

  // Delete custom word
  const handleDeleteCustomWord = async (e: React.MouseEvent, wordId: string) => {
    e.stopPropagation();
    setDeletingWordId(wordId);

    const { error } = await deleteCustomWord(wordId);

    if (!error) {
      setCustomWords(prev => prev.filter(w => w.id !== wordId));
    }

    setDeletingWordId(null);
  };

  // Add selected words
  const handleAdd = () => {
    const wordsToAdd = filteredWords.filter(w => selectedWords.has(w.word));
    if (wordsToAdd.length > 0) {
      onAddWords(wordsToAdd);
      setSelectedWords(new Set());
      onClose();
    }
  };

  // Handle close
  const handleClose = () => {
    setSelectedWords(new Set());
    setSearch('');
    setGradeFilter('all');
    setStatusFilter('all');
    setPage(1);
    setActiveTab('grade-words');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Word Catalog"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => handleTabChange('grade-words')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'grade-words'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Grade Words
          </button>
          <button
            onClick={() => handleTabChange('custom-words')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'custom-words'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Sparkles size={14} />
            My Custom Words
            {customWords.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                {customWords.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search words or definitions..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            />
          </div>

          {/* Grade filter - only for grade words tab */}
          {activeTab === 'grade-words' && (
            <select
              value={gradeFilter}
              onChange={e => {
                const value = e.target.value;
                handleGradeChange(value === 'all' ? 'all' : (Number(value) as GradeLevel));
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
            >
              <option value="all">All Grades</option>
              {GRADE_INFO.map(info => (
                <option key={info.grade} value={info.grade}>
                  {info.name} ({info.wordCount})
                </option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
          >
            <option value="all">All Words</option>
            <option value="available">Available Only</option>
            <option value="added">Already Added</option>
          </select>
        </div>

        {/* Selection actions */}
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="text-gray-600">
            Showing {filteredWords.length} words
            {selectedWords.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({selectedWords.size} selected)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAllOnPage}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Select page
            </button>
            {selectedWords.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-gray-500 hover:text-gray-700 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        {/* Word list */}
        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
          {isLoadingCustom && activeTab === 'custom-words' ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 size={24} className="animate-spin mr-2" />
              Loading custom words...
            </div>
          ) : paginatedWords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {activeTab === 'custom-words' && customWords.length === 0 ? (
                <>
                  <Sparkles size={32} className="text-gray-300 mb-2" />
                  <p>No custom words yet</p>
                  <p className="text-sm mt-1">Use "Add Words" to create custom words</p>
                </>
              ) : (
                <p>No words match your filters</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">
                    Word
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-600 hidden sm:table-cell">
                    Grade
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">
                    Definition
                  </th>
                  <th className="w-24 px-3 py-2 text-center text-sm font-medium text-gray-600">
                    Status
                  </th>
                  {activeTab === 'custom-words' && (
                    <th className="w-12 px-3 py-2 text-center text-sm font-medium text-gray-600">

                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedWords.map(word => {
                  const isAdded = existingWords.has(word.word.toLowerCase());
                  const isSelected = selectedWords.has(word.word);
                  const isCustomWord = 'id' in word && 'createdAt' in word;
                  const grade = isCustomWord
                    ? (word as CustomWord).gradeLevel
                    : (word as WordDefinition & { grade: GradeLevel }).grade;

                  return (
                    <tr
                      key={isCustomWord ? (word as CustomWord).id : `${grade}-${word.word}`}
                      onClick={() => toggleWord(word.word)}
                      className={`border-t border-gray-100 cursor-pointer transition-colors
                        ${isAdded ? 'bg-gray-50 cursor-not-allowed' : ''}
                        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center
                            ${isAdded ? 'border-gray-300 bg-gray-200' : ''}
                            ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}
                        >
                          {isSelected && <Check size={14} className="text-white" />}
                          {isAdded && <X size={14} className="text-gray-400" />}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">
                        <span className="flex items-center gap-1.5">
                          {word.word}
                          {isCustomWord && (
                            <Sparkles size={12} className="text-purple-500" />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500 hidden sm:table-cell">
                        Grade {grade}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate">
                        {word.definition}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isAdded ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Added
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Available
                          </span>
                        )}
                      </td>
                      {activeTab === 'custom-words' && isCustomWord && (
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={e => handleDeleteCustomWord(e, (word as CustomWord).id)}
                            disabled={deletingWordId === (word as CustomWord).id}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Delete word"
                          >
                            {deletingWordId === (word as CustomWord).id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="text-sm text-gray-600 px-4">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={selectedWords.size === 0}
          >
            Add {selectedWords.size > 0 ? `${selectedWords.size} ` : ''}
            {selectedWords.size === 1 ? 'Word' : 'Words'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
