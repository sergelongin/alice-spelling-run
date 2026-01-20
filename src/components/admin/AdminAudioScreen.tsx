import { useState, useEffect, useMemo } from 'react';
import { Volume2, Check, X, Loader2, RefreshCw, Play, Filter } from 'lucide-react';
import { useAdminAudioGenerator } from '@/hooks/useAdminAudioGenerator';
import { useSupabaseAudio } from '@/hooks/useSupabaseAudio';
import { getAudioForWords, normalizeWord } from '@/services/audioStorage';
import { GRADE_WORDS, type GradeLevel, type WordDefinition } from '@/data/gradeWords';
import type { AudioPronunciation, GradeFilter, WordAudioStatus } from '@/types/audio';
import { AudioGenerationProgress } from './AudioGenerationProgress';

// Voice ID from environment (same as other audio uses)
const getVoiceId = (): string => {
  return import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
};

export function AdminAudioScreen() {
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [audioStatus, setAudioStatus] = useState<Map<string, AudioPronunciation>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  const { generateWord, generateBatch, cancelGeneration, batchState, getWordStatus } =
    useAdminAudioGenerator();
  const { playFromSupabase, isPlaying } = useSupabaseAudio();

  // Get all words with their grades
  const allWords = useMemo<Array<WordDefinition & { grade: GradeLevel }>>(() => {
    const words: Array<WordDefinition & { grade: GradeLevel }> = [];
    for (const grade of [3, 4, 5, 6] as GradeLevel[]) {
      const gradeWords = GRADE_WORDS[grade] || [];
      for (const word of gradeWords) {
        words.push({ ...word, grade });
      }
    }
    // Sort alphabetically
    return words.sort((a, b) => a.word.localeCompare(b.word));
  }, []);

  // Filter words by grade
  const filteredWords = useMemo(() => {
    if (gradeFilter === 'all') return allWords;
    return allWords.filter((w) => w.grade === gradeFilter);
  }, [allWords, gradeFilter]);

  // Load audio status from Supabase
  const loadAudioStatus = async () => {
    setIsLoading(true);
    try {
      const voiceId = getVoiceId();
      const wordStrings = allWords.map((w) => w.word);
      const status = await getAudioForWords(wordStrings, voiceId);
      setAudioStatus(status);
    } catch (err) {
      console.error('[AdminAudio] Error loading status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudioStatus();
  }, []);

  // Get word audio status
  const getWordAudioStatus = (word: string): WordAudioStatus => {
    const normalized = normalizeWord(word);
    const pronunciation = audioStatus.get(normalized);
    const wordDef = allWords.find((w) => w.word === word);
    return {
      word,
      grade: wordDef?.grade || 3,
      hasAudio: !!pronunciation,
      pronunciation,
    };
  };

  // Count words with/without audio
  const stats = useMemo(() => {
    const total = filteredWords.length;
    let hasAudio = 0;
    for (const word of filteredWords) {
      if (audioStatus.has(normalizeWord(word.word))) {
        hasAudio++;
      }
    }
    return { total, hasAudio, missing: total - hasAudio };
  }, [filteredWords, audioStatus]);

  // Handle single word generation
  const handleGenerateWord = async (word: string) => {
    const result = await generateWord(word);
    if (result.success) {
      // Refresh audio status
      loadAudioStatus();
    }
  };

  // Handle batch generation
  const handleGenerateAll = async () => {
    const missingWords = filteredWords
      .filter((w) => !audioStatus.has(normalizeWord(w.word)))
      .map((w) => w.word);

    if (missingWords.length === 0) {
      alert('All words already have audio!');
      return;
    }

    if (!confirm(`Generate audio for ${missingWords.length} words? This may take a while.`)) {
      return;
    }

    await generateBatch(missingWords);
    loadAudioStatus();
  };

  // Handle playing audio
  const handlePlayWord = async (word: string) => {
    if (isPlaying) return;
    setPlayingWord(word);
    try {
      await playFromSupabase(word);
    } finally {
      setPlayingWord(null);
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
          Generate and manage pre-recorded pronunciations for spelling words
        </p>
      </div>

      {/* Stats and filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-500">Total Words</span>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">With Audio</span>
              <p className="text-2xl font-bold text-green-600">{stats.hasAudio}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Missing</span>
              <p className="text-2xl font-bold text-amber-600">{stats.missing}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Grade filter */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={gradeFilter}
                onChange={(e) =>
                  setGradeFilter(
                    e.target.value === 'all' ? 'all' : (parseInt(e.target.value) as GradeLevel)
                  )
                }
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
              onClick={loadAudioStatus}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Generate all button */}
            <button
              onClick={handleGenerateAll}
              disabled={batchState.isGenerating || stats.missing === 0}
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
                  Generate All Missing
                </>
              )}
            </button>
          </div>
        </div>
      </div>

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
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading audio status...
                  </td>
                </tr>
              ) : filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No words found
                  </td>
                </tr>
              ) : (
                filteredWords.map((wordDef) => {
                  const status = getWordAudioStatus(wordDef.word);
                  const genStatus = getWordStatus(wordDef.word);
                  const isGenerating =
                    genStatus?.status === 'generating' || genStatus?.status === 'uploading';

                  return (
                    <tr key={wordDef.word} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{wordDef.word}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">Grade {wordDef.grade}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status.hasAudio ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <Check size={16} />
                            <span className="text-sm">Ready</span>
                          </span>
                        ) : isGenerating ? (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm">
                              {genStatus?.status === 'uploading' ? 'Uploading' : 'Generating'}
                            </span>
                          </span>
                        ) : genStatus?.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-red-600" title={genStatus.error}>
                            <X size={16} />
                            <span className="text-sm">Error</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <X size={16} />
                            <span className="text-sm">Missing</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status.hasAudio && (
                            <button
                              onClick={() => handlePlayWord(wordDef.word)}
                              disabled={isPlaying}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Play"
                            >
                              {playingWord === wordDef.word ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Play size={16} />
                              )}
                            </button>
                          )}
                          {!status.hasAudio && !isGenerating && (
                            <button
                              onClick={() => handleGenerateWord(wordDef.word)}
                              disabled={batchState.isGenerating}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                            >
                              Generate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
