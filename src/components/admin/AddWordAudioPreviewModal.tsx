/**
 * Modal for previewing and generating audio after adding a new word
 * Auto-triggers audio generation for all segments (word, definition, sentence)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Check, Play, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { useAdminAudioGenerator } from '@/hooks/useAdminAudioGenerator';
import { getAudioPublicUrl, normalizeWord } from '@/services/audioStorage';
import type { GradeLevel } from '@/data/gradeWords';
import type { AudioSegmentType } from '@/types/audio';

interface AddWordAudioPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: {
    word: string;
    definition: string;
    example?: string;
    gradeLevel: GradeLevel;
  } | null;
}

interface SegmentState {
  type: AudioSegmentType;
  label: string;
  text: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error?: string;
  storagePath?: string;
}

export function AddWordAudioPreviewModal({
  isOpen,
  onClose,
  word,
}: AddWordAudioPreviewModalProps) {
  const [segments, setSegments] = useState<SegmentState[]>([]);
  const [playingSegment, setPlayingSegment] = useState<AudioSegmentType | null>(null);
  const [generationStarted, setGenerationStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentsRef = useRef<SegmentState[]>([]);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const { generateSegment } = useAdminAudioGenerator();

  // Build segment list when modal opens
  useEffect(() => {
    if (isOpen && word) {
      const newSegments: SegmentState[] = [
        {
          type: 'word',
          label: 'Word',
          text: word.word,
          status: 'pending',
        },
        {
          type: 'definition',
          label: 'Definition',
          text: `${word.word}: ${word.definition}`,
          status: 'pending',
        },
      ];

      if (word.example) {
        newSegments.push({
          type: 'sentence',
          label: 'Sentence',
          text: word.example,
          status: 'pending',
        });
      }

      setSegments(newSegments);
      segmentsRef.current = newSegments;
      setGenerationStarted(false);
    }
  }, [isOpen, word]);

  // Generate all segments sequentially
  const generateAllSegments = useCallback(async () => {
    if (!word) return;

    const currentSegments = segmentsRef.current;

    for (let i = 0; i < currentSegments.length; i++) {
      const segment = currentSegments[i];

      // Update status to generating
      setSegments(prev => prev.map((s, idx) =>
        idx === i ? { ...s, status: 'generating' } : s
      ));

      try {
        const result = await generateSegment(word.word, segment.type, segment.text);

        if (result.success) {
          // Get the storage path for playback
          const normalized = normalizeWord(word.word);
          const voiceId = import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
          const storagePath = `${voiceId}/${normalized}/${segment.type}.wav`;

          setSegments(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'complete', storagePath } : s
          ));
        } else {
          setSegments(prev => prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error', error: result.error } : s
          ));
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setSegments(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'error', error: errorMessage } : s
        ));
      }

      // Small delay between segments
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }, [word, generateSegment]);

  // Auto-start generation when modal opens
  useEffect(() => {
    if (isOpen && word && segments.length > 0 && !generationStarted) {
      setGenerationStarted(true);
      generateAllSegments();
    }
  }, [isOpen, word, segments.length, generationStarted, generateAllSegments]);

  // Retry a single failed segment
  const handleRetry = useCallback(async (index: number) => {
    if (!word) return;

    const segment = segmentsRef.current[index];
    if (!segment) return;

    setSegments(prev => prev.map((s, idx) =>
      idx === index ? { ...s, status: 'generating', error: undefined } : s
    ));

    try {
      const result = await generateSegment(word.word, segment.type, segment.text);

      if (result.success) {
        const normalized = normalizeWord(word.word);
        const voiceId = import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
        const storagePath = `${voiceId}/${normalized}/${segment.type}.wav`;

        setSegments(prev => prev.map((s, idx) =>
          idx === index ? { ...s, status: 'complete', storagePath } : s
        ));
      } else {
        setSegments(prev => prev.map((s, idx) =>
          idx === index ? { ...s, status: 'error', error: result.error } : s
        ));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSegments(prev => prev.map((s, idx) =>
        idx === index ? { ...s, status: 'error', error: errorMessage } : s
      ));
    }
  }, [word, generateSegment]);

  // Play a segment
  const handlePlay = useCallback(async (segment: SegmentState) => {
    if (!segment.storagePath || playingSegment) return;

    setPlayingSegment(segment.type);

    try {
      const url = getAudioPublicUrl(segment.storagePath);
      if (url) {
        // Add cache-busting timestamp for freshly generated audio
        const urlWithCacheBust = `${url}?t=${Date.now()}`;

        const audio = new Audio(urlWithCacheBust);
        audioRef.current = audio;

        await audio.play();
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
        });
      }
    } catch (err) {
      console.error('[AudioPreview] Play error:', err);
    } finally {
      setPlayingSegment(null);
      audioRef.current = null;
    }
  }, [playingSegment]);

  // Handle close - stop any playing audio
  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingSegment(null);
    onClose();
  }, [onClose]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen || !word) return null;

  const completedCount = segments.filter(s => s.status === 'complete').length;
  const generatingCount = segments.filter(s => s.status === 'generating').length;
  const totalCount = segments.length;
  const hasErrors = segments.some(s => s.status === 'error');
  const allComplete = completedCount === totalCount;

  // Get status icon for a segment
  const getStatusIcon = (status: SegmentState['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
      case 'generating':
        return <Loader2 size={16} className="animate-spin text-blue-600" />;
      case 'complete':
        return <Check size={16} className="text-green-600" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Volume2 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Audio Generated</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Word info */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Word added:</span>
            <span className="font-semibold text-gray-900">{word.word}</span>
            <span className="text-gray-400">•</span>
            <span>Grade {word.gradeLevel}</span>
          </div>

          {/* Segments list */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Audio Segments</div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {segments.map((segment, index) => (
                <div
                  key={segment.type}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(segment.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {segment.label}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={segment.text}>
                        "{segment.text}"
                      </div>
                      {segment.status === 'error' && segment.error && (
                        <div className="text-xs text-red-600 mt-1">
                          {segment.error}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    {segment.status === 'complete' && (
                      <button
                        onClick={() => handlePlay(segment)}
                        disabled={playingSegment !== null}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                        title="Play"
                      >
                        {playingSegment === segment.type ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Play size={16} />
                        )}
                      </button>
                    )}
                    {segment.status === 'error' && (
                      <button
                        onClick={() => handleRetry(index)}
                        className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors"
                        title="Retry"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    {segment.status === 'pending' && (
                      <span className="text-xs text-gray-400">pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress indicator */}
          <div className="text-sm text-gray-600">
            {generatingCount > 0 ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Generating {completedCount + 1} of {totalCount}...
              </span>
            ) : allComplete ? (
              <span className="text-green-600 flex items-center gap-1">
                <Check size={14} />
                All audio segments ready
              </span>
            ) : hasErrors ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle size={14} />
                {completedCount} of {totalCount} complete - some errors occurred
              </span>
            ) : (
              <span>{completedCount} of {totalCount} complete</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
