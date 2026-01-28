/**
 * Modal for configuring audio regeneration settings
 * Supports Preview (generate in-memory) then Save (upload) flow
 */

import { useState, useEffect, useRef } from 'react';
import { X, Volume2, Mic, Gauge, Play, Square, Loader2, Check } from 'lucide-react';

export interface RegenerationSettings {
  volume: number;
  emotion: string;
  speed: number;
}

interface RegenerateAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob, settings: RegenerationSettings) => Promise<void>;
  onGeneratePreview: (
    text: string,
    settings: RegenerationSettings
  ) => Promise<{ blob: Blob } | { error: string }>;
  segmentType: 'word' | 'definition' | 'sentence';
  textContent: string;
  currentSettings?: Partial<RegenerationSettings>;
}

// Emotion options optimized for spelling word pronunciation
const EMOTION_OPTIONS = [
  { value: 'neutral', label: 'Neutral', description: 'Flat, declarative statement' },
  { value: 'calm', label: 'Calm', description: 'Steady, no inflection' },
  { value: 'confident', label: 'Confident', description: 'Assertive statement' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic (may add upward inflection)' },
  { value: 'excited', label: 'Excited', description: 'High energy (variable inflection)' },
  { value: 'serious', label: 'Serious', description: 'Formal, grounded tone' },
] as const;

const DEFAULT_SETTINGS: RegenerationSettings = {
  volume: 1.0,
  emotion: 'neutral',
  speed: 0.95,
};

export function RegenerateAudioModal({
  isOpen,
  onClose,
  onSave,
  onGeneratePreview,
  segmentType,
  textContent,
  currentSettings,
}: RegenerateAudioModalProps) {
  const [volume, setVolume] = useState(currentSettings?.volume ?? DEFAULT_SETTINGS.volume);
  const [emotion, setEmotion] = useState(currentSettings?.emotion ?? DEFAULT_SETTINGS.emotion);
  const [speed, setSpeed] = useState(currentSettings?.speed ?? DEFAULT_SETTINGS.speed);

  // Preview state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up blob URL when modal closes or preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPreviewBlob(null);
      setPreviewUrl(null);
      setPreviewError(null);
      setIsGeneratingPreview(false);
      setIsPlayingPreview(false);
      setIsSaving(false);
      setVolume(currentSettings?.volume ?? DEFAULT_SETTINGS.volume);
      setEmotion(currentSettings?.emotion ?? DEFAULT_SETTINGS.emotion);
      setSpeed(currentSettings?.speed ?? DEFAULT_SETTINGS.speed);
    }
  }, [isOpen, currentSettings]);

  // Stop audio when modal closes
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingPreview(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving]);

  if (!isOpen) return null;

  const handlePreview = async () => {
    // Clean up previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewBlob(null);
    setPreviewError(null);
    setIsGeneratingPreview(true);

    const settings: RegenerationSettings = { volume, emotion, speed };
    const result = await onGeneratePreview(textContent, settings);

    setIsGeneratingPreview(false);

    if ('error' in result) {
      setPreviewError(result.error);
      return;
    }

    // Create blob URL for playback
    const blob = result.blob;
    const url = URL.createObjectURL(blob);
    setPreviewBlob(blob);
    setPreviewUrl(url);

    // Auto-play the preview
    playPreview(url);
  };

  const playPreview = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlayingPreview(true);

    audio.onended = () => {
      setIsPlayingPreview(false);
    };
    audio.onerror = () => {
      setIsPlayingPreview(false);
    };

    audio.play().catch(() => {
      setIsPlayingPreview(false);
    });
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!previewBlob) return;

    setIsSaving(true);
    const settings: RegenerationSettings = { volume, emotion, speed };

    try {
      await onSave(previewBlob, settings);
      // onSave should close the modal on success
    } catch (err) {
      console.error('[RegenerateModal] Save error:', err);
      setPreviewError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Clean up
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onClose();
  };

  const segmentLabel = {
    word: 'Word',
    definition: 'Definition',
    sentence: 'Sentence',
  }[segmentType];

  const hasPreview = previewBlob !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Regenerate Audio</h2>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Segment info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              {segmentLabel}
            </div>
            <p className="text-sm text-gray-700">"{textContent}"</p>
          </div>

          {/* Volume slider */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 size={16} className="text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Volume</label>
              <span className="ml-auto text-sm font-mono text-gray-600">{volume.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.5 (Quiet)</span>
              <span>1.0 (Default)</span>
              <span>2.0 (Loud)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Increase to fix quiet audio
            </p>
          </div>

          {/* Emotion dropdown */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mic size={16} className="text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Emotion</label>
            </div>
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {EMOTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Use "neutral" or "calm" to fix questioning tone
            </p>
          </div>

          {/* Speed slider */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={16} className="text-gray-500" />
              <label className="text-sm font-medium text-gray-700">Speed</label>
              <span className="ml-auto text-sm font-mono text-gray-600">{speed.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.6 (Slow)</span>
              <span>1.0 (Normal)</span>
              <span>1.5 (Fast)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Slower = clearer for kids
            </p>
          </div>

          {/* Preview section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePreview}
                disabled={isGeneratingPreview || isSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {isGeneratingPreview ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Preview
                  </>
                )}
              </button>

              {hasPreview && !isGeneratingPreview && (
                <div className="flex items-center gap-2">
                  {isPlayingPreview ? (
                    <button
                      onClick={stopPreview}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Stop"
                    >
                      <Square size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => previewUrl && playPreview(previewUrl)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Play again"
                    >
                      <Play size={16} />
                    </button>
                  )}
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <Check size={14} />
                    Ready
                  </span>
                </div>
              )}
            </div>

            {previewError && (
              <p className="mt-2 text-sm text-red-600">{previewError}</p>
            )}

            {!hasPreview && !isGeneratingPreview && (
              <p className="mt-2 text-xs text-gray-500">
                Click Preview to hear the audio before saving
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasPreview || isSaving || isGeneratingPreview}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors text-sm font-medium flex items-center gap-2"
            title={!hasPreview ? 'Preview the audio first' : undefined}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
