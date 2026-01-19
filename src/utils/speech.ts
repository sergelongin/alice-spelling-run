export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice;
}

export const isSpeechSupported = (): boolean => {
  return 'speechSynthesis' in window;
};

export const getVoices = (): SpeechSynthesisVoice[] => {
  if (!isSpeechSupported()) return [];
  return speechSynthesis.getVoices();
};

export const getPreferredVoice = (): SpeechSynthesisVoice | undefined => {
  const voices = getVoices();

  // Prefer US English voices
  const usVoice = voices.find(v => v.lang === 'en-US');
  if (usVoice) return usVoice;

  // Fall back to any English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;

  // Use first available voice
  return voices[0];
};

export const speakWord = (
  word: string,
  options: SpeechOptions = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1;

    const voice = options.voice ?? getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    speechSynthesis.speak(utterance);
  });
};

export const cancelSpeech = (): void => {
  if (isSpeechSupported()) {
    speechSynthesis.cancel();
  }
};
