# Alice Spelling Run - Implementation Plan

## Overview
An interactive spelling game for kids ages 9-12 where players run from a lion by spelling words correctly.

## Technology Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State**: React Context + localStorage persistence

### Key Libraries
| Library | Purpose |
|---------|---------|
| `react-confetti-explosion` | Confetti celebration effect |
| `react-router-dom` | Page navigation |
| `lucide-react` | Icons (hearts, speaker, etc.) |

### External APIs
| Service | Purpose |
|---------|---------|
| **Cartesia Sonic-3** | Natural TTS with SSE streaming |
| **OpenAI / Anthropic / Groq** | LLM-powered spelling hints |

## Project Structure

```
├── public/
│   └── assets/sprites/         # Sprite sheets & images
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root + routing
│   ├── components/
│   │   ├── common/             # Button, Modal, ProgressBar, Heart
│   │   ├── game/               # GameCanvas, PlayerSprite, LionSprite,
│   │   │                       # WordInput, CharacterSlot, TimerDisplay,
│   │   │                       # LivesDisplay, CompletedWordsList,
│   │   │                       # RepeatButton, ConfettiEffect
│   │   ├── screens/            # Home, WordBank, Game, GameOver,
│   │   │                       # Victory, Statistics
│   │   └── layout/             # Header, Layout
│   ├── hooks/
│   │   ├── useLocalStorage.ts  # Persistent state
│   │   ├── useTextToSpeech.ts  # Web Speech API wrapper
│   │   ├── useGameTimer.ts     # 30-second countdown
│   │   ├── useGameState.ts     # Core game state machine
│   │   └── useKeyboardInput.ts # Keyboard handling
│   ├── context/
│   │   └── GameContext.tsx     # Word bank + stats persistence
│   ├── types/
│   │   ├── game.ts             # GameState, GameResult, TrophyTier
│   │   ├── word.ts             # Word, WordBank
│   │   └── statistics.ts       # GameStatistics
│   ├── utils/
│   │   ├── speech.ts           # TTS utilities
│   │   ├── wordSelection.ts    # Spaced repetition word selection (Leitner system)
│   │   ├── sessionSummary.ts   # Find-a-win closure system
│   │   └── trophyCalculation.ts
│   ├── data/
│   │   └── defaultWords.ts     # Starter word list
│   └── styles/
│       └── animations.css      # Sprite keyframes
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Core Game Mechanics

### Game State Machine
```
IDLE -> PLAYING -> CORRECT | WRONG | TIME_UP
                      |        |         |
                 [confetti] [highlight] [lose life]
                      |        |         |
                 [next word] <-[retry]<- [check lives]
                      |                    |
              [VICTORY if done]    [GAME_OVER if 0]
```

### Trophy System (5 tiers)
| Lives Remaining | Trophy |
|-----------------|--------|
| 5 | Platinum |
| 4 | Gold |
| 3 | Silver |
| 2 | Bronze |
| 1 | Participant |

## Animation Approach

### Chase Scene
- Player fixed at 70% from left of screen
- Lion position calculated from timer: `lionDistance = (timeRemaining / 30) * 100%`
- CSS sprite sheet animations for running characters
- Parallax scrolling background (savanna theme)

### Sprite Sheets Needed
| Asset | Dimensions | Frames | Description |
|-------|-----------|--------|-------------|
| alice-run.png | 512x64 | 8 | Player running |
| lion-run.png | 640x80 | 8 | Lion chasing |
| background.png | 1920x400 | 1 | Parallax BG |
| ground.png | 128x64 | 1 | Ground texture |
| trophies/*.png | 128x128 | 5 | One per tier |

## Text-to-Speech
- **Primary**: Cartesia Sonic-3 with SSE streaming (see Phase 4)
- **Fallback**: Web Speech API (`speechSynthesis`)
- Configurable emotion and speed via .env
- Audio caching for repeat plays

## Data Persistence (localStorage)

### Word Bank
```typescript
interface WordBank {
  words: Word[];
  lastUpdated: string;
}
```

### Statistics
```typescript
interface GameStatistics {
  totalGamesPlayed: number;
  totalWins: number;
  totalWordsAttempted: number;
  totalWordsCorrect: number;
  trophyCounts: Record<TrophyTier, number>;
  gameHistory: GameResult[];
}
```

## Screen Descriptions

### HomeScreen
- Large "Start Game" button
- Links to Word Bank and Statistics
- Shows word count and quick stats

### WordBankScreen
- Text input to add words
- List of words with delete buttons
- Search/filter functionality
- "Import default words" option

### GameScreen Layout
```
+------------------------------------------+
| Lives: [heart][heart][heart][heart][heart] |
| Timer: [==========] 25s                    |
+------------------------------------------+
|                                          |
|     [PLAYER SPRITE]     [LION SPRITE]    |
|   ====================================   |
|                                          |
+------------------------------------------+
| Word: _ _ _ _ _ _ _                      |
|                                          |
| [Type here...]         | Completed:     |
|                        | - apple        |
| [Repeat Word]          | - banana       |
+------------------------------------------+
```

### VictoryScreen
- Trophy display (animated)
- "Great job!" message
- Stats: words completed, lives remaining
- Play Again / Home buttons

### GameOverScreen (now "Race Results")
- Positive "Race Results" framing (no shame messaging)
- Words spelled correctly as hero metric
- "Today's Wins" section showing achievements (first-time words, streaks, improvements)
- "Beat Your Record?" / Home buttons

## Asset Strategy

**Approach**: Find free game assets from OpenGameArt.org and itch.io

### Assets to Source
1. **Running character sprite sheet** - Look for kid/adventurer running animation
2. **Lion sprite sheet** - Running/chasing animation
3. **Savanna/grassland background** - Parallax-ready layers
4. **Trophy icons** - 5 distinct trophy designs or create from medal/cup assets
5. **Heart icons** - For lives display (or use lucide-react icons)

### Backup Plan
If suitable free assets aren't found, start with simple CSS-animated shapes that can be replaced later.

---

# Phase 2: Three Game Modes Evolution

## Overview

Evolve the game from a single mode to three distinct game modes:

| Mode | Description | Key Features |
|------|-------------|--------------|
| **Meadow Mode** | Relaxed practice | No timer, no chase, Wordle-style feedback, unlimited attempts |
| **Savannah Run** | Current mode | Lion chase, 30s timer, 5 lives, trophies |
| **Wildlands League** | Async multiplayer | Daily/weekly challenges, leaderboards, score competition |

## User Preferences
- Multiplayer: **Asynchronous online** (leaderboards, not real-time)
- Statistics: **Separate stats per mode**
- Practice feedback: **Wordle-style** (green/yellow/gray letters)

---

## Architecture Approach

**Configuration-driven design**: Single `GameScreen` adapts behavior based on `GameModeConfig` object.

```
HomeScreen (Mode Selection)
    |
    +-- Meadow Mode --> /game?mode=meadow --> PracticeCompleteScreen
    +-- Savannah Run --> /game?mode=savannah --> Victory/GameOver
    +-- Wildlands League --> /wildlands (hub) --> /game?mode=wildlands --> Leaderboard
```

---

## Implementation Phases

### Phase 2.1: Type System & Foundation
**Goal**: Add mode infrastructure without breaking existing game

**New Files:**
- `/src/types/gameMode.ts` - Mode configurations

```typescript
export type GameModeId = 'meadow' | 'savannah' | 'wildlands';

export interface GameModeConfig {
  id: GameModeId;
  name: string;
  description: string;
  hasTimer: boolean;
  timePerWord: number;
  hasLives: boolean;
  initialLives: number;
  hasLionChase: boolean;
  feedbackStyle: 'simple' | 'wordle';
  unlimitedAttempts: boolean;
  awardsTrophies: boolean;
}

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  meadow: { /* no timer, no lives, wordle feedback */ },
  savannah: { /* current settings */ },
  wildlands: { /* timer + lives + challenge words */ },
};
```

**Modify:**
- `/src/types/game.ts` - Add `mode: GameModeId` to `GameResult`
- `/src/types/statistics.ts` - Add per-mode stats structure with migration
- `/src/types/index.ts` - Export new types

---

### Phase 2.2: Mode Selection UI
**Goal**: Users can choose game mode from HomeScreen

**New Files:**
- `/src/components/common/ModeSelectionCard.tsx`

**Modify:**
- `/src/components/screens/HomeScreen.tsx` - Replace single button with mode cards
- `/src/App.tsx` - Update routes
- `/src/components/screens/GameScreen.tsx` - Read mode from route, load config

---

### Phase 2.3: Meadow Mode (Practice)
**Goal**: Fully functional relaxed practice mode

**Features:**
- No timer, no lives, no lion chase
- Wordle-style letter feedback (green/yellow/gray)
- Unlimited attempts per word
- LLM-powered spelling hints (after 2 wrong attempts)
- Progressive context disclosure (definition → full sentence)
- Manual "More Context" button
- Context and AI hints work together
- Skip word option

**New Files:**
- `/src/components/game/MeadowCanvas.tsx` - Peaceful meadow scene (flowers, butterflies, Alice standing)
- `/src/utils/wordleFeedback.ts` - Compute green/yellow/gray feedback
- `/src/components/screens/PracticeCompleteScreen.tsx` - Session summary (no win/lose)

**Modify:**
- `/src/components/game/CharacterSlot.tsx` - Add Wordle color states
- `/src/components/game/WordInput.tsx` - Display Wordle feedback for attempts
- `/src/hooks/useGameState.ts` - Handle unlimited attempts, skip lives logic
- `/src/components/screens/GameScreen.tsx` - Conditionally render MeadowCanvas

**Wordle Feedback Logic:**
```typescript
// Green = correct letter, correct position
// Yellow = correct letter, wrong position
// Gray = letter not in word
function computeWordleFeedback(guess: string, target: string): LetterFeedback[]
```

---

### Phase 2.4: Per-Mode Statistics
**Goal**: Separate stats tracking with mode filter

**Modify:**
- `/src/context/GameContext.tsx`:
  - Update `recordGame(result, mode)` to route to mode-specific bucket
  - Add `recordPracticeSession()` for Meadow (tracks words, no wins)
  - Migration logic for existing localStorage data
- `/src/components/screens/StatisticsScreen.tsx` - Add mode tabs
- `/src/components/screens/VictoryScreen.tsx` - Mode-aware messaging
- `/src/components/screens/GameOverScreen.tsx` - Mode-aware messaging

**Statistics Structure:**
```typescript
interface GameStatistics {
  modeStats: Record<GameModeId, ModeStatistics>;
  wordAccuracy: Record<string, { attempts: number; correct: number }>; // shared
  // Legacy fields for backward compatibility
}
```

---

### Phase 2.5: Wildlands League - Frontend
**Goal**: Frontend ready with mock data

**New Files:**
- `/src/types/wildlands.ts` - Challenge, Leaderboard, UserProfile types
- `/src/components/screens/WildlandsHubScreen.tsx` - Daily/weekly challenge selection
- `/src/components/screens/LeaderboardScreen.tsx` - Rankings display
- `/src/components/game/WildlandsCanvas.tsx` - Enhanced savannah with challenge badge
- `/src/components/common/UsernameSetupModal.tsx` - Set display name
- `/src/services/wildlandsApi.ts` - API client (mock initially)
- `/src/hooks/useWildlands.ts` - Data fetching hook
- `/src/context/WildlandsContext.tsx` - Challenge state management

**Score Calculation:**
```typescript
score = (wordsCorrect * 100) + (livesRemaining * 50) + (timeBonus)
```

---

### Phase 2.6: Wildlands League - Backend
**Goal**: Working backend service for challenges and leaderboards

**Recommended Stack**: Cloudflare Workers + D1 (SQLite)

**API Endpoints:**
```
GET  /api/challenges/daily         - Today's word set
GET  /api/challenges/weekly        - This week's word set
POST /api/challenges/:id/submit    - Submit score
GET  /api/leaderboards/:id         - Get rankings
POST /api/users                    - Register (anonymous + username)
```

---

### Phase 2.7: Polish
- Visual refinements for all modes
- Offline queue for Wildlands score submission
- Error handling and loading states
- Accessibility review

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `/src/types/game.ts` | Add `mode` to GameResult |
| `/src/types/statistics.ts` | Per-mode stats structure |
| `/src/hooks/useGameState.ts` | Mode-aware reducer (lives, attempts, feedback) |
| `/src/context/GameContext.tsx` | Per-mode stats recording, migration |
| `/src/components/screens/GameScreen.tsx` | Read mode config, conditional rendering |
| `/src/components/screens/HomeScreen.tsx` | Mode selection cards |
| `/src/components/game/WordInput.tsx` | Wordle feedback display |
| `/src/components/game/CharacterSlot.tsx` | Green/yellow/gray states |
| `/src/App.tsx` | New routes |

## New Files to Create

| File | Purpose |
|------|---------|
| `/src/types/gameMode.ts` | Mode configs and types |
| `/src/types/wildlands.ts` | Challenge/leaderboard types |
| `/src/utils/wordleFeedback.ts` | Wordle feedback algorithm |
| `/src/components/game/MeadowCanvas.tsx` | Practice mode visuals |
| `/src/components/game/WildlandsCanvas.tsx` | Challenge mode visuals |
| `/src/components/screens/WildlandsHubScreen.tsx` | Challenge selection |
| `/src/components/screens/LeaderboardScreen.tsx` | Rankings |
| `/src/components/screens/PracticeCompleteScreen.tsx` | Meadow end screen |
| `/src/components/common/ModeSelectionCard.tsx` | Mode selection UI |
| `/src/services/wildlandsApi.ts` | Backend API client |

---

## Visual Themes

### Meadow Mode
- Soft green meadow background
- Flowers, butterflies, gentle clouds
- Alice standing calmly (not running)
- Peaceful color palette (pastels)

### Savannah Run (existing)
- African savanna with scrolling ground
- Lion chasing Alice
- Warm, urgent colors

### Wildlands League
- Similar to Savannah but with:
- Challenge badge/indicator (Daily/Weekly)
- Timer more prominent
- Competitive visual elements

---

## Key Design Decisions

1. **Single GameScreen with config** - Reduces duplication, easier maintenance
2. **Separate canvas components** - Visual themes different enough to warrant separation
3. **Backward-compatible stats** - Existing users keep their data
4. **Anonymous-first multiplayer** - No auth friction, device ID + optional username
5. **Wordle feedback** - Familiar pattern, proven effective for learning

---

# Phase 3: Meadow Mode Enhanced Spelling Feedback (COMPLETED)

## Goal

Enhance Meadow Mode to provide research-backed, LLM-powered feedback that helps children (ages 9-12) understand their spelling mistakes and learn from them.

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| LLM-powered spelling hints | Done |
| Multi-provider support (OpenAI, Anthropic, Groq) | Done |
| Auto-show hints after 2 wrong attempts | Done |
| Hint caching | Done |
| useSpellingHint hook | Done |
| SpellingHint UI component | Done |
| GameScreen integration | Done |
| Context disclosure in all modes (including Meadow) | Done |
| Auto-context escalation on wrong attempts | Done |
| Manual "More Context" button in all modes | Done |

## User Decisions

| Decision | Choice |
|----------|--------|
| **Feedback approach** | LLM-only (always use AI for contextual hints) |
| **Hint timing** | After 2 wrong attempts (auto-show) |
| **LLM integration** | Direct fetch API calls (simplified from Vercel AI SDK) |
| **Providers** | OpenAI, Anthropic, Groq (configurable via .env) |

---

## Research Summary: What Works for Teaching Spelling

### Key Principles from Educational Research

| Principle | Research Finding |
|-----------|-----------------|
| **Explanation > Correction** | Explanation feedback promotes better transfer of learning than just showing the correct answer |
| **Socratic approach** | Guiding children to find answers themselves works better than giving direct answers |
| **Morphology matters** | Teaching word parts (prefixes, suffixes, roots) improves spelling |
| **Don't correct too quickly** | Let children try first (hence: hints after 2 attempts) |

### Common Error Types to Address

| Error Type | Example | LLM Hint Approach |
|------------|---------|-------------------|
| **Phonological** | "wis" → "with" | "Listen carefully - there's a sound you might be missing" |
| **Orthographic** | "recieve" → "receive" | "Remember the rule about I and E when C is involved!" |
| **Morphological** | "hapyness" → "happiness" | "When a word ends in Y, what usually happens when you add -ness?" |

---

## Implementation Plan

### Phase 3.1: Environment & Dependencies Setup

**Install Vercel AI SDK and providers:**
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/groq
```

**Create `.env` file:**
```env
# Choose ONE provider and set its API key
VITE_AI_PROVIDER=openai  # or 'anthropic' or 'groq'

# API Keys (only the active provider's key is required)
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_GROQ_API_KEY=gsk_...
```

### Phase 3.2: AI Service Layer

**Create `/src/services/aiProvider.ts`:**
- Initialize the selected AI provider based on env var
- Export a unified `generateSpellingHint()` function
- Handle provider switching seamlessly

**System Prompt for Spelling Hints:**
```
You are a friendly spelling tutor helping a 10-year-old learn to spell.

The child is trying to spell: "{targetWord}"
Their current guess: "{guess}"
Previous attempts: {previousAttempts}

Provide a SHORT, encouraging hint (max 50 words) that:
- Does NOT reveal the correct spelling or any letters
- Focuses on ONE specific issue with their guess
- Uses simple, age-appropriate language
- May reference:
  - Sound patterns (phonics)
  - Spelling rules (i before e, silent letters, etc.)
  - Word families or related words
  - Word parts (prefixes, suffixes, roots)

Be warm and encouraging. Start with brief praise for their effort.
```

### Phase 3.3: Feedback Hook

**Create `/src/hooks/useSpellingHint.ts`:**
- Track attempt count per word
- Trigger hint generation after 2 wrong attempts
- Manage loading/error states
- Cache hints for identical guess patterns

```typescript
interface UseSpellingHintReturn {
  hint: string | null;
  isLoading: boolean;
  error: string | null;
  attemptCount: number;
  recordAttempt: (guess: string, targetWord: string) => void;
  clearHint: () => void;
}
```

### Phase 3.4: UI Components

**Create `/src/components/game/SpellingHint.tsx`:**
- Friendly hint bubble UI
- Loading state with animation
- Subtle entrance animation
- Character avatar (butterfly or Alice)

**Modify `/src/components/game/WordInput.tsx`:**
- Integrate hint display below previous attempts
- Pass attempt data to hint hook
- Show loading indicator while generating

### Phase 3.5: Integration with Game Flow

**Modify `/src/hooks/useGameState.ts`:**
- Track wrong attempt count per word
- Reset count when moving to next word
- Expose attempt count for hint triggering

**Modify `/src/components/screens/GameScreen.tsx`:**
- Wire up the hint system for Meadow mode only
- Pass relevant props to WordInput

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `.env` | Create | Store API keys and provider selection |
| `.env.example` | Create | Template for required env vars |
| `.gitignore` | Modify | Ensure .env is ignored |
| `/src/services/aiProvider.ts` | Create | Multi-provider AI integration |
| `/src/hooks/useSpellingHint.ts` | Create | Hint generation logic and state |
| `/src/components/game/SpellingHint.tsx` | Create | Hint display UI component |
| `/src/components/game/WordInput.tsx` | Modify | Integrate hint display |
| `/src/hooks/useGameState.ts` | Modify | Track attempt count per word |
| `/src/components/screens/GameScreen.tsx` | Modify | Wire up hint system |
| `/src/types/spelling.ts` | Create | Types for hints and feedback |

---

## Safety Considerations

1. **Content filtering**: LLM responses should be safe by design (educational context)
2. **Response length limit**: Cap at 50 words to prevent verbose responses
3. **Error handling**: Graceful fallback if API fails ("Keep trying! You're doing great!")
4. **Rate limiting**: Consider caching identical error patterns
5. **No answer revelation**: System prompt explicitly forbids revealing the spelling

---

## Example User Flow

1. Child sees word "definitely" spoken aloud
2. Child types "definately" → Wrong (attempt 1)
   - Wordle feedback shows colors for each letter
3. Child types "definetly" → Wrong (attempt 2)
   - **Hint appears**: "Good effort! This word has a smaller word hiding inside it - think about something that has clear limits or boundaries."
4. Child types "definitly" → Wrong (attempt 3)
   - **New hint**: "You're so close! The word 'finite' is in there. Now think about what vowel comes after the 'n'..."
5. Child types "definitely" → Correct!

---

## Provider Comparison

| Provider | Model | Speed | Cost | Notes |
|----------|-------|-------|------|-------|
| **OpenAI** | gpt-4o-mini | Very fast | ~$0.15/1M tokens | Great for quick responses |
| **Anthropic** | claude-3-haiku | Fast | ~$0.25/1M tokens | Known for being helpful and safe |
| **Groq** | llama-3.1-8b | Fastest | Free tier available | Good for development/testing |

---

# Phase 4: Cartesia TTS Integration (COMPLETED)

## Goal

Replace browser TTS with Cartesia Sonic-3 for natural-sounding, child-friendly voice synthesis with low-latency streaming.

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| Cartesia API integration | Done |
| Audio caching | Done |
| SSE streaming for low latency | Done |
| Emotion/speed configuration | Done |
| TTS-optimized AI prompts | Done |
| Hint display improvements | Done |

---

## Architecture

### Text-to-Speech Flow
```
speakWithCartesia(text)
    |
    +-- Cache hit? --> playAudioFromUrl(cachedUrl)
    |
    +-- Cache miss --> streamAndCacheAudio()
                           |
                           +-- Fetch from /tts/sse endpoint
                           +-- Stream raw PCM chunks via Web Audio API
                           +-- Play chunks immediately as they arrive
                           +-- Collect all chunks
                           +-- After stream: create WAV blob & cache
```

### Streaming Benefits
- **Time-to-first-audio**: ~50-100ms (vs ~500-1000ms with bytes endpoint)
- **Repeat plays**: Instant from cache

---

## Files Created/Modified

| File | Changes |
|------|---------|
| `/src/services/cartesiaTTS.ts` | Full Cartesia integration with SSE streaming, caching, emotion/speed config |
| `/src/hooks/useTextToSpeech.ts` | Updated to use Cartesia when available, browser TTS fallback |
| `/src/services/aiProvider.ts` | TTS-optimized system prompt using anchor words |
| `/src/components/game/WordInput.tsx` | Inline hint display below latest wrong attempt |
| `/src/components/game/SpellingHint.tsx` | Added repeat audio button |
| `.env` / `.env.example` | Cartesia configuration options |

---

## Configuration

**.env variables:**
```env
# Text-to-Speech (Cartesia)
VITE_CARTESIA_API_KEY=sk_car_...
VITE_CARTESIA_VOICE_ID=bf0a246a-8642-498a-9950-80c35e9276b5

# Emotion options: enthusiastic, happy, curious, content, calm, grateful, affectionate, excited, peaceful
VITE_CARTESIA_EMOTION=curious

# Speed: 0.6 to 1.5 (default 1.0)
VITE_CARTESIA_SPEED=1.25
```

---

## TTS-Optimized AI Prompt

The system prompt for spelling hints was updated to produce better TTS output:

**Key rules:**
- Do NOT use invented sound spellings like "unh", "kuh", "sss"
- Avoid IPA and slash-phonics like /sh/
- Use REAL anchor words instead:
  - "It starts like the beginning of 'under'..."
  - "It ends like the end of 'fish'..."
  - "The middle sounds like 'rain'..."

---

## UI Improvements

### Hint Display Location
Hints now appear as a callout directly below the most recent wrong attempt:

```
Previous Attempts:
+------------------------------------------+
| [d][e][f][i][n][e][t][l][y]              | <- Latest attempt
+------------------------------------------+
       |
       v
+------------------------------------------+
| [Hint Icon] Great effort! Think about    |
| the word "finite" hiding inside...       |
|                              [Repeat]    |
+------------------------------------------+

| [d][e][f][i][n][a][t][e][l][y]          | <- Older attempt
```

### Repeat Audio Button
- Speaker icon button on hint callout
- Allows children to hear the hint again

---

## Technical Details

### Web Audio API Streaming
```typescript
// Create AudioContext (shared)
const audioContext = new AudioContext({ sampleRate: 44100 });

// For each SSE chunk:
// 1. Base64 decode to raw PCM bytes
// 2. Convert PCM to AudioBuffer
// 3. Create BufferSourceNode
// 4. Schedule playback with precise timing
```

### WAV Blob Creation for Cache
After streaming completes, raw PCM is wrapped in WAV headers for caching:
- Enables `new Audio(blobUrl).play()` for repeat plays
- More efficient than re-streaming

### Fallback Chain
1. Try SSE streaming (fastest)
2. If streaming fails, fall back to bytes endpoint
3. If Cartesia unavailable, fall back to browser TTS

---

# Phase 5: Intrinsic Motivation & Learning Optimization (COMPLETED)

## Goal

Transform the app to make kids **want** to practice spelling without being asked. Based on product feedback and educational research, this phase addresses:

- **Session length**: 20 words was too long → 8-word Quick Play default (~5 min)
- **Shame signals**: "Lion caught you!" → "Race Results" positive reframe
- **Learning retention**: Random word selection → Spaced repetition algorithm
- **Motivation hooks**: Always end sessions with a positive "win"

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| Quick Play mode (8 words, ~5 min) | Done |
| Spaced repetition word selection (Leitner system) | Done |
| Race Results screen (positive reframe) | Done |
| Find-a-win closure system | Done |
| First-correct tracking for celebrations | Done |
| Word mastery persistence | Done |

## User Decisions

| Decision | Choice |
|----------|--------|
| Loss framing | **Reframe only** - Keep lion catch, show as "Race Results" with positive stats |
| Word source | **Bundled** - Include grade-level words in app (future) |
| Spaced repetition | **Tier 1** - Ship with initial release for maximum learning benefit |

---

## Pedagogical Research Applied

### Evidence-Based Principles Implemented

| Principle | Implementation |
|-----------|---------------|
| **Spaced Repetition** | Leitner system with 6 mastery levels (0-5) and intervals (0, 1, 3, 7, 14, 30 days) |
| **Distributed Practice** | Quick Play (8 words, ~5 min) encourages short, frequent sessions |
| **Low-Stakes Practice** | Race Results screen removes shame, celebrates progress |
| **Interleaving** | Word selection mixes 30% struggling, 50% practicing, 20% confident |
| **Desirable Difficulty** | Wrong answers drop mastery by 2 levels, creating optimal challenge |

### Spacing Intervals (Leitner System)

| Mastery Level | Days Until Review | Description |
|---------------|-------------------|-------------|
| 0 | 0 | New/struggling - review immediately |
| 1 | 1 | Review tomorrow |
| 2 | 3 | Review in 3 days |
| 3 | 7 | Review in a week |
| 4 | 14 | Review in 2 weeks |
| 5 | 30 | Mastered - monthly review |

---

## Architecture Changes

### New Type: GameModeId Extension

```typescript
// src/types/gameMode.ts
export type GameModeId = 'meadow' | 'savannah' | 'savannah-quick' | 'wildlands';

// Stats mode (savannah-quick shares stats with savannah)
export type StatsModeId = 'meadow' | 'savannah' | 'wildlands';

export const getStatsModeId = (modeId: GameModeId): StatsModeId => {
  if (modeId === 'savannah-quick') return 'savannah';
  return modeId;
};
```

### New Type: Word Mastery

```typescript
// src/types/word.ts
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const MASTERY_INTERVALS: Record<MasteryLevel, number> = {
  0: 0,   // Review immediately
  1: 1,   // Review tomorrow
  2: 3,   // Review in 3 days
  3: 7,   // Review in a week
  4: 14,  // Review in 2 weeks
  5: 30,  // Review monthly (mastered)
};

export interface Word {
  id: string;
  text: string;
  addedAt: string;
  timesUsed: number;
  timesCorrect: number;
  // Spaced repetition fields
  masteryLevel: MasteryLevel;
  correctStreak: number;
  lastAttemptAt: string | null;
  nextReviewAt: string;
}
```

### New Type: Statistics Extension

```typescript
// src/types/statistics.ts
export interface GameStatistics {
  modeStats: Record<StatsModeId, ModeStatistics>;
  wordAccuracy: Record<string, WordAccuracy>;
  firstCorrectDates: Record<string, string>;  // NEW: For "First time!" celebrations
  // Legacy fields...
}
```

### New Utility: Session Summary

```typescript
// src/utils/sessionSummary.ts
export interface SessionWin {
  type: 'first-time' | 'streak' | 'improvement' | 'milestone' | 'consistency';
  message: string;
}

export function findSessionWins(
  result: GameResult,
  stats: GameStatistics,
  previousResults: GameResult[]
): SessionWin[]
```

---

## Spaced Repetition Algorithm

### Word Selection Logic

```typescript
// src/utils/wordSelection.ts
export function selectWordsForSession(words: Word[], count: number): string[] {
  // 1. Get words that are due for review
  const dueWords = words.filter(w => new Date(w.nextReviewAt) <= new Date());

  // 2. Categorize by mastery level
  const struggling = dueWords.filter(w => w.masteryLevel <= 1);  // 30%
  const practicing = dueWords.filter(w => w.masteryLevel === 2 || w.masteryLevel === 3);  // 50%
  const confident = dueWords.filter(w => w.masteryLevel >= 4);   // 20%

  // 3. Select from each category (interleaving)
  // 4. Shuffle final selection
  // Result: ~70-80% success rate maintained naturally
}
```

### Mastery Update Logic

```typescript
// src/types/word.ts
export function updateWordMastery(word: Word, wasCorrect: boolean): Word {
  if (wasCorrect) {
    // Move up one box (max 5)
    newLevel = Math.min(5, word.masteryLevel + 1);
    newStreak = word.correctStreak + 1;
  } else {
    // Drop back 2 boxes (min 0) - "desirable difficulty"
    newLevel = Math.max(0, word.masteryLevel - 2);
    newStreak = 0;
  }
  // Calculate next review date based on new level
  nextReviewAt = addDays(now, MASTERY_INTERVALS[newLevel]);
}
```

---

## UI Changes

### HomeScreen - Quick Play Primary CTA

```
┌─────────────────────────────────────────────┐
│           Alice Spelling Run                 │
│         Choose your adventure!               │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ 🚀 QUICK PLAY                       │    │  ← Primary CTA (gradient button)
│  │ 8 words, ~5 minutes                 │    │
│  │ Perfect for a quick challenge!      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Other Modes:                               │
│  [Full Run (20 words)]  [Meadow]  [League]  │  ← Secondary options
└─────────────────────────────────────────────┘
```

### GameOverScreen → Race Results

**Before (shame-inducing):**
```
Oh no! 😢
The lion caught you this time...
[Try Again]
```

**After (positive reframe):**
```
Race Results 🏃🦁

      6
words spelled correctly!

┌─────────────────────────┐
│ Today's Wins:           │
│ ⭐ First time: "rhythm" │
│ 🔥 3 day streak!        │
│ 📈 2 more than average! │
└─────────────────────────┘

[🔥 Beat Your Record?]  [🏠 Home]
```

### Find-a-Win System

Every session ends with at least one positive message:

| Win Type | Example Message |
|----------|----------------|
| First-time | First time spelling "rhythm"! |
| Streak | 3 day play streak! |
| Improvement | 2 more words than your average! |
| Milestone | 50 words spelled total! |
| Consistency | You attempted 5 words - keep practicing! |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/types/word.ts` | Added `MasteryLevel`, `MASTERY_INTERVALS`, mastery fields, `updateWordMastery()`, `migrateWord()` |
| `src/types/statistics.ts` | Added `firstCorrectDates`, updated to use `StatsModeId` |
| `src/types/gameMode.ts` | Added `savannah-quick` mode, `StatsModeId`, `getStatsModeId()` |
| `src/utils/wordSelection.ts` | Replaced random selection with spaced repetition algorithm |
| `src/utils/sessionSummary.ts` | **NEW** - `findSessionWins()` for positive closure |
| `src/context/GameContext.tsx` | Track first-correct dates, update word mastery, migrate old data |
| `src/hooks/useGameState.ts` | Map `savannah-quick` to `savannah` for stats |
| `src/components/screens/HomeScreen.tsx` | Quick Play as primary CTA with gradient styling |
| `src/components/screens/GameOverScreen.tsx` | Complete reframe to "Race Results" with wins |
| `src/components/screens/StatisticsScreen.tsx` | Updated to use `StatsModeId` |

---

## Data Migration

### Word Migration
Words without mastery fields are automatically migrated on load:
```typescript
// In GameContext.tsx
useEffect(() => {
  const needsMigration = wordBank.words.some(w => w.masteryLevel === undefined);
  if (needsMigration) {
    setWordBank(prev => ({
      words: prev.words.map(migrateWord),
      lastUpdated: new Date().toISOString(),
    }));
  }
}, []);
```

### Statistics Migration
Statistics without `firstCorrectDates` are automatically migrated:
```typescript
if (!statistics.modeStats || !statistics.firstCorrectDates) {
  const migrated = migrateStatistics(statistics);
  setStatistics(migrated);
}
```

---

## Success Metrics

The changes succeed if:
- **Session length** drops to 5-7 minutes average
- **Return rate** (plays again within 24h) exceeds 60%
- **Unprompted play** reported by parents
- Kids talk about **personal bests and patterns conquered**, not just trophies

---

---

# Phase 6: Tier 2 Features - Enhanced Learning (COMPLETED)

## Goal

Add personal best tracking, error pattern analysis, and bundled grade-level words to improve learning outcomes and provide richer feedback.

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| Personal best tracking (fastest spelling time per word) | Done |
| Error pattern analysis (9 pattern types) | Done |
| Bundled grade-level words (Grades 3-6, ~600 words) | Done |
| Grade import UI in WordBankScreen | Done |

---

## B1: Personal Best Tracking

### Data Model Changes

```typescript
// src/types/game.ts
export interface CompletedWord {
  word: string;
  attempts: number;
  timeMs?: number; // Time to spell correctly in milliseconds
}

// src/types/statistics.ts
export interface PersonalBest {
  timeMs: number;
  date: string;
  attempts: number;
}

export interface GameStatistics {
  // ...existing fields
  personalBests: Record<string, PersonalBest>; // word -> best time
}
```

### Implementation

- `useGameState.ts`: Added `wordStartTime` to track when each word begins
- `GameContext.tsx`: Records personal bests when word is spelled correctly on first attempt
- Results stored per-word, only counting first-attempt successes

---

## B2: Error Pattern Analysis

### Error Pattern Types

```typescript
// src/types/statistics.ts
export type ErrorPattern =
  | 'vowel-swap'      // recieve → receive
  | 'double-letter'   // begining → beginning
  | 'silent-letter'   // nife → knife
  | 'phonetic'        // enuff → enough
  | 'suffix'          // hapyness → happiness
  | 'prefix'          // unessary → unnecessary
  | 'missing-letter'  // definite → definite (missing 'i')
  | 'extra-letter'    // untill → until
  | 'transposition';  // teh → the
```

### Detection Algorithm

Created `/src/utils/errorPatternAnalysis.ts` with:

- `analyzeError(attempt, correct)` - Returns array of detected patterns
- `hasVowelSwap()` - Detects swapped vowels (e/i, a/e, etc.)
- `hasDoubleLetterError()` - Detects missing or extra doubled consonants
- `hasSilentLetterError()` - Detects missing silent letters (k, w, b, g, h)
- `isPhoneticallyPlausible()` - Detects phonetic substitutions (f/ph, s/c, etc.)
- `hasSuffixError()` - Detects suffix rule violations (-ness, -ly, -ing, -ed)
- `hasPrefixError()` - Detects prefix issues (un-, re-, dis-, mis-)

### Tracking

```typescript
// src/types/statistics.ts
export interface ErrorPatternStats {
  count: number;
  lastOccurrence: string;
  examples: { word: string; attempt: string; date: string }[];
}

export interface GameStatistics {
  // ...existing fields
  errorPatterns: Record<ErrorPattern, ErrorPatternStats>;
}
```

---

## C2: Bundled Grade-Level Words

### Word Lists Created

| File | Grade | Age Range | Word Count | Focus Areas |
|------|-------|-----------|------------|-------------|
| `src/data/gradeWords/grade3.ts` | 3 | 8-9 years | 160 | High-frequency, vowel patterns, compound words |
| `src/data/gradeWords/grade4.ts` | 4 | 9-10 years | 159 | Silent letters, prefixes, suffixes, homophones |
| `src/data/gradeWords/grade5.ts` | 5 | 10-11 years | 160 | Greek/Latin roots, advanced affixes, academic vocabulary |
| `src/data/gradeWords/grade6.ts` | 6 | 11-12 years | 186 | Scientific terms, mathematical vocabulary, challenging words |

### Word Definition Type

```typescript
// src/data/gradeWords/types.ts
export interface WordDefinition {
  word: string;
  definition: string;
  example?: string;  // Example sentence using the word in context
}
```

Each word includes:
- **word**: The spelling word
- **definition**: Age-appropriate explanation
- **example**: A sentence using the word in context (for pronunciation and understanding)

### Index File

```typescript
// src/data/gradeWords/index.ts
export type GradeLevel = 3 | 4 | 5 | 6;

export interface GradeLevelInfo {
  grade: GradeLevel;
  name: string;
  ageRange: string;
  description: string;
  wordCount: number;
  words: string[];
}

export const GRADE_WORDS: Record<GradeLevel, string[]>;
export const GRADE_INFO: GradeLevelInfo[];
export function getWordsForGrade(grade: GradeLevel): string[];
export function suggestGradeLevel(accuracy: number, currentGrade: GradeLevel): GradeLevel;
```

### UI Changes

`WordBankScreen.tsx` updated with:
- "Import by Grade" button
- Grade selection modal showing all grades with word counts
- Import feedback ("Added X new words from Grade Y!")

---

## Files Modified/Created

| File | Changes |
|------|---------|
| `src/types/game.ts` | Added `timeMs` to CompletedWord, `SessionWrongAttempt` type |
| `src/types/statistics.ts` | Added `PersonalBest`, `ErrorPattern`, `ErrorPatternStats` |
| `src/hooks/useGameState.ts` | Added `wordStartTime`, `sessionWrongAttempts` tracking |
| `src/context/GameContext.tsx` | Record personal bests, analyze error patterns, `importGradeWords()` |
| `src/utils/errorPatternAnalysis.ts` | **NEW** - Error pattern detection algorithms |
| `src/data/gradeWords/grade3.ts` | **NEW** - Grade 3 word list |
| `src/data/gradeWords/grade4.ts` | **NEW** - Grade 4 word list |
| `src/data/gradeWords/grade5.ts` | **NEW** - Grade 5 word list |
| `src/data/gradeWords/grade6.ts` | **NEW** - Grade 6 word list |
| `src/data/gradeWords/index.ts` | **NEW** - Exports and utilities |
| `src/components/screens/WordBankScreen.tsx` | Grade import modal |

---

# Phase 7: Gradual Word Introduction System (COMPLETED)

## Goal

Redesign word learning to introduce words gradually rather than dumping all 160 grade-level words at once. Based on learning science research showing optimal learning at ~85% success rate with 5-10 new items per session.

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| Word lifecycle states (Available → Learning → Review → Mastered) | Done |
| Gradual introduction (1-2 new words per session) | Done |
| Struggling cap (pause at 15 learning words) | Done |
| Weekly spot-checks for mastered words | Done |
| Daily introduction limits | Done |
| Visual word states in WordBankScreen | Done |
| Progress summary dashboard | Done |

---

## The Problem Solved

When users imported Grade 4 (160 words):
- All 160 words became available immediately
- All started at mastery 0, due immediately
- First session had 160 words competing for selection
- No concept of "not yet introduced" vs "in rotation"

---

## Word Lifecycle

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  AVAILABLE  │ ──► │   LEARNING   │ ──► │   REVIEW    │ ──► │   MASTERED   │
│(not intro'd)│     │ (level 0-1)  │     │ (level 2-4) │     │  (level 5)   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
     Pool of            Active              Spaced              Weekly
   future words       practice           repetition          spot-check
```

### Word States

| State | Mastery Level | Description |
|-------|---------------|-------------|
| **Available** | N/A (null) | Imported but not yet introduced. Waiting in queue. |
| **Learning** | 0-1 | Recently introduced. Needs frequent practice. |
| **Review** | 2-4 | Making progress. Spaced review intervals. |
| **Mastered** | 5 | Well-learned. Weekly spot-check only. |

---

## Configuration

```typescript
// src/utils/wordSelection.ts
export const SPACED_REP_CONFIG = {
  maxNewWordsPerDay: 10,           // Maximum new words to introduce per day
  maxNewWordsPerSession: 2,        // Maximum new words per session
  maxStrugglingBeforePause: 15,    // Pause new words if too many struggling
  masteredSpotCheckIntervalDays: 7, // How often to spot-check mastered words
  masteredSpotCheckPerSession: 1,  // How many mastered words to spot-check per session
};
```

---

## Session Composition (8-word Quick Play)

```
Ideal mix for 8 words:
├── 1-2 NEW words (first time, if eligible)
├── 3-4 LEARNING words (level 0-1, high frequency)
├── 2-3 REVIEW words (level 2-4, due for review)
└── 0-1 MASTERED word (weekly spot-check)
```

---

## Data Model Changes

### Word Interface

```typescript
// src/types/word.ts
export interface Word {
  // Existing fields...

  // Gradual introduction fields
  introducedAt: string | null;       // null = available but not introduced
  lastMasteredCheckAt: string | null; // When mastered word was last spot-checked
}
```

### WordBank Interface

```typescript
// src/types/word.ts
export interface WordBank {
  words: Word[];
  lastUpdated: string;

  // Daily introduction tracking
  lastNewWordDate: string | null;    // Date (YYYY-MM-DD) when new words were last introduced
  newWordsIntroducedToday: number;   // Count of words introduced today
}
```

### GameResult Interface

```typescript
// src/types/game.ts
export interface GameResult {
  // Existing fields...

  // Gradual introduction tracking
  wordsIntroduced?: string[];  // Words that were introduced this session
  spotCheckWords?: string[];   // Mastered words that were spot-checked this session
}
```

---

## Key Rules

### 1. New Word Introduction
- **Max new words per day**: 10 (configurable)
- **Max per session**: 2 words
- **Only introduce if**: struggling count (level 0-1) < 15
- **Track**: `lastNewWordDate` to limit daily introduction

### 2. Struggling Cap
- If `count(level 0-1) >= 15`: pause new word introduction
- Focus on existing struggling words until pile shrinks
- Message: "Let's master these before adding more!"

### 3. Mastered Word Spot-Checks
- Once per week, include 1 mastered word in session
- Track `lastMasteredCheckAt` per word
- If they fail, drop back to Review (level 3)

---

## Algorithm: selectWordsForSession

```typescript
// src/utils/wordSelection.ts
export function selectWordsForSessionDetailed(
  words: Word[],
  count: number
): WordSelectionResult {
  // 1. Categorize words by state
  const { available, learning, review, mastered } = categorizeWordsByState(words);

  // 2. Determine if we can introduce new words
  const canIntroduce = learning.length < 15 && available.length > 0;
  const newWordQuota = canIntroduce ? Math.min(2, available.length) : 0;

  // 3. Check if mastered words need spot-check (weekly)
  const needsSpotCheck = mastered.filter(w =>
    daysSince(w.lastMasteredCheckAt) >= 7
  );
  const spotCheckQuota = needsSpotCheck.length > 0 ? 1 : 0;

  // 4. Calculate quotas
  const learningQuota = Math.min(4, learning.length);
  const reviewQuota = count - newWordQuota - learningQuota - spotCheckQuota;

  // 5. Select from each category and shuffle
  return { words, wordsToIntroduce, spotCheckWords };
}
```

---

## UI Changes

### WordBankScreen - Progress Summary

```
┌─────────────────────────────────────────────────────────┐
│ Your Learning Progress                                   │
├─────────────┬─────────────┬─────────────┬───────────────┤
│  ⏰ Waiting │  📖 Learning │  ✨ Review  │  ⭐ Mastered  │
│     142     │      8      │     15      │      5       │
│ to introduce│ practicing  │ spaced      │ spot-checked │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

### Word List State Badges

Each word shows its current state:
- **Waiting** (gray): `⏰ Waiting` - Not yet introduced
- **Learning** (orange): `📖 Learning` - Mastery 0-1
- **Reviewing** (blue): `✨ Reviewing` - Mastery 2-4
- **Mastered** (green): `⭐ Mastered` - Mastery 5

---

## Migration Strategy

**Existing words** (already in word bank):
- Set `introducedAt = addedAt` (treat as already introduced)
- Set `lastMasteredCheckAt = null`

**New words imported via grade selection**:
- Set `introducedAt = null` (available, not yet introduced)
- Will be gradually introduced during play

**Manual word additions**:
- Set `introducedAt = now` (immediately introduced)

---

## Files Modified/Created

| File | Changes |
|------|---------|
| `src/types/word.ts` | Added `introducedAt`, `lastMasteredCheckAt` to Word; `lastNewWordDate`, `newWordsIntroducedToday` to WordBank; updated `createWord()` with `immediatelyIntroduced` param; updated `migrateWord()` |
| `src/types/game.ts` | Added `wordsIntroduced`, `spotCheckWords` to GameResult |
| `src/utils/wordSelection.ts` | Added `SPACED_REP_CONFIG`, `WordState`, `getWordState()`, `categorizeWordsByState()`, `canIntroduceNewWords()`, `selectWordsForSessionDetailed()` |
| `src/context/GameContext.tsx` | Added `markWordsAsIntroduced()`, updated grade import to use gradual introduction, updated `recordGame()` for spot-checks, added WordBank migration |
| `src/components/screens/WordBankScreen.tsx` | Added progress summary dashboard, word state badges, mastery level display |

---

# Phase 8: Homepage UX Redesign + Calibration Mode (COMPLETED)

## Goal

Transform the homepage from a utility-style menu into an immersive, narrative-driven game experience. Add a calibration system that assesses new users' spelling level and auto-imports appropriate grade-level words.

## Implementation Status: COMPLETE

| Feature | Status |
|---------|--------|
| Animated savannah homepage background | Done |
| Alice and Lion character scene | Done |
| Narrative intro ("Help Alice escape!") | Done |
| New user vs returning user experience | Done |
| Calibration mode (adaptive assessment) | Done |
| Auto-import grade words after calibration | Done |
| Progressive disclosure of game modes | Done |

## User Decisions

| Decision | Choice |
|----------|--------|
| **Scope** | Full redesign (not just tweaks) |
| **Quick start** | Calibration mode that assesses level and auto-loads appropriate words |
| **Character** | Yes - Alice with narrative ("Help Alice escape the lion!") |
| **Implementation** | Full implementation (both calibration + homepage together) |

---

## UX Problems Solved

| Problem | Solution |
|---------|----------|
| **Cold start** | New users see story intro + calibration, not empty stats |
| **No narrative hook** | Alice character + lion chase story throughout |
| **Cognitive overload** | Progressive disclosure - Quick Play primary, other modes hidden |
| **Technical language** | "Quick Escape" instead of "8 words, ~5 minutes" |
| **No visual engagement** | Animated background with clouds, characters, speech bubbles |
| **Word bank friction** | Calibration auto-imports appropriate grade words |

---

## Calibration System Design

### Algorithm: Adaptive Staircase

```
Config:
- startingGrade: 4 (middle of target range)
- wordsPerRound: 3
- maxWords: 15
- moveUpThreshold: 100% (3/3 correct)
- moveDownThreshold: ≤33% (0-1/3 correct)
- stabilityRounds: 2 (same grade for 2 rounds = done)

Flow:
1. Start at Grade 4
2. Present 3 words from current grade
3. Score round:
   - 3/3 correct → Move UP one grade (if not at max)
   - 0-1/3 correct → Move DOWN one grade (if not at min)
   - 2/3 correct → Stay, test more
4. Stop when stable or 15 words tested
5. Calculate final placement based on best-performing grade
6. Auto-import recommended grade words
```

### Word Lifecycle After Calibration

```
Calibration Complete
        ↓
Import Grade Words (gradual introduction)
        ↓
Available → Learning → Review → Mastered
```

---

## User Experience Flows

### New User Flow

```
Homepage (animated) → Story Intro → "Start Adventure" →
Calibration Welcome → Calibration Game (12-15 words) →
Results (grade reveal + celebration) → Auto-import →
Homepage (ready to play!)
```

### Returning User Flow

```
Homepage (animated) → Progress stats → "Quick Escape" → Game
                                  └→ "More Adventures" → Mode selection
```

---

## Architecture

### New Types

```typescript
// src/types/calibration.ts
export type CalibrationStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface CalibrationAttempt {
  word: string;
  gradeLevel: GradeLevel;
  isCorrect: boolean;
  responseTimeMs: number;
  attemptCount: number;
}

export interface CalibrationResult {
  id: string;
  completedAt: string;
  status: 'completed' | 'skipped';
  recommendedGrade: GradeLevel;
  confidence: 'high' | 'medium' | 'low';
  attempts: CalibrationAttempt[];
  totalTimeMs: number;
  gradeScores: Record<GradeLevel, GradeScore>;
}

export interface StoredCalibration {
  lastResult: CalibrationResult | null;
  hasCompletedCalibration: boolean;
  calibrationHistory: CalibrationResult[];
}
```

### New Hook

```typescript
// src/hooks/useCalibration.ts
interface UseCalibrationReturn {
  state: CalibrationState;
  currentWord: string;
  currentGrade: GradeLevel;
  progress: number;
  isComplete: boolean;
  result: CalibrationResult | null;
  actions: {
    start: () => void;
    submitAnswer: (isCorrect: boolean) => void;
    skip: (selectedGrade: GradeLevel) => void;
    reset: () => void;
    setPhase: (phase: 'welcome' | 'playing' | 'results') => void;
  };
}
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/types/calibration.ts` | Calibration types (status, attempts, results, config) |
| `src/utils/calibrationWordSelection.ts` | Word selection for calibration tests |
| `src/utils/calibrationAlgorithm.ts` | Adaptive placement algorithm |
| `src/hooks/useCalibration.ts` | Calibration state machine hook |
| `src/components/calibration/CalibrationWelcome.tsx` | Story intro + start button |
| `src/components/calibration/CalibrationGame.tsx` | Simplified spelling UI (no timer/lives) |
| `src/components/calibration/CalibrationProgress.tsx` | Journey map visualization |
| `src/components/calibration/CalibrationResults.tsx` | Grade reveal + celebration |
| `src/components/calibration/GradeSelector.tsx` | Manual grade selection for skip flow |
| `src/components/calibration/index.ts` | Exports |
| `src/components/screens/CalibrationScreen.tsx` | Full calibration flow container |
| `src/components/home/HomeBackground.tsx` | Animated savannah (clouds, sun, grass) |
| `src/components/home/HomeCharacterScene.tsx` | Alice + Lion with speech bubble |
| `src/components/home/PlayButton.tsx` | Attractive animated CTA button |
| `src/components/home/NewUserWelcome.tsx` | First-time user experience |
| `src/components/home/ReturningUserDashboard.tsx` | Stats display (streak, wins, etc.) |
| `src/components/home/ModeDrawer.tsx` | Collapsible other game modes |
| `src/components/home/index.ts` | Exports |

## Files Modified

| File | Changes |
|------|---------|
| `src/types/index.ts` | Export calibration types |
| `src/utils/index.ts` | Export calibration utilities |
| `src/hooks/index.ts` | Export useCalibration hook |
| `src/context/GameContext.tsx` | Added calibration state management (`setCalibrationComplete`, `resetCalibration`, `hasCompletedCalibration`) |
| `src/App.tsx` | Added `/calibration` route (outside Layout) |
| `src/components/screens/index.ts` | Export CalibrationScreen |
| `src/components/screens/HomeScreen.tsx` | Complete refactor with new components, differentiated new/returning user experiences |

---

## Visual Design

### Homepage Layout

```
+----------------------------------------------------------+
|  [clouds drifting]        [sun]          [clouds]         |
|                                                            |
|                    "Alice Spelling Run"                    |
|                     ✨ Spell to Survive! ✨                |
|                                                            |
|   [LION]                                      [ALICE]      |
|  (prowling)                                  (speech       |
|                                               bubble)      |
|                                                            |
|  +------------------------------------------------------+ |
|  |  Your Journey So Far (returning users only)          | |
|  |  🔥 3 streak | 🏆 12 escapes | ⭐ 47 words | ⚡ 25   | |
|  +------------------------------------------------------+ |
|                                                            |
|        [ ✨ Quick Escape ✨ ]  (primary CTA)              |
|            8 words • ~5 minutes                            |
|                                                            |
|              [ More Adventures v ]                         |
|                                                            |
|  [Words (42)]  [Stats]                                    |
+----------------------------------------------------------+
```

### Calibration Flow

```
Welcome Screen          Game Screen           Results Screen
+----------------+    +----------------+    +----------------+
| ✨ Meet Alice! |    | Journey Map    |    | 🏆 Adventure   |
|                |    | [====•===]     |    |    Complete!   |
| [Lion] [Alice] |    |                |    |                |
|                |    | [Listen Word]  |    | Grade 4        |
| Story intro... |    |                |    | "9-10 years"   |
|                |    | Type: [____]   |    |                |
| [Start        |    |                |    | 12 words | 83% |
|  Adventure]   |    | [Check]        |    |                |
+----------------+    +----------------+    | [Let's Go!]   |
                                           +----------------+
```

---

## Narrative Copy

### New User Welcome
> "Meet Alice! She loves exploring the savannah, but a hungry lion is always chasing her! The only way to escape? SPELL WORDS CORRECTLY!"

### Returning User
> "Welcome back! Alice is counting on you."

### CTA Labels
- "Start Adventure!" (calibration)
- "Quick Escape" (quick play)
- "More Adventures" (drawer toggle)

---

## Future Enhancements (Tier 3+)

| Feature | Description |
|---------|-------------|
| **Multiple streak types** | Daily play, words attempted, pattern conquest streaks |
| **Dynamic timer** | Gradual timer adjustment based on player skill |
| **Skill-based leagues** | ELO-style matching for fair competition |
| **Progress notifications** | Weekly email/push summaries for parents |
| **Challenge friends** | Private async challenges via shareable links |
| **Recalibration option** | Allow users to recalibrate from settings |
| **Parent dashboard** | View child's progress and learning patterns |
