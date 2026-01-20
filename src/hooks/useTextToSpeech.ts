import { useState, useEffect, useCallback, useRef } from 'react';
import { isSpeechSupported, getVoices, speakWord, cancelSpeech } from '@/utils/speech';
import { isCartesiaAvailable, speakWithCartesia, cancelCartesiaSpeech } from '@/services/cartesiaTTS';
import { isSupabaseConfigured } from '@/lib/supabase';
import { checkAudioAvailability, downloadAudio } from '@/services/audioStorage';
import { getCachedAudio, setCachedAudio } from '@/utils/audioCache';

interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => Promise<void>;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | undefined;
  setVoice: (voice: SpeechSynthesisVoice) => void;
  setRate: (rate: number) => void;
}

// Voice ID from environment (same as Cartesia uses)
const getVoiceId = (): string => {
  return import.meta.env.VITE_CARTESIA_VOICE_ID || '79a125e8-cd45-4c13-8a67-188112f4dd22';
};

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice>();
  const [rate, setRate] = useState(options.rate ?? 0.9);

  const isSupported = isSpeechSupported();
  const speakingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load voices when available
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = getVoices();
      setVoices(availableVoices);

      // Set default voice if not already set
      if (!selectedVoice && availableVoices.length > 0) {
        const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
        setSelectedVoice(englishVoice || availableVoices[0]);
      }
    };

    loadVoices();

    // Voices may load asynchronously
    speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, selectedVoice]);

  /**
   * Play audio from a URL
   */
  const playAudioFromUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        audioRef.current = null;
        resolve();
      };

      audio.onerror = (e) => {
        audioRef.current = null;
        reject(new Error(`Audio playback failed: ${e}`));
      };

      audio.play().catch((err) => {
        audioRef.current = null;
        reject(err);
      });
    });
  }, []);

  /**
   * Try to play audio from Supabase (cached or downloaded)
   */
  const trySupabaseAudio = useCallback(async (text: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const voiceId = getVoiceId();

    try {
      // 1. Check IndexedDB cache first
      const cached = await getCachedAudio(text, voiceId);
      if (cached?.blobUrl) {
        console.log('[TTS] Playing from IndexedDB cache:', text);
        await playAudioFromUrl(cached.blobUrl);
        return true;
      }

      // 2. Check Supabase for pre-generated audio
      const availability = await checkAudioAvailability(text, voiceId);
      if (!availability.exists || !availability.pronunciation) {
        return false;
      }

      // 3. Download and cache the audio
      const storagePath = availability.pronunciation.storage_path;
      const blob = await downloadAudio(storagePath);

      if (!blob) {
        console.error('[TTS] Failed to download from Supabase:', text);
        return false;
      }

      // Create blob URL and cache it
      const blobUrl = URL.createObjectURL(blob);
      await setCachedAudio(text, voiceId, blobUrl, storagePath);

      // Play the audio
      console.log('[TTS] Playing downloaded Supabase audio:', text);
      await playAudioFromUrl(blobUrl);
      return true;

    } catch (err) {
      console.error('[TTS] Supabase audio error:', err);
      return false;
    }
  }, [playAudioFromUrl]);

  const speak = useCallback(async (text: string): Promise<void> => {
    // Check if any TTS is available
    const cartesiaEnabled = isCartesiaAvailable();
    const supabaseEnabled = isSupabaseConfigured();

    if (!cartesiaEnabled && !supabaseEnabled && !isSupported) return;
    if (speakingRef.current) return;

    speakingRef.current = true;
    setIsSpeaking(true);

    try {
      // Priority 1: Try Supabase (cached or pre-generated)
      if (supabaseEnabled) {
        const playedFromSupabase = await trySupabaseAudio(text);
        if (playedFromSupabase) {
          return;
        }
        console.log('[TTS] No Supabase audio, falling back...');
      }

      // Priority 2: Use Cartesia if available
      if (cartesiaEnabled) {
        await speakWithCartesia(text);
        return;
      }

      // Priority 3: Fall back to browser TTS
      if (isSupported) {
        await speakWord(text, {
          rate,
          voice: selectedVoice,
        });
      }
    } catch (err) {
      console.error('[TTS] Error speaking:', err);

      // If Cartesia fails, try falling back to browser TTS
      if (cartesiaEnabled && isSupported) {
        console.log('[TTS] Falling back to browser TTS');
        try {
          await speakWord(text, { rate, voice: selectedVoice });
        } catch (fallbackErr) {
          console.error('[TTS] Fallback also failed:', fallbackErr);
        }
      }
    } finally {
      speakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isSupported, rate, selectedVoice, trySupabaseAudio]);

  const cancel = useCallback(() => {
    cancelSpeech();
    cancelCartesiaSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
  }, []);

  // TTS is supported if Supabase, Cartesia, or browser TTS is available
  const ttsSupported = isSupabaseConfigured() || isCartesiaAvailable() || isSupported;

  return {
    speak,
    cancel,
    isSpeaking,
    isSupported: ttsSupported,
    voices,
    selectedVoice,
    setVoice,
    setRate,
  };
}
