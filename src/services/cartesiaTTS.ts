// Cartesia TTS Service
// Uses Cartesia Sonic-3 for natural-sounding text-to-speech
// Streaming via SSE for fast time-to-first-audio

const CARTESIA_SSE_URL = 'https://api.cartesia.ai/tts/sse';
const CARTESIA_BYTES_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2025-04-16';
const DEFAULT_VOICE_ID = '79a125e8-cd45-4c13-8a67-188112f4dd22'; // Friendly female voice
const SAMPLE_RATE = 44100;

// Audio cache to avoid repeat API calls for the same text
const audioCache = new Map<string, string>(); // text -> blob URL
const MAX_CACHE_SIZE = 50; // Limit cache size to prevent memory issues

// Shared AudioContext for streaming playback
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    } catch (e) {
      console.warn('[Cartesia] AudioContext not supported:', e);
      return null;
    }
  }
  return audioContext;
}

// Get configuration from environment
const getApiKey = (): string => {
  return import.meta.env.VITE_CARTESIA_API_KEY || '';
};

const getVoiceId = (): string => {
  return import.meta.env.VITE_CARTESIA_VOICE_ID || DEFAULT_VOICE_ID;
};

const getEmotion = (): string => {
  return import.meta.env.VITE_CARTESIA_EMOTION || 'enthusiastic';
};

const getSpeed = (): number => {
  const speed = parseFloat(import.meta.env.VITE_CARTESIA_SPEED || '1.0');
  // Clamp to valid range 0.6 - 1.5
  return Math.min(1.5, Math.max(0.6, speed));
};

/**
 * Get cache key for a text (includes voice ID, emotion, and speed for uniqueness)
 */
function getCacheKey(text: string): string {
  return `${getVoiceId()}:${getEmotion()}:${getSpeed()}:${text.toLowerCase().trim()}`;
}

/**
 * Check if Cartesia TTS is available (API key is configured)
 */
export function isCartesiaAvailable(): boolean {
  const apiKey = getApiKey();
  const available = !!apiKey;
  console.log('[Cartesia] isCartesiaAvailable:', available);
  return available;
}

/**
 * Play audio from a blob URL
 */
function playAudioFromUrl(audioUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      console.log('[Cartesia] Audio playback complete');
      resolve();
    };

    audio.onerror = (e) => {
      console.error('[Cartesia] Audio playback error:', e);
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch((err) => {
      console.error('[Cartesia] Failed to start playback:', err);
      reject(err);
    });
  });
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert 16-bit PCM bytes to AudioBuffer
 */
function pcmToAudioBuffer(ctx: AudioContext, pcmData: Uint8Array): AudioBuffer {
  // PCM is 16-bit signed little-endian
  const numSamples = pcmData.length / 2;
  const audioBuffer = ctx.createBuffer(1, numSamples, SAMPLE_RATE);
  const channelData = audioBuffer.getChannelData(0);

  const dataView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  for (let i = 0; i < numSamples; i++) {
    // Read 16-bit signed integer, convert to float [-1, 1]
    const sample = dataView.getInt16(i * 2, true); // little-endian
    channelData[i] = sample / 32768;
  }

  return audioBuffer;
}

/**
 * Stream audio from Cartesia SSE endpoint and cache after completion
 * Returns a promise that resolves when audio finishes playing
 */
async function streamAndCacheAudio(
  text: string,
  cacheKey: string,
  apiKey: string,
  voiceId: string,
  emotion: string,
  speed: number
): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) {
    throw new Error('AudioContext not supported');
  }

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  console.log('[Cartesia] Starting SSE stream for:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  const response = await fetch(CARTESIA_SSE_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'Cartesia-Version': CARTESIA_VERSION,
    },
    body: JSON.stringify({
      transcript: text,
      model_id: 'sonic-3',
      voice: {
        mode: 'id',
        id: voiceId,
      },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: SAMPLE_RATE,
      },
      generation_config: {
        speed,
        emotion,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Cartesia] SSE API error:', response.status, errorText);
    throw new Error(`Cartesia SSE API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  const allChunks: Uint8Array[] = [];
  let nextStartTime = ctx.currentTime;
  let lastScheduledEndTime = ctx.currentTime;
  let firstChunkReceived = false;

  try {
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') {
            console.log('[Cartesia] Stream complete');
            continue;
          }

          try {
            const event = JSON.parse(jsonStr);

            if (event.data) {
              // Decode base64 audio chunk
              const audioBytes = base64ToUint8Array(event.data);
              allChunks.push(audioBytes);

              if (!firstChunkReceived) {
                console.log('[Cartesia] First chunk received, starting playback');
                firstChunkReceived = true;
              }

              // Convert to AudioBuffer and schedule playback
              const audioBuffer = pcmToAudioBuffer(ctx, audioBytes);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTime);

              nextStartTime += audioBuffer.duration;
              lastScheduledEndTime = nextStartTime;
            }
          } catch (parseErr) {
            // Ignore parse errors for non-JSON lines
          }
        }
      }
    }

    // Combine all chunks and cache as blob
    if (allChunks.length > 0) {
      const totalLength = allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedPcm = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of allChunks) {
        combinedPcm.set(chunk, offset);
        offset += chunk.length;
      }

      // Create WAV file for caching (so playAudioFromUrl works)
      const wavBlob = createWavBlob(combinedPcm, SAMPLE_RATE);
      const audioUrl = URL.createObjectURL(wavBlob);

      // Manage cache size
      if (audioCache.size >= MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) {
          const oldUrl = audioCache.get(firstKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          audioCache.delete(firstKey);
          console.log('[Cartesia] Cache full, removed oldest entry');
        }
      }

      audioCache.set(cacheKey, audioUrl);
      console.log('[Cartesia] Cached streamed audio, cache size:', audioCache.size);
    }

    // Wait for all scheduled audio to finish
    const remainingTime = lastScheduledEndTime - ctx.currentTime;
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime * 1000));
    }

    console.log('[Cartesia] Streaming playback complete');
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a WAV blob from raw PCM data
 */
function createWavBlob(pcmData: Uint8Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const uint8View = new Uint8Array(buffer);
  uint8View.set(pcmData, headerSize);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Speak text using Cartesia TTS with streaming for fast time-to-first-audio
 * - First play: Streams via SSE for instant playback, caches after completion
 * - Repeat plays: Uses cached audio for instant playback
 * @param text The text to speak
 * @returns Promise that resolves when audio finishes playing
 */
export async function speakWithCartesia(text: string): Promise<void> {
  const apiKey = getApiKey();
  const voiceId = getVoiceId();
  const emotion = getEmotion();
  const speed = getSpeed();

  if (!apiKey) {
    throw new Error('Cartesia API key not configured');
  }

  const cacheKey = getCacheKey(text);

  // Check cache first - instant playback for repeat requests
  const cachedUrl = audioCache.get(cacheKey);
  if (cachedUrl) {
    console.log('[Cartesia] Playing from cache:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
    return playAudioFromUrl(cachedUrl);
  }

  console.log('[Cartesia] No cache, will stream audio for:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  console.log('[Cartesia] Using emotion:', emotion, 'speed:', speed);

  // Try streaming first for faster time-to-first-audio
  try {
    await streamAndCacheAudio(text, cacheKey, apiKey, voiceId, emotion, speed);
    return;
  } catch (streamErr) {
    console.warn('[Cartesia] Streaming failed, falling back to bytes endpoint:', streamErr);
  }

  // Fallback to bytes endpoint if streaming fails
  try {
    const response = await fetch(CARTESIA_BYTES_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Cartesia-Version': CARTESIA_VERSION,
      },
      body: JSON.stringify({
        transcript: text,
        model_id: 'sonic-3',
        voice: {
          mode: 'id',
          id: voiceId,
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: SAMPLE_RATE,
        },
        generation_config: {
          speed,
          emotion,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cartesia] API error:', response.status, errorText);
      throw new Error(`Cartesia API error: ${response.status} - ${errorText}`);
    }

    // Get the audio data as a blob
    const audioBlob = await response.blob();
    console.log('[Cartesia] Received audio:', audioBlob.size, 'bytes');

    // Create blob URL and cache it
    const audioUrl = URL.createObjectURL(audioBlob);

    // Manage cache size - remove oldest entries if at limit
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) {
        const oldUrl = audioCache.get(firstKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        audioCache.delete(firstKey);
        console.log('[Cartesia] Cache full, removed oldest entry');
      }
    }

    // Store in cache (don't revoke URL so it can be reused)
    audioCache.set(cacheKey, audioUrl);
    console.log('[Cartesia] Cached audio, cache size:', audioCache.size);

    return playAudioFromUrl(audioUrl);
  } catch (err) {
    console.error('[Cartesia] Error:', err);
    throw err;
  }
}

/**
 * Cancel any ongoing Cartesia audio playback
 * Note: This is a no-op for now as we'd need to track the audio element
 */
export function cancelCartesiaSpeech(): void {
  // For now, we don't track ongoing audio
  // Could be enhanced to keep a reference to the current audio element
  console.log('[Cartesia] Cancel requested (no-op)');
}

/**
 * Clear the audio cache (useful when changing voices)
 */
export function clearCartesiaCache(): void {
  for (const url of audioCache.values()) {
    URL.revokeObjectURL(url);
  }
  audioCache.clear();
  console.log('[Cartesia] Cache cleared');
}

/**
 * Get current cache size
 */
export function getCartesiaCacheSize(): number {
  return audioCache.size;
}
