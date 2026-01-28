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
Main screens via React Router:
- **Player screens**: Home, WordBank, Game, Victory, GameOver, Statistics, LevelMap, PracticeComplete
- **Auth screens**: Login, Signup, ProfileSelection, ChildSetup
- **Parent screens**: ParentDashboard, ChildDetail, ChildWordBank (word management)
- **Admin screens**: AdminAudio (super_admin only)

### Trophy System
5 tiers based on remaining lives: Platinum (5), Gold (4), Silver (3), Bronze (2), Participant (1).

### Game Modes
- **Chill Mode** (`meadow`): No timer/lives, Wordle feedback, AI hints, progressive context disclosure
- **Chase Mode** (`savannah`): Timed chase, 5 lives, trophy system
- **Wildlands League** (Planned): Competitive mode with leaderboards

### Home Screen Design
Simplified layout with goal-oriented progress:
- **Hero card** (green): Primary CTA, launches Chill Mode directly
- **Chase Mode button**: Secondary option for challenge mode
- **MotivationalProgress**: Shows "🔥 1/3 days → Streak Starter" instead of abstract "1 day streak"
- Streak row hidden when streak = 0

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

### WatermelonDB Sync

The app uses WatermelonDB for offline-first local storage with Supabase sync.

**Key Files:**
- `src/db/schema.ts` - WatermelonDB schema definition
- `src/db/models.ts` - Model classes
- `src/db/sync.ts` - Sync adapter with custom reconciliation
- `src/db/transforms.ts` - Data transformers between WatermelonDB and Supabase

**Sync Protocol Rules:**
- `pullChanges()` must return raw records **without** `_status` or `_changed` fields
- WatermelonDB manages these internal fields automatically during sync
- Never add `_status: 'synced'` or `_changed: ''` to transform functions
- `synchronize()` does NOT need `migrationsEnabledAtVersion` unless using WatermelonDB migrations

**CRITICAL - Multi-User Database:**
- WatermelonDB `synchronize()` operates on the **ENTIRE database**, not per-user
- `pushChanges()` receives ALL pending records from ALL children in the local DB
- **You MUST filter pushChanges by child_id** before sending to server
- Without filtering, syncing Child B would push Child A's records under Child B's ID
- See `filterChangesByChildId()` in `sync.ts` for the implementation

**Custom Reconciliation:**
The sync uses business-key reconciliation instead of ID matching because client and server generate different UUIDs:
- `word_progress`: reconciled by `(child_id, word_text)`
- `game_sessions`: reconciled by `(child_id, client_session_id)`
- `statistics`: reconciled by `(child_id, mode)`
- `calibration`: reconciled by `(child_id, client_calibration_id)`

**Conflict Resolution:**
- Counters (times_used, times_correct): MAX strategy (never lose progress)
- Mastery state: Last-Write-Wins (LWW) based on `client_updated_at`
- Game sessions: Insert-only with deduplication

**Common Sync Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Migration syncs cannot be enabled on a database that does not support migrations` | `migrationsEnabledAtVersion` set but no migrations configured | Remove `migrationsEnabledAtVersion` from `synchronize()` |
| `Invalid raw record... must NOT have _status or _changed fields` | Transform functions adding WatermelonDB internal fields | Remove `_status` and `_changed` from `transform*FromServer()` functions |
| `operator does not exist: json \|\| json` | Using `\|\|` concatenation on `json` type | Cast to `jsonb` before concatenation (see PostgreSQL JSON vs JSONB) |
| Cross-child data pollution (Child A's data appears in Child B) | `pushChanges()` sends ALL records, server writes with single child_id | Filter changes by `child_id` before pushing (see `filterChangesByChildId()`) |

**Supabase RPC Functions:**
- `pull_changes(p_child_id, p_last_pulled_at)` - Returns all data updated since timestamp
- `push_changes(p_child_id, p_changes)` - Processes client changes with conflict resolution
- Defined in `supabase/migrations/009_watermelon_sync.sql` (fixed in `012_fix_push_changes_jsonb.sql`)

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

**PostgreSQL JSON vs JSONB:**
- `json` type: Text storage, no operators for manipulation
- `jsonb` type: Binary storage, supports `||` concatenation, `-` removal, `@>` containment
- **CRITICAL**: The `||` operator only works with `jsonb`, not `json`
- RPC functions using `JSON` parameter type must cast to `jsonb` for operations:
  ```sql
  -- Wrong: json || json (error: operator does not exist)
  COALESCE(p_changes->'foo', '[]'::json) || COALESCE(p_changes->'bar', '[]'::json)

  -- Correct: cast to jsonb first
  COALESCE((p_changes->'foo')::jsonb, '[]'::jsonb) || COALESCE((p_changes->'bar')::jsonb, '[]'::jsonb)
  ```

**Database Password:**
- Stored in `.env` as `VITE_SUPABASE_DBPASSWPRD`
- Use `$VITE_SUPABASE_DBPASSWPRD` in shell commands (load with `source .env`)

**Query Best Practices:**
- PostgREST has a **1,000 row server limit** - client `.limit()` cannot override this
- For large datasets, use **pagination** (`getWordsPaginated()`) not full fetches
- Use **COUNT queries** (`{ count: 'exact', head: true }`) for stats - no data returned
- Fetch related data **only for visible rows** (e.g., audio status for current page only)

**Query Pagination:**
- `.range(from, to)` - server-side pagination (preferred for large datasets)
- `.limit(count)` - only works within server limits (~1,000 rows)

**Key Paginated/Count Functions:**
- `getWordsPaginated()`: Server-side pagination with search support
- `getWordCount()`: Efficient COUNT query without fetching data
- `getSegmentCounts()`: COUNT query for audio segments
- `getAudioSegmentsForWords()`: Fetch audio for specific words (use for current page only)

### Learning System
- **Spaced Repetition**: Leitner-based system with mastery levels 0-5 (`src/utils/wordSelection.ts`)
- **Gradual Introduction**: Max 2 new words/session, 10/day, pauses if 15+ struggling
- **Calibration**: Adaptive grade assessment in `src/hooks/useCalibration.ts`

### Parent Word Bank Management

Parents can manage their child's word bank at `/parent-dashboard/child/:childId/word-bank`.

**Word Addition Methods:**
| Method | Introduction Behavior | Use Case |
|--------|----------------------|----------|
| Single word input | Immediate (`introducedAt = now`) | Quick additions |
| Import by Grade | Gradual (`introducedAt = null`) | Bulk curriculum setup |
| Browse Word Catalog | Gradual (`introducedAt = null`) | Browse/select from ~665 words |
| Spelling List Import | Immediate (`introducedAt = now`) | Paste school curriculum list |

**Key Components:**
- `WordCatalogModal` - Browse all grade-level words with search, filters, multi-select
- `SpellingListImport` - Paste comma/newline-separated words for batch import
- `ParentWordBank` - Full analytics dashboard with word management table

**Context Functions:**
- `addWordsFromCatalog(words)` - Gradual introduction (waits in queue)
- `importCustomWords(texts)` - Immediate introduction (starts practicing now)

### Documentation
See `/Documentation/` for detailed specs:
- `AUTH-SYSTEM.md` - Authentication, OAuth, and user management
- `GAME-MODES.md` - Mode configurations and features
- `LEARNING-SYSTEM.md` - Spaced repetition algorithm

### Word Data
~665 grade-level words (grades 3-6) with definitions and example sentences in `src/data/gradeWords/`.

### QA Test Accounts

Test accounts for use with `agent-browser` during development/QA. All accounts use the Supabase project `gibingvfmrmelpchlwzn`.

> **WARNING:** Never create test accounts via `POST /auth/v1/signup` — it sends confirmation emails that bounce on fake addresses and flags the Supabase project for high bounce rate. Always use the admin API script below.

**Creating/recreating accounts:**
```bash
./scripts/create-test-accounts.sh
```
This script uses `POST /auth/v1/admin/users` with the service_role key to create pre-confirmed users without sending any email. It's idempotent (deletes existing accounts first).

| Account | Email | Password | Purpose |
|---------|-------|----------|---------|
| New Signup | `claude-qa-test@testmail.dev` | `TestSpelling2024x` | Fresh user, no practice data. Tests onboarding, empty states, calibration flow. |
| Returning User | `claude-qa-returning@testmail.dev` | `TestSpelling2024x` | User with practice history. Tests goal progress, stats, achievements, mastery. |

**Testing with agent-browser:**

```bash
# 1. Start dev server
npm run dev

# 2. Open browser and sign in
agent-browser navigate http://localhost:5173
agent-browser fill "input[name=email]" "claude-qa-returning@testmail.dev"
agent-browser fill "input[type=password]" "TestSpelling2024x"
agent-browser click "button:has-text('Sign In')"

# 3. Select child profile (after login)
# Use `agent-browser snapshot -i` to find the profile button ref

# 4. Seed practice data (required each new browser session for Returning User)
agent-browser eval "$(cat scripts/seed-returning-user.js)"
agent-browser reload

# 5. Take screenshots
agent-browser screenshot qa-screenshots/test.png --full
agent-browser snapshot  # Accessibility tree for AI
```

**Important — localStorage seeding:**
Game data (word bank, statistics) is stored in localStorage, not Supabase. Each new `agent-browser` session starts with empty localStorage. For the "Returning User" account, you **must run the seed script** after login + onboarding to populate practice data:

```bash
agent-browser eval "$(cat scripts/seed-returning-user.js)"
agent-browser reload  # Required for React to pick up the changes
```

The seed script (`scripts/seed-returning-user.js`) creates:
- 30 words with varying mastery (8 mastered, 10 reviewing, 12 learning)
- 5 words due for review today
- 13 games played, 11 wins, 4-day streak
- 2 earned achievements

**Notes:**
- Screenshots saved to `qa-screenshots/` (gitignored)
- Use `agent-browser set viewport 390 844` for mobile testing
- Use `agent-browser close` to end the session
