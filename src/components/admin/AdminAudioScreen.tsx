import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Volume2, Loader2, RefreshCw, Filter, Plus, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAdminAudioGenerator } from '@/hooks/useAdminAudioGenerator';
import { useSupabaseAudio } from '@/hooks/useSupabaseAudio';
import {
  getAudioSegmentsForWords,
  getSegmentKey,
  normalizeWord,
  getAudioPublicUrl,
  getSegmentCounts,
} from '@/services/audioStorage';
import { getWordsPaginated, getWordCount } from '@/services/wordBankService';
import type { GradeLevel, WordDefinition } from '@/data/gradeWords';
import type { AudioPronunciation, GradeFilter, AudioSegmentType, SegmentAudioStatus } from '@/types/audio';
import { AudioGenerationProgress } from './AudioGenerationProgress';
import { WordDetailDialog } from './WordDetailDialog';
import { AddWordModal, type AddedWordData } from './AddWordModal';
import { AddWordAudioPreviewModal } from './AddWordAudioPreviewModal';

// Voice ID from environment (same as other audio uses)
const getVoiceId = (): string => {
  return import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
};

interface WordWithGrade extends WordDefinition {
  grade: number;
  id?: string;
}

// Module-level cache for data freshness AND data (survives remounts)
// This prevents refetching when returning to tab triggers auth re-render
// Also restores cached data on remount to prevent empty table flicker
interface WordsCache {
  key: string;
  time: number;
  words: WordWithGrade[];
  totalPages: number;
  totalWords: number;
}
let wordsLoadCache: WordsCache | null = null;
const FRESH_DATA_THRESHOLD = 5000; // 5 seconds

const PAGE_SIZE = 50;

// Helper to get cache key from URL params (for lazy state initialization)
// This allows synchronous cache lookup during useState initialization
function getCacheKeyFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page') || '0', 10);
  const grade = params.get('grade') || 'all';
  const q = params.get('q') || '';
  return `${grade}-${page}-${q}`;
}

export function AdminAudioScreen() {
  // URL search params for persistent state
  const [searchParams, setSearchParams] = useSearchParams();

  // Read from URL params with defaults
  const page = parseInt(searchParams.get('page') || '0', 10);
  const gradeFilter: GradeFilter = (() => {
    const g = searchParams.get('grade');
    if (!g || g === 'all') return 'all';
    const num = parseInt(g, 10);
    return [3, 4, 5, 6].includes(num) ? num as GradeLevel : 'all';
  })();
  const searchQuery = searchParams.get('q') || '';

  // Helper to update URL params
  const updateParams = useCallback((updates: { page?: number; grade?: GradeFilter; q?: string }) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);

      if (updates.page !== undefined) {
        if (updates.page === 0) next.delete('page');
        else next.set('page', String(updates.page));
      }
      if (updates.grade !== undefined) {
        if (updates.grade === 'all') next.delete('grade');
        else next.set('grade', String(updates.grade));
      }
      if (updates.q !== undefined) {
        if (updates.q === '') next.delete('q');
        else next.set('q', updates.q);
      }

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Initialize from cache if available (prevents flash on remount)
  const [words, setWords] = useState<WordWithGrade[]>(() => {
    const key = getCacheKeyFromUrl();
    if (wordsLoadCache && wordsLoadCache.key === key) {
      return wordsLoadCache.words;
    }
    return [];
  });
  const [audioSegments, setAudioSegments] = useState<Map<string, AudioPronunciation>>(new Map());
  // Separate loading states to prevent flash when only audio needs refresh
  const [isLoadingWords, setIsLoadingWords] = useState(() => {
    const key = getCacheKeyFromUrl();
    // Not loading if we have cached data for current URL
    return !(wordsLoadCache && wordsLoadCache.key === key);
  });
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [playingSegment, setPlayingSegment] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [audioPreviewWord, setAudioPreviewWord] = useState<AddedWordData | null>(null);

  // Pagination state (only totalPages/totalWords are local - page is in URL)
  // Also initialize from cache to prevent flash
  const [totalPages, setTotalPages] = useState(() => {
    const key = getCacheKeyFromUrl();
    if (wordsLoadCache && wordsLoadCache.key === key) {
      return wordsLoadCache.totalPages;
    }
    return 0;
  });
  const [totalWords, setTotalWords] = useState(() => {
    const key = getCacheKeyFromUrl();
    if (wordsLoadCache && wordsLoadCache.key === key) {
      return wordsLoadCache.totalWords;
    }
    return 0;
  });

  // Search input state (synced from URL on mount, debounced to URL)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Track last auto-played word to prevent replays
  const lastAutoPlayedWordRef = useRef<string | null>(null);

  // Track recently regenerated segments for cache busting
  // Map of "word:segmentType" -> timestamp
  const [cacheBustTimestamps, setCacheBustTimestamps] = useState<Map<string, number>>(new Map());

  // Global stats (fetched via COUNT queries, not affected by pagination)
  const [globalStats, setGlobalStats] = useState<{
    totalWords: number;
    segmentsReady: number;
    expectedSegments: number;
  }>({ totalWords: 0, segmentsReady: 0, expectedSegments: 0 });

  const {
    generateSegment,
    generateBatchSegments,
    cancelGeneration,
    batchState,
    getSegmentStatus,
    generatePreview,
    uploadPreviewedAudio,
  } = useAdminAudioGenerator();
  const { isPlaying } = useSupabaseAudio();

  // Load global stats (total words and segment counts) - uses COUNT queries
  const loadGlobalStats = useCallback(async () => {
    try {
      const voiceId = getVoiceId();
      const [wordCount, segmentCounts] = await Promise.all([
        getWordCount(),
        getSegmentCounts(voiceId),
      ]);

      // Expected segments = words * 3 (word, definition, sentence)
      // Note: some words may not have example sentences, but we count max potential
      setGlobalStats({
        totalWords: wordCount,
        segmentsReady: segmentCounts.total,
        expectedSegments: wordCount * 3,
      });
    } catch (err) {
      console.error('[AdminAudio] Error loading global stats:', err);
    }
  }, []);

  // Load words from Supabase with pagination and server-side filtering
  const loadWords = useCallback(async (force = false) => {
    const filterKey = `${gradeFilter}-${page}-${searchQuery}`;
    const now = Date.now();

    // Check if we have fresh cached data for this filter key
    // This handles tab-return where auth triggers remount but data is fresh
    if (!force &&
        wordsLoadCache &&
        filterKey === wordsLoadCache.key &&
        now - wordsLoadCache.time < FRESH_DATA_THRESHOLD) {
      // Restore cached data and reset loading state (critical for remount case)
      setWords(wordsLoadCache.words);
      setTotalPages(wordsLoadCache.totalPages);
      setTotalWords(wordsLoadCache.totalWords);
      setIsLoadingWords(false);
      return;
    }

    setIsLoadingWords(true);
    setDataError(null);
    try {
      const result = await getWordsPaginated({
        gradeLevel: gradeFilter === 'all' ? undefined : (gradeFilter as GradeLevel),
        page,
        pageSize: PAGE_SIZE,
        search: searchQuery,
      });

      if (result.total === 0 && gradeFilter === 'all' && !searchQuery) {
        setDataError('No words found. Please ensure Supabase is configured and the words table is populated.');
        setWords([]);
        setTotalPages(0);
        setTotalWords(0);
        return;
      }

      const processedWords = result.words.map(w => ({
        word: w.word,
        definition: w.definition,
        example: w.example || undefined,
        grade: Number(w.grade_level),
        id: w.id,
      }));

      setWords(processedWords);
      setTotalPages(result.totalPages);
      setTotalWords(result.total);

      // Cache the data along with timestamp
      wordsLoadCache = {
        key: filterKey,
        time: Date.now(),
        words: processedWords,
        totalPages: result.totalPages,
        totalWords: result.total,
      };
    } catch (err) {
      console.error('[AdminAudio] Error loading words:', err);
      setDataError('Failed to load words from database.');
      setWords([]);
      setTotalPages(0);
      setTotalWords(0);
    } finally {
      setIsLoadingWords(false);
    }
  }, [gradeFilter, page, searchQuery]);

  // Load audio status from Supabase
  const loadAudioStatus = useCallback(async () => {
    if (words.length === 0) return;

    setIsLoadingAudio(true);
    try {
      const voiceId = getVoiceId();
      const wordStrings = words.map((w) => w.word);
      const segments = await getAudioSegmentsForWords(wordStrings, voiceId);
      setAudioSegments(segments);
    } catch (err) {
      console.error('[AdminAudio] Error loading status:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [words]);

  // Load global stats on mount
  useEffect(() => {
    loadGlobalStats();
  }, [loadGlobalStats]);

  // Load words when component mounts or pagination/filter/search changes
  useEffect(() => {
    loadWords();
  }, [loadWords]);

  // Load audio status when words change
  useEffect(() => {
    loadAudioStatus();
  }, [loadAudioStatus]);

  // Debounce search input to URL
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      if (searchInput !== searchQuery) {
        updateParams({ q: searchInput, page: 0 });
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput, searchQuery, updateParams]);

  // Words are already filtered by server, just sort them for display
  const displayWords = useMemo(() => {
    return [...words].sort((a, b) => a.word.localeCompare(b.word));
  }, [words]);

  // Compute selectedWordData and selectedWordIndex from selectedWord string
  const selectedWordData = selectedWord
    ? displayWords.find(w => w.word === selectedWord) ?? null
    : null;

  const selectedWordIndex = selectedWord
    ? displayWords.findIndex(w => w.word === selectedWord)
    : -1;

  // Auto-play word pronunciation when dialog opens or word changes
  useEffect(() => {
    if (!selectedWord || isPlaying) return;

    // Only auto-play if this is a different word than we last played
    if (lastAutoPlayedWordRef.current === selectedWord) return;

    const normalized = normalizeWord(selectedWord);
    const key = getSegmentKey(normalized, 'word');
    const pronunciation = audioSegments.get(key);

    if (pronunciation) {
      lastAutoPlayedWordRef.current = selectedWord;
      // Small delay to let the dialog render first
      const timeout = setTimeout(() => {
        handlePlaySegment(selectedWord, 'word');
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [selectedWord, audioSegments]);

  // Reset auto-play tracking when dialog closes
  useEffect(() => {
    if (!selectedWord) {
      lastAutoPlayedWordRef.current = null;
    }
  }, [selectedWord]);

  // Get segment status for a word
  const getWordSegments = useCallback(
    (word: string, example?: string): { word: SegmentAudioStatus; definition: SegmentAudioStatus; sentence: SegmentAudioStatus } => {
      const normalized = normalizeWord(word);

      const getStatus = (segType: AudioSegmentType): SegmentAudioStatus => {
        const key = getSegmentKey(normalized, segType);
        const pronunciation = audioSegments.get(key);
        const genStatus = getSegmentStatus(word, segType);

        return {
          hasAudio: !!pronunciation,
          pronunciation,
          isGenerating: genStatus?.status === 'generating' || genStatus?.status === 'uploading',
          error: genStatus?.status === 'error' ? genStatus.error : undefined,
        };
      };

      return {
        word: getStatus('word'),
        definition: getStatus('definition'),
        sentence: example ? getStatus('sentence') : { hasAudio: false },
      };
    },
    [audioSegments, getSegmentStatus]
  );

  // Count segments with/without audio for current page (local stats)
  const pageStats = useMemo(() => {
    let totalSegments = 0;
    let hasAudio = 0;

    for (const word of words) {
      const segments = getWordSegments(word.word, word.example);
      totalSegments += 2; // word + definition always
      if (word.example) totalSegments += 1; // sentence if exists

      if (segments.word.hasAudio) hasAudio++;
      if (segments.definition.hasAudio) hasAudio++;
      if (word.example && segments.sentence.hasAudio) hasAudio++;
    }

    return { totalWords: words.length, totalSegments, hasAudio, missing: totalSegments - hasAudio };
  }, [words, getWordSegments]);

  // Global stats for display (from COUNT queries)
  const stats = useMemo(() => ({
    totalWords: globalStats.totalWords,
    segmentsReady: globalStats.segmentsReady,
    missing: globalStats.expectedSegments - globalStats.segmentsReady,
  }), [globalStats]);

  // Handle playing a segment
  const handlePlaySegment = async (word: string, segmentType: AudioSegmentType) => {
    if (isPlaying) return;

    const normalized = normalizeWord(word);
    const key = getSegmentKey(normalized, segmentType);
    const pronunciation = audioSegments.get(key);

    if (!pronunciation) return;

    setPlayingSegment(`${word}:${segmentType}`);
    try {
      let url = getAudioPublicUrl(pronunciation.storage_path);
      if (url) {
        // Add cache-busting timestamp if segment was recently regenerated
        const cacheBustKey = `${word}:${segmentType}`;
        const cacheBustTime = cacheBustTimestamps.get(cacheBustKey);
        if (cacheBustTime) {
          url = `${url}?t=${cacheBustTime}`;
        }

        const audio = new Audio(url);
        await audio.play();
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
        });
      }
    } finally {
      setPlayingSegment(null);
    }
  };

  // Handle generating a segment
  const handleGenerateSegment = async (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    overrides?: { volume?: number; emotion?: string; speed?: number }
  ) => {
    const result = await generateSegment(word, segmentType, textContent, overrides);
    if (result.success) {
      // Record timestamp for cache busting when playing this segment
      const cacheBustKey = `${word}:${segmentType}`;
      setCacheBustTimestamps((prev) => new Map(prev).set(cacheBustKey, Date.now()));

      await loadAudioStatus();
      await loadGlobalStats();
    }
  };

  // Handle generating a preview (in-memory, no upload)
  const handleGeneratePreview = async (
    text: string,
    overrides?: { volume?: number; emotion?: string; speed?: number }
  ) => {
    return generatePreview(text, overrides);
  };

  // Handle saving a previewed audio blob
  const handleSavePreviewedAudio = async (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    blob: Blob,
    overrides?: { volume?: number; emotion?: string; speed?: number }
  ) => {
    const result = await uploadPreviewedAudio(word, segmentType, textContent, blob, overrides);
    if (result.success) {
      // Record timestamp for cache busting when playing this segment
      const cacheBustKey = `${word}:${segmentType}`;
      setCacheBustTimestamps((prev) => new Map(prev).set(cacheBustKey, Date.now()));

      await loadAudioStatus();
      await loadGlobalStats();
    }
    return result;
  };

  // Handle batch generation (generates for current page only)
  const handleGenerateAllMissing = async () => {
    // Find words with missing segments on current page
    const wordsToGenerate: WordDefinition[] = [];

    for (const word of displayWords) {
      const segments = getWordSegments(word.word, word.example);
      const hasMissing =
        !segments.word.hasAudio ||
        !segments.definition.hasAudio ||
        (word.example && !segments.sentence.hasAudio);

      if (hasMissing) {
        wordsToGenerate.push(word);
      }
    }

    if (wordsToGenerate.length === 0) {
      alert('All segments on this page already have audio!');
      return;
    }

    if (!confirm(`Generate audio for ${wordsToGenerate.length} words (up to ${pageStats.missing} segments) on this page? This may take a while.`)) {
      return;
    }

    await generateBatchSegments(wordsToGenerate);
    await loadAudioStatus();
    await loadGlobalStats();
  };

  // Handle word added
  const handleWordAdded = (wordData: AddedWordData) => {
    loadWords(true); // Force refresh to include the new word
    loadGlobalStats();
    setAudioPreviewWord(wordData); // Open audio preview modal
  };

  // Handle refresh
  const handleRefresh = () => {
    loadWords(true); // Force refresh bypasses freshness check
    loadGlobalStats();
  };

  // Get ready count for a word's segments
  const getReadyCount = (word: WordWithGrade): { ready: number; total: number } => {
    const segments = getWordSegments(word.word, word.example);
    const total = word.example ? 3 : 2;
    let ready = 0;
    if (segments.word.hasAudio) ready++;
    if (segments.definition.hasAudio) ready++;
    if (word.example && segments.sentence.hasAudio) ready++;
    return { ready, total };
  };

  // Handle dialog navigation
  const handleDialogNavigate = (direction: 'prev' | 'next') => {
    if (selectedWordIndex === -1) return;
    if (direction === 'prev' && selectedWordIndex > 0) {
      setSelectedWord(displayWords[selectedWordIndex - 1].word);
    } else if (direction === 'next' && selectedWordIndex < displayWords.length - 1) {
      setSelectedWord(displayWords[selectedWordIndex + 1].word);
    }
  };

  const gradeOptions: Array<{ value: GradeFilter; label: string }> = [
    { value: 'all', label: 'All Grades' },
    { value: 3, label: 'Grade 3' },
    { value: 4, label: 'Grade 4' },
    { value: 5, label: 'Grade 5' },
    { value: 6, label: 'Grade 6' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Volume2 className="text-blue-600" />
          Audio Pronunciation Management
        </h1>
        <p className="text-gray-600 mt-1">
          Generate and manage pronunciations for words, definitions, and example sentences
        </p>
      </div>

      {/* Stats and filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-500">Words</span>
              <p className="text-2xl font-bold text-gray-900">{stats.totalWords}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Segments Ready</span>
              <p className="text-2xl font-bold text-green-600">{stats.segmentsReady}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Missing</span>
              <p className="text-2xl font-bold text-amber-600">{stats.missing}</p>
            </div>
            {!dataError && words.length > 0 && (
              <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                Supabase
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Add word button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={16} />
              Add Word
            </button>

            {/* Search input */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search words..."
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
              />
            </div>

            {/* Grade filter */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={gradeFilter}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : (parseInt(e.target.value) as GradeLevel);
                  updateParams({ grade: val, page: 0 });
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {gradeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isLoadingWords}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className={isLoadingWords || isLoadingAudio ? 'animate-spin' : ''} />
            </button>

            {/* Generate all button */}
            <button
              onClick={handleGenerateAllMissing}
              disabled={batchState.isGenerating || pageStats.missing === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              {batchState.isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 size={16} />
                  Generate Missing
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            <span className="font-medium">Data Error</span>
          </div>
          <p className="mt-1 text-sm text-red-600">{dataError}</p>
        </div>
      )}

      {/* Batch generation progress */}
      {(batchState.isGenerating || batchState.totalWords > 0) && (
        <div className="mb-6">
          <AudioGenerationProgress state={batchState} onCancel={cancelGeneration} />
        </div>
      )}

      {/* Word list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Word</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Grade</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingWords ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : displayWords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {dataError ? 'Unable to load words' : searchQuery ? 'No words match your search' : 'No words found'}
                  </td>
                </tr>
              ) : (
                displayWords.map((wordDef) => {
                  const { ready, total } = getReadyCount(wordDef);
                  return (
                    <tr
                      key={wordDef.word}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedWord(wordDef.word)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{wordDef.word}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">Grade {wordDef.grade}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            ready === total
                              ? 'bg-green-100 text-green-700'
                              : ready > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ready}/{total} ready
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-400">Click to view</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              Page {page + 1} of {totalPages} ({totalWords} words{searchQuery && ` matching "${searchQuery}"`})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateParams({ page: Math.max(0, page - 1) })}
                disabled={page === 0 || isLoadingWords}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-600 min-w-[60px] text-center">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => updateParams({ page: Math.min(totalPages - 1, page + 1) })}
                disabled={page >= totalPages - 1 || isLoadingWords}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Word Modal */}
      <AddWordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onWordAdded={handleWordAdded}
        defaultGrade={gradeFilter === 'all' ? 4 : gradeFilter}
      />

      {/* Audio Preview Modal (after adding a word) */}
      <AddWordAudioPreviewModal
        isOpen={audioPreviewWord !== null}
        onClose={() => {
          setAudioPreviewWord(null);
          loadAudioStatus(); // Refresh audio status in table
        }}
        word={audioPreviewWord}
      />

      {/* Word Detail Dialog */}
      <WordDetailDialog
        isOpen={selectedWord !== null}
        onClose={() => {
          setSelectedWord(null);
          loadAudioStatus(); // Refresh table when dialog closes
        }}
        word={selectedWordData}
        wordIndex={selectedWordIndex !== -1 ? selectedWordIndex : 0}
        totalWords={displayWords.length}
        onNavigate={handleDialogNavigate}
        onWordUpdated={() => {
          loadWords();
        }}
        segments={
          selectedWordData
            ? getWordSegments(selectedWordData.word, selectedWordData.example)
            : { word: { hasAudio: false }, definition: { hasAudio: false }, sentence: { hasAudio: false } }
        }
        onPlaySegment={handlePlaySegment}
        onGenerateSegment={handleGenerateSegment}
        onGeneratePreview={handleGeneratePreview}
        onSavePreviewedAudio={handleSavePreviewedAudio}
        isPlaying={isPlaying}
        playingSegment={playingSegment}
        isGeneratingAny={batchState.isGenerating}
      />
    </div>
  );
}
