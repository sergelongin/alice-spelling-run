/**
 * Dialog for viewing/editing word details and managing audio segments
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  Play,
  RefreshCw,
  Plus,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { updateWord } from '@/services/wordBankService';
import { RegenerateAudioModal, type RegenerationSettings } from './RegenerateAudioModal';
import type { WordDefinition, GradeLevel } from '@/data/gradeWords';
import type { AudioSegmentType, SegmentAudioStatus } from '@/types/audio';

interface WordWithGrade extends WordDefinition {
  grade: number;
  id?: string;
}

interface AudioGenerationOverrides {
  volume?: number;
  emotion?: string;
  speed?: number;
}

interface PreviewResult {
  blob: Blob;
}

interface PreviewError {
  error: string;
}

interface WordDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  word: WordWithGrade | null;
  wordIndex: number;
  totalWords: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onWordUpdated: () => void;
  segments: {
    word: SegmentAudioStatus;
    definition: SegmentAudioStatus;
    sentence: SegmentAudioStatus;
  };
  onPlaySegment: (word: string, segmentType: AudioSegmentType) => Promise<void>;
  onGenerateSegment: (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    overrides?: AudioGenerationOverrides
  ) => Promise<void>;
  onGeneratePreview: (
    text: string,
    overrides?: AudioGenerationOverrides
  ) => Promise<PreviewResult | PreviewError>;
  onSavePreviewedAudio: (
    word: string,
    segmentType: AudioSegmentType,
    textContent: string,
    blob: Blob,
    overrides?: AudioGenerationOverrides
  ) => Promise<{ success: boolean; error?: string }>;
  isPlaying: boolean;
  playingSegment: string | null;
  isGeneratingAny: boolean;
}

interface SegmentRowData {
  type: AudioSegmentType;
  label: string;
  text: string;
  status: SegmentAudioStatus;
}

function getSegmentReadyCount(
  segments: WordDetailDialogProps['segments'],
  hasExample: boolean
): { ready: number; total: number } {
  let ready = 0;
  const total = hasExample ? 3 : 2;

  if (segments.word.hasAudio) ready++;
  if (segments.definition.hasAudio) ready++;
  if (hasExample && segments.sentence.hasAudio) ready++;

  return { ready, total };
}

export function WordDetailDialog({
  isOpen,
  onClose,
  word,
  wordIndex,
  totalWords,
  onNavigate,
  onWordUpdated,
  segments,
  onPlaySegment,
  onGenerateSegment,
  onGeneratePreview,
  onSavePreviewedAudio,
  isPlaying,
  playingSegment,
  isGeneratingAny,
}: WordDetailDialogProps) {
  // Editable fields
  const [editedDefinition, setEditedDefinition] = useState('');
  const [editedExample, setEditedExample] = useState('');
  const [editedGrade, setEditedGrade] = useState<GradeLevel>(4);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Regeneration modal state
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenSegment, setRegenSegment] = useState<{
    type: AudioSegmentType;
    text: string;
  } | null>(null);

  // Reset edited values when word changes
  useEffect(() => {
    if (word) {
      setEditedDefinition(word.definition);
      setEditedExample(word.example || '');
      setEditedGrade(word.grade as GradeLevel);
      setIsDirty(false);
      setSaveError(null);
    }
  }, [word]);

  // Check if form has changes
  useEffect(() => {
    if (!word) return;

    const hasChanges =
      editedDefinition !== word.definition ||
      editedExample !== (word.example || '') ||
      editedGrade !== word.grade;

    setIsDirty(hasChanges);
  }, [word, editedDefinition, editedExample, editedGrade]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && !e.target?.toString().includes('Input')) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && !e.target?.toString().includes('Input')) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNavigate]);

  const handleSave = useCallback(async () => {
    if (!word?.id || !isDirty) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await updateWord(word.id, {
        definition: editedDefinition,
        example: editedExample || undefined,
        gradeLevel: editedGrade,
      });

      if (result.success) {
        setIsDirty(false);
        onWordUpdated();
      } else {
        setSaveError(result.error || 'Failed to save changes');
      }
    } catch (err) {
      console.error('[WordDetailDialog] Error saving:', err);
      setSaveError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }, [word?.id, isDirty, editedDefinition, editedExample, editedGrade, onWordUpdated]);

  const handleGenerateAllMissing = useCallback(async () => {
    if (!word) return;

    const segmentRows = buildSegmentRows();
    for (const segment of segmentRows) {
      if (!segment.status.hasAudio && !segment.status.isGenerating) {
        await onGenerateSegment(word.word, segment.type, segment.text);
      }
    }
  }, [word, segments, editedDefinition, editedExample, onGenerateSegment]);

  const handleOpenRegenModal = useCallback((segmentType: AudioSegmentType, text: string) => {
    setRegenSegment({ type: segmentType, text });
    setShowRegenModal(true);
  }, []);

  // Generate preview audio (in-memory, no upload)
  const handleGeneratePreview = useCallback(
    async (text: string, settings: RegenerationSettings) => {
      return onGeneratePreview(text, settings);
    },
    [onGeneratePreview]
  );

  // Save the previewed audio blob to storage
  const handleSavePreview = useCallback(
    async (blob: Blob, settings: RegenerationSettings) => {
      if (!word || !regenSegment) return;

      const result = await onSavePreviewedAudio(
        word.word,
        regenSegment.type,
        regenSegment.text,
        blob,
        settings
      );

      if (result.success) {
        setShowRegenModal(false);
        setRegenSegment(null);
      } else {
        throw new Error(result.error || 'Failed to save audio');
      }
    },
    [word, regenSegment, onSavePreviewedAudio]
  );

  if (!isOpen || !word) return null;

  const buildSegmentRows = (): SegmentRowData[] => {
    const rows: SegmentRowData[] = [
      {
        type: 'word',
        label: 'Word',
        text: word.word,
        status: segments.word,
      },
      {
        type: 'definition',
        label: 'Definition',
        text: `${word.word}: ${editedDefinition || word.definition}`,
        status: segments.definition,
      },
    ];

    const sentence = editedExample || word.example;
    if (sentence) {
      rows.push({
        type: 'sentence',
        label: 'Sentence',
        text: sentence,
        status: segments.sentence,
      });
    }

    return rows;
  };

  const segmentRows = buildSegmentRows();
  const { ready, total } = getSegmentReadyCount(segments, !!(editedExample || word.example));
  const hasMissing = ready < total;
  const canEdit = !!word.id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('prev')}
              disabled={wordIndex === 0}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous word (Left Arrow)"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-900">{word.word}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Grade level dropdown */}
            <select
              value={editedGrade}
              onChange={(e) => setEditedGrade(parseInt(e.target.value) as GradeLevel)}
              disabled={!canEdit}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value={3}>Grade 3</option>
              <option value={4}>Grade 4</option>
              <option value={5}>Grade 5</option>
              <option value={6}>Grade 6</option>
            </select>

            <button
              onClick={() => onNavigate('next')}
              disabled={wordIndex >= totalWords - 1}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next word (Right Arrow)"
            >
              <ChevronRight size={20} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Close (Escape)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Read-only notice for local words */}
          {!canEdit && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>This word is from local data and cannot be edited. Add it via Supabase to enable editing.</span>
            </div>
          )}

          {/* Definition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Definition
            </label>
            <textarea
              value={editedDefinition}
              onChange={(e) => setEditedDefinition(e.target.value)}
              disabled={!canEdit}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Example sentence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Example Sentence
            </label>
            <textarea
              value={editedExample}
              onChange={(e) => setEditedExample(e.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="No example sentence"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Save button */}
          {isDirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}

          {/* Audio Segments Section */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-gray-500" />
                <span className="font-medium text-gray-900">Audio Segments</span>
              </div>
              <span
                className={`text-sm font-medium ${
                  ready === total ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {ready}/{total} ready
              </span>
            </div>

            <div className="space-y-2">
              {segmentRows.map((segment) => (
                <div
                  key={segment.type}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {segment.label}
                      </span>
                      {segment.status.isGenerating ? (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-xs">Generating</span>
                        </span>
                      ) : segment.status.hasAudio ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Check size={12} />
                          <span className="text-xs">Ready</span>
                        </span>
                      ) : segment.status.error ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <X size={12} />
                          <span className="text-xs">Error</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <X size={12} />
                          <span className="text-xs">Missing</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 truncate" title={segment.text}>
                      "{segment.text}"
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {segment.status.hasAudio && (
                      <>
                        <button
                          onClick={() => onPlaySegment(word.word, segment.type)}
                          disabled={isPlaying}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          title="Play"
                        >
                          {playingSegment === `${word.word}:${segment.type}` ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenRegenModal(segment.type, segment.text)}
                          disabled={isGeneratingAny}
                          className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                          title="Regenerate with settings"
                        >
                          <RefreshCw size={16} />
                        </button>
                      </>
                    )}
                    {!segment.status.hasAudio && !segment.status.isGenerating && (
                      <button
                        onClick={() => onGenerateSegment(word.word, segment.type, segment.text)}
                        disabled={isGeneratingAny}
                        className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-1"
                      >
                        <Plus size={12} />
                        Generate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Generate all missing button */}
            {hasMissing && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={handleGenerateAllMissing}
                  disabled={isGeneratingAny}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  {isGeneratingAny ? (
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
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => onNavigate('prev')}
            disabled={wordIndex === 0}
            className="px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Prev
          </button>

          <span className="text-sm text-gray-500">
            {wordIndex + 1} of {totalWords}
          </span>

          <button
            onClick={() => onNavigate('next')}
            disabled={wordIndex >= totalWords - 1}
            className="px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Regeneration Settings Modal */}
      {regenSegment && (
        <RegenerateAudioModal
          isOpen={showRegenModal}
          onClose={() => {
            setShowRegenModal(false);
            setRegenSegment(null);
          }}
          onSave={handleSavePreview}
          onGeneratePreview={handleGeneratePreview}
          segmentType={regenSegment.type}
          textContent={regenSegment.text}
        />
      )}
    </div>
  );
}
