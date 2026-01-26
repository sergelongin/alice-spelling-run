/**
 * Expandable row showing word with its audio segments
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Play,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import type { AudioSegmentType, SegmentAudioStatus } from '@/types/audio';
import type { WordDefinition } from '@/data/gradeWords';

interface SegmentRowData {
  type: AudioSegmentType;
  label: string;
  text: string;
  status: SegmentAudioStatus;
}

interface WordSegmentRowProps {
  wordDef: WordDefinition & { grade: number; id?: string };
  segments: {
    word: SegmentAudioStatus;
    definition: SegmentAudioStatus;
    sentence: SegmentAudioStatus;
  };
  onPlaySegment: (word: string, segmentType: AudioSegmentType) => Promise<void>;
  onGenerateSegment: (word: string, segmentType: AudioSegmentType, textContent: string) => Promise<void>;
  onDeleteWord?: (wordId: string) => Promise<void>;
  isPlaying: boolean;
  playingSegment: string | null;
  isGeneratingAny: boolean;
}

function getSegmentReadyCount(segments: WordSegmentRowProps['segments']): number {
  let count = 0;
  if (segments.word.hasAudio) count++;
  if (segments.definition.hasAudio) count++;
  if (segments.sentence.hasAudio) count++;
  return count;
}

function getTotalSegmentCount(hasExample: boolean): number {
  return hasExample ? 3 : 2;
}

export function WordSegmentRow({
  wordDef,
  segments,
  onPlaySegment,
  onGenerateSegment,
  onDeleteWord,
  isPlaying,
  playingSegment,
  isGeneratingAny,
}: WordSegmentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const readyCount = getSegmentReadyCount(segments);
  const totalCount = getTotalSegmentCount(!!wordDef.example);

  const segmentRows: SegmentRowData[] = [
    {
      type: 'word',
      label: 'Word',
      text: wordDef.word,
      status: segments.word,
    },
    {
      type: 'definition',
      label: 'Definition',
      text: `${wordDef.word}: ${wordDef.definition}`,
      status: segments.definition,
    },
  ];

  if (wordDef.example) {
    segmentRows.push({
      type: 'sentence',
      label: 'Sentence',
      text: wordDef.example,
      status: segments.sentence,
    });
  }

  const handleDelete = async () => {
    if (!wordDef.id || !onDeleteWord) return;
    setIsDeleting(true);
    try {
      await onDeleteWord(wordDef.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      {/* Main row */}
      <tr
        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
            <span className="font-medium text-gray-900">{wordDef.word}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-gray-600">Grade {wordDef.grade}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              readyCount === totalCount
                ? 'bg-green-100 text-green-700'
                : readyCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {readyCount}/{totalCount} ready
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {wordDef.id && onDeleteWord && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400 flex items-center gap-1"
                    >
                      {isDeleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Confirm
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete word"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded segment rows */}
      {isExpanded &&
        segmentRows.map((segment) => (
          <tr key={`${wordDef.word}-${segment.type}`} className="bg-gray-50 border-l-4 border-blue-200">
            <td className="px-4 py-2 pl-10" colSpan={2}>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 uppercase">{segment.label}</span>
                <span className="text-sm text-gray-700 line-clamp-1" title={segment.text}>
                  "{segment.text}"
                </span>
              </div>
            </td>
            <td className="px-4 py-2 text-center">
              {segment.status.isGenerating ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">Generating</span>
                </span>
              ) : segment.status.hasAudio ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check size={14} />
                  <span className="text-xs">Ready</span>
                </span>
              ) : segment.status.error ? (
                <span className="inline-flex items-center gap-1 text-red-600" title={segment.status.error}>
                  <X size={14} />
                  <span className="text-xs">Error</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <X size={14} />
                  <span className="text-xs">Missing</span>
                </span>
              )}
            </td>
            <td className="px-4 py-2 text-right">
              <div className="flex items-center justify-end gap-1">
                {segment.status.hasAudio && (
                  <>
                    <button
                      onClick={() => onPlaySegment(wordDef.word, segment.type)}
                      disabled={isPlaying}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="Play"
                    >
                      {playingSegment === `${wordDef.word}:${segment.type}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => onGenerateSegment(wordDef.word, segment.type, segment.text)}
                      disabled={isGeneratingAny}
                      className="p-1 text-gray-500 hover:bg-gray-200 rounded transition-colors"
                      title="Regenerate"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </>
                )}
                {!segment.status.hasAudio && !segment.status.isGenerating && (
                  <button
                    onClick={() => onGenerateSegment(wordDef.word, segment.type, segment.text)}
                    disabled={isGeneratingAny}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Generate
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
    </>
  );
}
