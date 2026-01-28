# Audio System

This document describes how audio pronunciations are generated, stored, and played in Alice Spelling Run.

## Overview

The app uses **Cartesia TTS** (Sonic-3 model) to generate high-quality audio pronunciations for words, definitions, and example sentences. Audio files are stored in **Supabase Storage** and metadata is tracked in the `audio_pronunciations` database table.

### Audio Segment Types

Each word can have up to 3 audio segments:

| Segment | Description | Example |
|---------|-------------|---------|
| `word` | The word itself | "adventure" |
| `definition` | The word's definition | "An exciting experience or undertaking" |
| `sentence` | Example sentence using the word | "The camping trip turned into quite an adventure." |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Interface                          │
│                    (AdminAudioScreen.tsx)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Audio Generation Flow                         │
│                                                                 │
│   1. Generate audio via Cartesia API (cartesiaTTS.ts)          │
│   2. Upload WAV to Supabase Storage (audioStorage.ts)          │
│   3. Store metadata in audio_pronunciations table              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Playback Flow                               │
│                                                                 │
│   1. Check IndexedDB cache (audioCache.ts)                     │
│   2. If miss → Download from Supabase Storage                  │
│   3. Cache in IndexedDB (7-day TTL)                            │
│   4. Play via HTML5 Audio element                              │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Structure

### Supabase Storage Bucket: `pronunciations`

```
pronunciations/
└── words/
    └── {voice_id}/
        └── {word_normalized}/
            ├── word.wav
            ├── definition.wav
            └── sentence.wav
```

**Path format:** `words/{voice_id}/{word_normalized}/{segment_type}.wav`

Example: `words/79a125e8-cd45-4c13-8a67-188112f4dd22/adventure/word.wav`

### Database: `audio_pronunciations` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `word` | TEXT | Original word (display format) |
| `word_normalized` | TEXT | Lowercase, alphanumeric only |
| `voice_id` | TEXT | Cartesia voice ID |
| `emotion` | TEXT | Voice emotion (default: "enthusiastic") |
| `speed` | DECIMAL | Playback speed 0.6-1.5 (default: 1.0) |
| `storage_path` | TEXT | Path in Supabase Storage |
| `file_size_bytes` | INTEGER | Audio file size |
| `duration_ms` | INTEGER | Audio duration |
| `segment_type` | TEXT | 'word', 'definition', or 'sentence' |
| `text_content` | TEXT | The actual text that was spoken |
| `created_at` | TIMESTAMP | Creation timestamp |

**Unique constraints:**
1. `storage_path` - Individual column constraint (used for upsert conflict resolution)
2. `(word_normalized, voice_id, segment_type, emotion, speed)` - Composite constraint

> **Important:** When upserting audio metadata, use `onConflict: 'storage_path'` rather than the composite key. The storage path is deterministically derived from word/voice/segment and doesn't include generation settings (volume/emotion/speed). Using the composite key would cause constraint violations when regenerating audio with different settings, since the storage path remains the same but the composite key changes.

## Key Services

### `cartesiaTTS.ts` - Audio Generation

Generates audio using Cartesia's Sonic-3 model with SSE streaming for fast time-to-first-audio.

```typescript
import { speakWithCartesia, isCartesiaAvailable } from '@/services/cartesiaTTS';

// Check if Cartesia is configured
if (isCartesiaAvailable()) {
  // Play audio (streams and caches automatically)
  await speakWithCartesia("Hello world");
}
```

**Features:**
- SSE streaming for instant playback
- In-memory cache (50 entries max)
- Automatic WAV conversion for caching
- Configurable voice, emotion, and speed

**Environment variables:**
- `VITE_CARTESIA_API_KEY` - Required API key
- `VITE_CARTESIA_VOICE_ID` - Voice to use (default: friendly female)
- `VITE_CARTESIA_EMOTION` - Voice emotion (default: "enthusiastic")
- `VITE_CARTESIA_SPEED` - Playback speed 0.6-1.5 (default: 1.0)

### `audioStorage.ts` - Supabase Storage Operations

Handles upload/download of audio files and metadata management.

```typescript
import {
  uploadSegmentAudio,
  checkAudioAvailability,
  getAudioSegmentsForWords
} from '@/services/audioStorage';

// Check if audio exists
const availability = await checkAudioAvailability('adventure', voiceId, 'word');

// Get all segments for multiple words
const segments = await getAudioSegmentsForWords(['adventure', 'journey'], voiceId);
```

### `audioCache.ts` - IndexedDB Cache

Client-side caching using IndexedDB for offline playback after initial download. Stores actual audio data (ArrayBuffer), not blob URLs.

```typescript
import { getCachedAudio, setCachedAudio } from '@/utils/audioCache';

// Check cache - returns { blobUrl, entry } with a fresh blob URL created from stored data
const cached = await getCachedAudio('adventure', voiceId);
if (cached) {
  await playAudio(cached.blobUrl);
  URL.revokeObjectURL(cached.blobUrl); // Clean up after playback
}

// Store in cache (7-day TTL) - pass the Blob, not a URL
await setCachedAudio('adventure', voiceId, audioBlob, storagePath);
```

**Cache characteristics:**
- Database: `alice-spelling-audio-cache`
- TTL: 7 days
- Stores: `ArrayBuffer` + `mimeType` (not blob URLs)
- Auto-cleanup of expired entries on module load
- Creates fresh blob URLs on retrieval (caller should revoke after use)

### `useSupabaseAudio.ts` - Playback Hook

React hook for playing audio with automatic caching.

```typescript
const { playFromSupabase, isPlaying, cancel } = useSupabaseAudio();

// Play audio (checks cache first, then Supabase)
const success = await playFromSupabase('adventure');
```

## Admin Audio Management

The admin interface (`/admin/audio`) allows super admins to:

1. **View audio status** - See which words have audio for each segment
2. **Generate audio** - Generate missing segments individually or in batch
3. **Filter by grade** - Focus on specific grade levels
4. **Add words** - Add new words with automatic audio generation

### Adding Words (2-Step Wizard)

Adding new words uses a 2-step wizard flow with automatic audio generation:

```
┌─────────────────────────────────────────────────────────────┐
│ Add New Word                                            [X] │
├─────────────────────────────────────────────────────────────┤
│ (1)────────(2)                                              │
│ Enter     Review                                            │
│ Word                                                        │
│                                                             │
│ STEP 1: Word Entry                                          │
│ ┌─────────────────────────────────────────────────────[✓]─┐ │
│ │ beautiful                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ✓ Valid word - definition found                             │
│                                                             │
│                              [Cancel]  [Next →]             │
└─────────────────────────────────────────────────────────────┘
```

**Step 1 (Word Entry):**
- User enters word
- Automatic validation via AI (`generateWordDefinition()`)
- Duplicate check against existing words
- "Next" enabled only when word is valid and unique

```
┌─────────────────────────────────────────────────────────────┐
│ Add New Word                                            [X] │
├─────────────────────────────────────────────────────────────┤
│ (✓)────────(2)                                              │
│ Enter     Review                                            │
│ Word                                                        │
│                                                             │
│ STEP 2: Review                                              │
│ Word: beautiful                                             │
│                                                             │
│ Definition *                              ✨ AI-generated   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Having qualities that give great pleasure              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Example Sentence                          ✨ AI-generated   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ The sunset was beautiful tonight.                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Grade Level: [Grade 4 (ages 9-10)  ▼]                       │
│                                                             │
│              [← Back]  [Cancel]  [Add Word]                 │
└─────────────────────────────────────────────────────────────┘
```

**Step 2 (Review):**
- Shows AI-generated definition, example, and grade level
- All fields are editable before submission
- "Back" preserves the word and returns to Step 1
- "Add Word" saves to database and opens audio preview

### Audio Preview After Word Addition

After adding a word, an audio preview modal automatically opens and generates all segments:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔊 Audio Generated                                      [X] │
├─────────────────────────────────────────────────────────────┤
│ Word added: beautiful • Grade 4                             │
│                                                             │
│ Audio Segments                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ Word       "beautiful"                         [▶]   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ⟳ Definition "beautiful: Having qualities..."          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ○ Sentence   "The sunset was beautiful..."   pending   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⟳ Generating 2 of 3...                                      │
│                                                             │
│                                                   [Done]    │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-triggers generation for all segments (word, definition, sentence) on open
- Shows real-time progress: pending → generating (spinner) → complete (✓) → error
- Play buttons appear for completed segments
- Retry button for failed segments
- "Done" always enabled (non-blocking - generation continues in background)
- Cache-busting URL for freshly generated audio playback

**Components:**
- `AddWordModal` - 2-step wizard for word entry and review
- `AddWordAudioPreviewModal` - Auto-generation and preview modal

### Batch Generation Flow

1. Admin selects grade filter (or "All Grades")
2. Clicks "Generate All Missing"
3. System iterates through words with missing segments
4. For each missing segment:
   - Generate audio via Cartesia
   - Upload WAV to Supabase Storage
   - Create metadata record in database
5. Progress shown in real-time

### Audio Regeneration (Preview → Save Flow)

Admins can regenerate audio for existing segments with different settings:

```
┌─────────────────────────────────────────────────┐
│ Regenerate Audio                            [X] │
├─────────────────────────────────────────────────┤
│ Word: "adventure"                               │
│                                                 │
│ Volume              [======●====] 1.2           │
│ Emotion             [▼ neutral       ]          │
│ Speed               [===●========] 0.95         │
│                                                 │
│ [▶ Preview]     [▶ Play Again]  ✓ Ready         │
│                                                 │
│              [Cancel]  [Save]                   │
│                                                 │
│ (Save only enabled after Preview)               │
└─────────────────────────────────────────────────┘
```

**Flow:**
1. Admin clicks regenerate button on a segment
2. Adjusts settings (volume, emotion, speed)
3. Clicks **Preview** → audio generated in-memory (no upload), plays automatically
4. Can adjust settings and preview again (new blob replaces old)
5. Clicks **Save** → uploads the previewed blob to Supabase
6. Cancel discards preview blob and closes modal

**Key functions:**
- `generatePreview(text, overrides)` - Generates audio blob without uploading
- `uploadPreviewedAudio(word, segmentType, text, blob, overrides)` - Saves previously generated blob

### Cache Busting for Regenerated Audio

When audio is regenerated, the storage URL remains the same (path is derived from word/voice/segment, not settings). Browsers and CDNs may serve cached old audio.

**Solution:** Track regeneration timestamps and append cache-busting query param:

```typescript
// Track recently regenerated segments
const [cacheBustTimestamps, setCacheBustTimestamps] = useState<Map<string, number>>(new Map());

// After regeneration, record timestamp
setCacheBustTimestamps(prev => new Map(prev).set(`${word}:${segmentType}`, Date.now()));

// When playing, add cache buster if recently regenerated
const cacheBustTime = cacheBustTimestamps.get(`${word}:${segmentType}`);
const url = cacheBustTime ? `${baseUrl}?t=${cacheBustTime}` : baseUrl;
```

This is handled in `AdminAudioScreen.tsx` for the admin interface.

## Playback During Gameplay

During spelling practice, audio is played using this priority:

1. **IndexedDB cache** - Instant playback for previously heard words
2. **Supabase Storage** - Download, cache, and play
3. **Cartesia TTS** (fallback) - Generate on-demand if no pre-generated audio

The `useTextToSpeech` hook orchestrates this cascade.

---

## Known Issues & Solutions

### Duplicate Key Constraint Violation on Regeneration

**Error:** `duplicate key value violates unique constraint "audio_pronunciations_storage_path_key"`

**Cause:** The `audio_pronunciations` table has TWO unique constraints:
1. `storage_path UNIQUE` - from migration 001
2. `UNIQUE (word_normalized, voice_id, segment_type, emotion, speed)` - composite

When regenerating with different settings (e.g., volume=1.2 instead of 1.0), the old code used `onConflict: 'word_normalized,voice_id,segment_type,emotion,speed'`. Since the settings changed, PostgreSQL saw no conflict on that composite key and attempted an INSERT. But the storage_path was the same, triggering the constraint violation.

**Solution:** Use `onConflict: 'storage_path'` since it uniquely identifies each segment and is deterministically derived from word/voice/segment (not settings).

### Browser Caching Serves Old Audio After Regeneration

**Symptom:** After regenerating audio with new settings, playback still sounds the same.

**Cause:** Storage path doesn't change on regeneration (e.g., `words/{voice_id}/adventure/word.wav`). Browser/CDN serves cached version.

**Solution:** Add cache-busting timestamp query param when playing recently regenerated segments. See "Cache Busting for Regenerated Audio" section above.

### Retry Status Showing Multiple Times

**Symptom:** "Generating..." status appears 3 times when errors occur.

**Cause:** Retry logic (3 attempts) was setting status to 'generating' on each attempt.

**Solution:** Set 'generating' status once before the retry loop, not inside it. See `generateSegment()` in `useAdminAudioGenerator.ts`.

### Blob URLs Don't Persist Across Page Refreshes

**Error:** `GET blob:http://localhost:5173/... net::ERR_FILE_NOT_FOUND`

**Symptom:** Audio plays fine during a session, but after page refresh cached audio fails with "Audio playback failed" error.

**Cause:** The original cache implementation stored blob URLs (strings like `blob:http://localhost:5173/abc123...`) in IndexedDB. However, blob URLs are session-specific - they only exist for the lifetime of the document that created them. After page refresh, the URL string is still in IndexedDB but the actual blob data it referenced is gone.

**Solution:** Store the actual audio data (`ArrayBuffer`) in IndexedDB instead of blob URLs:

```typescript
// OLD (broken) - stored URL string that becomes invalid
const entry = { blobUrl: URL.createObjectURL(blob), ... };

// NEW (correct) - store actual data
const entry = {
  blobData: await blob.arrayBuffer(),
  mimeType: blob.type,
  ...
};

// On retrieval, create a fresh blob URL
const blob = new Blob([entry.blobData], { type: entry.mimeType });
const blobUrl = URL.createObjectURL(blob);
// ... play audio ...
URL.revokeObjectURL(blobUrl); // Clean up after use
```

**Migration:** The cache includes detection for old-format entries. When an entry with `blobUrl` (string) instead of `blobData` (ArrayBuffer) is found, it's automatically deleted, forcing a fresh download.

**Manual cache clear:** If issues persist, clear the IndexedDB cache in browser DevTools:
```javascript
indexedDB.deleteDatabase('alice-spelling-audio-cache')
```

---

## Future Considerations

### Offline Support

**Goal:** Enable offline gameplay for words in the user's word bank (airplane mode, etc.)

**Current state:**
- IndexedDB cache provides some offline capability (7-day TTL)
- Cache is populated on first playback
- No proactive caching of word bank words

**Planned approach:**

1. **Proactive caching service:**
   ```typescript
   // Sync audio for user's word bank
   async function syncWordBankAudio(wordBank: string[], voiceId: string) {
     for (const word of wordBank) {
       const cached = await getCachedAudio(word, voiceId);
       if (!cached) {
         // Download and cache all segments
         await downloadAndCacheSegments(word, voiceId);
       }
     }
   }
   ```

2. **Background sync:**
   - Use Service Worker for background downloads
   - Sync when on WiFi
   - Show sync status in UI ("Ready for offline: 45/50 words")

3. **Storage management:**
   - Track total cache size
   - Prioritize words by mastery level (struggling words first)
   - Allow manual "Download for offline" action

4. **IndexedDB schema update:**
   - ~~Store actual Blob data instead of blob URLs~~ ✅ Implemented
   - Add segment_type to cache keys
   - Consider storing all 3 segments per word

**Estimated storage:**
- ~50KB per WAV segment (3 seconds at 44.1kHz)
- ~150KB per word (3 segments)
- ~100 words = ~15MB

### React Native Conversion

**Goal:** Package as an iPad application

**Current web-specific APIs:**
- `IndexedDB` → Use `@react-native-async-storage/async-storage` or `expo-file-system`
- `HTMLAudioElement` → Use `expo-av` or `react-native-sound`
- `AudioContext` → Use `expo-av` for audio processing
- `Blob/URL.createObjectURL` → Use file system paths

**Recommended approach:**

1. **Abstract audio playback:**
   ```typescript
   // Platform-agnostic audio interface
   interface AudioPlayer {
     play(source: string | Blob): Promise<void>;
     pause(): void;
     stop(): void;
     isPlaying: boolean;
   }

   // Web implementation
   class WebAudioPlayer implements AudioPlayer { ... }

   // React Native implementation
   class NativeAudioPlayer implements AudioPlayer { ... }
   ```

2. **Abstract caching:**
   ```typescript
   // Platform-agnostic cache interface
   interface AudioCache {
     get(key: string): Promise<CacheEntry | null>;
     set(key: string, data: ArrayBuffer): Promise<void>;
     delete(key: string): Promise<void>;
     clear(): Promise<void>;
   }

   // Web: IndexedDB
   // Native: expo-file-system + AsyncStorage for metadata
   ```

3. **File storage for React Native:**
   ```typescript
   // Store audio files in app documents directory
   const filePath = `${FileSystem.documentDirectory}audio/${word}_${segment}.wav`;
   await FileSystem.downloadAsync(supabaseUrl, filePath);

   // Play from file
   const sound = new Audio.Sound();
   await sound.loadAsync({ uri: filePath });
   await sound.playAsync();
   ```

4. **Offline-first architecture:**
   - Download all word bank audio on first sync
   - Store files permanently (not cache with TTL)
   - Background refresh when connected
   - Show download progress during onboarding

**Migration checklist:**
- [ ] Abstract audio playback (`useAudioPlayer` hook)
- [ ] Abstract caching layer (`AudioCacheProvider`)
- [ ] Replace `fetch` with React Native networking
- [ ] Handle audio focus/interruptions (phone calls, etc.)
- [ ] Add background download capability
- [ ] Handle app backgrounding gracefully

### Multi-Voice Support

**Future consideration:** Different voices for different purposes

- Child-friendly voice for word pronunciation
- Clear/slower voice for definitions
- Expressive voice for example sentences

Would require:
- Voice selection in admin UI
- Multiple voice IDs in configuration
- Per-segment voice assignment
