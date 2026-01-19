import { useState, useEffect, useCallback, useRef } from 'react';
import { isSpeechSupported, getVoices, speakWord, cancelSpeech } from '@/utils/speech';
import { isCartesiaAvailable, speakWithCartesia, cancelCartesiaSpeech } from '@/services/cartesiaTTS';

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

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice>();
  const [rate, setRate] = useState(options.rate ?? 0.9);

  const isSupported = isSpeechSupported();
  const speakingRef = useRef(false);

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

  const speak = useCallback(async (text: string): Promise<void> => {
    // Check if any TTS is available
    const cartesiaEnabled = isCartesiaAvailable();
    if (!cartesiaEnabled && !isSupported) return;
    if (speakingRef.current) return;

    speakingRef.current = true;
    setIsSpeaking(true);

    try {
      // Use Cartesia if available, otherwise fall back to browser TTS
      if (cartesiaEnabled) {
        await speakWithCartesia(text);
      } else {
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
  }, [isSupported, rate, selectedVoice]);

  const cancel = useCallback(() => {
    cancelSpeech();
    cancelCartesiaSpeech();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoice(voice);
  }, []);

  // TTS is supported if Cartesia is available OR browser TTS is supported
  const ttsSupported = isCartesiaAvailable() || isSupported;

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
