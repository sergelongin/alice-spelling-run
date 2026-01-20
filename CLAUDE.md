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

**React Patterns:**

*Rules of Hooks - Early Returns:*
- ALL hooks must run before ANY early return statement
- Early returns after hooks are safe; early returns BETWEEN hooks crash React
- Pattern: hooks → useEffect → helper functions → early return → JSX

```typescript
// ✅ CORRECT - Early return AFTER all hooks
function Component() {
  const [state, setState] = useState(false);
  useEffect(() => { /* ... */ }, []);

  if (shouldHide) return null;  // Safe here
  return <div>...</div>;
}

// ❌ WRONG - Early return BETWEEN hooks
function Component() {
  const [state, setState] = useState(false);
  if (shouldHide) return null;  // Crashes!
  useEffect(() => { /* ... */ }, []);  // Skipped on some renders
  return <div>...</div>;
}
```

*Error Handling Patterns:*
- localStorage: Try-catch with console.warn, return fallback value
- Async operations: Promise.catch() or try-catch with explicit error typing
- Multi-provider services: Cascading fallbacks (see `useTextToSpeech.ts`)

See [Documentation/CODING-PATTERNS.md](./Documentation/CODING-PATTERNS.md) for detailed patterns and examples.

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

### Supabase (Database & Auth)

**Project Info:**
- Project ref: `gibingvfmrmelpchlwzn`
- Region: South Asia (Mumbai)
- Migrations: `supabase/migrations/`

**Authentication:**
- Email/password signup with email confirmation
- Google OAuth via `signInWithOAuth({ provider: 'google' })`
- Auto-creates profile via database trigger on signup
- `AuthContext` (`src/context/AuthContext.tsx`) manages auth state

**User Model:**
- `profiles` table: extends auth.users with `role` (parent/super_admin) and `display_name`
- `children` table: child profiles linked to parent via `parent_id`
- Active child stored in localStorage, persisted across sessions

**Auth Flow:**
```
Sign Up → Email confirmation → Sign In → Profile auto-created → Add children
Google OAuth → Redirect to Google → Callback → Profile auto-created → Add children
```

**Key Auth Hooks/Components:**
- `useAuth()` - Access auth state and actions (signIn, signOut, addChild, etc.)
- `LoginForm` / `SignupForm` - Auth UI components with Google OAuth button
- `ProtectedRoute` - Route guard requiring authentication

**Google OAuth Setup (Google Cloud Console):**
- Authorized JavaScript Origins: `http://localhost:5173`, `https://yourdomain.com`
- Authorized Redirect URI: `https://gibingvfmrmelpchlwzn.supabase.co/auth/v1/callback`
- Add Client ID and Client Secret to Supabase Dashboard → Authentication → Providers → Google

**Key Commands:**
```bash
# Check migration status (local vs remote)
supabase migration list -p "$VITE_SUPABASE_DBPASSWPRD"

# Apply pending migrations
supabase db push -p "$VITE_SUPABASE_DBPASSWPRD"

# Fix out-of-sync migration history (mark as already applied)
supabase migration repair VERSION --status applied -p "$VITE_SUPABASE_DBPASSWPRD"

# View linked projects
supabase projects list
```

**Migration Best Practices:**
- Always use CLI (`supabase db push`) instead of Dashboard SQL Editor to track migrations
- Use idempotent patterns: `IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`
- If `db push` fails with "already exists" errors, use `migration repair` to sync history
- Test migrations locally with `supabase db reset --local` before pushing

**RLS Policy Gotchas:**
- Triggers with `SECURITY DEFINER` still respect RLS on target tables
- INSERT policies are often forgotten but required for signup triggers
- Service role policies allow internal operations: `TO service_role WITH CHECK (true)`

**Database Password:**
- Stored in `.env` as `VITE_SUPABASE_DBPASSWPRD`
- Use `$VITE_SUPABASE_DBPASSWPRD` in shell commands (load with `source .env`)

### Learning System
- **Spaced Repetition**: Leitner-based system with mastery levels 0-5 (`src/utils/wordSelection.ts`)
- **Gradual Introduction**: Max 2 new words/session, 10/day, pauses if 15+ struggling
- **Calibration**: Adaptive grade assessment in `src/hooks/useCalibration.ts`

### Documentation
See `/Documentation/` for detailed specs:
- `AUTH-SYSTEM.md` - Authentication, OAuth, and user management
- `GAME-MODES.md` - Mode configurations and features
- `LEARNING-SYSTEM.md` - Spaced repetition algorithm

### Word Data
~665 grade-level words (grades 3-6) with definitions and example sentences in `src/data/gradeWords/`.
