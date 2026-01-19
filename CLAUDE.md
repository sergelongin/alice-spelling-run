# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Type-check and build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Architecture

**Alice Spelling Run** is a React 18 + TypeScript spelling game for kids ages 9-12. Players spell words correctly within 30 seconds to escape a chasing lion.

### Tech Stack
- **Vite** for build/dev server
- **Tailwind CSS** for styling
- **React Router v6** for navigation
- **React Context + localStorage** for state persistence
- **Web Speech API** for text-to-speech word pronunciation

### Key Architectural Patterns

**State Management:**
- `GameContext` (`src/context/GameContext.tsx`) provides word bank and statistics persistence via localStorage
- `useGameState` hook manages the game state machine with `useReducer`
- All game data persists across browser sessions

**Game State Machine:**
```
IDLE -> PLAYING -> CORRECT | WRONG | TIME_UP
                      |        |         |
                 [confetti] [highlight] [lose life]
                      |        |         |
                 [next word] <-[retry]<- [check lives]
                      |                    |
              [VICTORY if done]    [GAME_OVER if 0]
```

**Core Hooks:**
- `useGameState` - Game logic state machine
- `useGameTimer` - 30-second countdown per word
- `useTextToSpeech` - Web Speech API wrapper
- `useLocalStorage` - Typed localStorage persistence

**Animation System:**
- CSS keyframe animations in `src/styles/animations.css`
- Lion position calculated from timer: `lionDistance = (timeRemaining / 30) * 100%`
- Player and lion are CSS-animated placeholder sprites (ready for real sprite sheets)

### Path Alias
Use `@/` to import from `src/`, configured in both `tsconfig.json` and `vite.config.ts`.

### Screens
Six screens via React Router: Home, WordBank, Game, Victory, GameOver, Statistics.

### Trophy System
5 tiers based on remaining lives: Platinum (5), Gold (4), Silver (3), Bronze (2), Participant (1).

### Game Modes
- **Meadow Mode** (Practice): No timer/lives, Wordle feedback, AI hints, progressive context disclosure
- **Savannah Run**: Timed chase, 5 lives, trophy system
- **Wildlands League** (Planned): Competitive mode with leaderboards

### AI Features
- **LLM Spelling Hints**: Multi-provider support (OpenAI, Anthropic, Groq) via `src/services/aiProvider.ts`
- **Cartesia TTS**: Premium text-to-speech with streaming and caching (`src/services/cartesiaTTS.ts`)
- **Error Pattern Analysis**: Categorizes mistakes (vowel swaps, silent letters, etc.) in `src/utils/errorPatternAnalysis.ts`

### Environment Variables
Key `.env` configuration:
- `VITE_AI_PROVIDER`: LLM provider (openai, anthropic, groq)
- `VITE_OPENAI_API_KEY` / `VITE_ANTHROPIC_API_KEY` / `VITE_GROQ_API_KEY`: API keys
- `VITE_CARTESIA_API_KEY`: Premium TTS
- `VITE_CARTESIA_VOICE_ID`: Voice selection

### Learning System
- **Spaced Repetition**: Leitner-based system with mastery levels 0-5 (`src/utils/wordSelection.ts`)
- **Gradual Introduction**: Max 2 new words/session, 10/day, pauses if 15+ struggling
- **Calibration**: Adaptive grade assessment in `src/hooks/useCalibration.ts`

### Documentation
See `/Documentation/` for detailed specs:
- `GAME-MODES.md` - Mode configurations and features
- `LEARNING-SYSTEM.md` - Spaced repetition algorithm

### Word Data
~665 grade-level words (grades 3-6) with definitions and example sentences in `src/data/gradeWords/`.
