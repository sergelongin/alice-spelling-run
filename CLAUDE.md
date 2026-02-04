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
- `src/db/sync.ts` - Parent-level sync adapter with business-key reconciliation
- `src/db/transforms.ts` - Data transformers between WatermelonDB and Supabase

**Parent-Level Sync Architecture:**
- `syncWithSupabaseForParent(parentId, childIds)` syncs ALL children in one operation
- Uses WatermelonDB's native `lastPulledAt` timestamp (no per-child tracking needed)
- One database per parent, containing all children's data
- One sync operation pulls/pushes data for all children at once
- Eliminates per-child timestamp workarounds that fought WatermelonDB's design

**Event-Sourced Architecture (Phase 2-3):**
Server computes derived state from events - no bidirectional sync needed:
- `game_sessions`, `word_attempts`, `calibration`: INSERT-only events (pushed to server)
- `statistics`: Computed from `game_sessions` via `computed_child_statistics` view (pull-only)
- `word_progress` mastery: Computed from `word_attempts` via `computed_word_mastery` view (pull-only)
- `word_progress.introduced_at`: Computed from earliest `word_attempts` timestamp (migration 037)
  - If a word has been attempted, it has been introduced
  - Falls back to stored value for parent-introduced words (not yet practiced)
- `word_progress` metadata: Pushed (is_active, archived_at)
- `learning_progress`: Computed from `word_attempts` via `computed_child_learning_progress` view (pull-only)
  - Points: 10 points for first-try correct, 5 points for retry correct
  - Uses MAX(computed, stored) to never lose bonus points
- `grade_progress`: Push/pull with MAX for points, LWW for milestones

**CRITICAL: New Field Checklist (Prevent Sync Bugs)**

Before adding a new synced field, ask:

1. **Can this be computed from events?** (word_attempts, game_sessions)
   - YES → Add to server-side `compute_*` function + trigger, NOT client-side
   - Example: `introduced_at` = MIN(attempted_at) from word_attempts

2. **Is this an immutable event/fact?**
   - YES → INSERT-only table with `client_*_id` for deduplication
   - Example: `word_attempts`, `game_sessions`

3. **Is this a counter that should never decrease?**
   - YES → Use MAX merge strategy in push_changes RPC
   - Example: `times_used`, `total_games_played`

4. **Is this user metadata/preference?**
   - YES → Bidirectional sync with LWW (Last-Write-Wins)
   - Example: `is_active`, `archived_at`

**Anti-Pattern**: Setting derived fields client-side then syncing bidirectionally causes multi-device inconsistencies. If a field can be derived from events, compute it server-side.

See `Documentation/SYNC-ARCHITECTURE.md` for full checklist and implementation patterns.

**Sync Protocol Rules:**
- `pullChanges()` must return raw records **without** `_status` or `_changed` fields
- WatermelonDB manages these internal fields automatically during sync
- Never add `_status: 'synced'` or `_changed: ''` to transform functions
- `synchronize()` does NOT need `migrationsEnabledAtVersion` unless using WatermelonDB migrations

**WatermelonDB Record Update Pattern (CRITICAL):**
Due to Vite/esbuild decorator transpilation issues, decorated property setters may not persist values to the database. Always use `r._raw.column_name` instead of decorated property setters when updating records:

```typescript
// ✅ CORRECT - Direct _raw access always works
await record.update(r => {
  // @ts-expect-error - WatermelonDB _raw setters not typed
  r._raw.introduced_at = now;
  // @ts-expect-error - WatermelonDB _raw setters not typed
  r._raw.is_active = true;
});

// ❌ MAY NOT WORK - Decorated setters may silently fail
await record.update(r => {
  r.introducedAtRaw = now;  // Value may not persist!
  r.isActive = true;        // Value may not persist!
});
```

**Why this happens:**
- WatermelonDB uses `@field` decorators that create setters calling `_setRaw` internally
- Vite uses esbuild which has [known issues with decorator transpilation](https://github.com/vitejs/vite-plugin-react/issues/314)
- The decorated setters appear to work (no errors thrown) but values don't persist to the database
- Direct `_raw` access bypasses the decorator layer entirely

**Multi-User Database Architecture:**
- WatermelonDB `synchronize()` operates on the **ENTIRE database**, not per-user
- `pushChanges()` receives ALL pending records from ALL children in the local DB
- Each record includes its own `child_id` in the push payload
- The RPC uses the record's `child_id` (not a parameter) for inserts/updates
- The RPC validates that the authenticated parent owns each `child_id`
- This allows syncing ALL children's data in one push operation

**Custom Reconciliation:**
The sync uses business-key reconciliation instead of ID matching because client and server generate different UUIDs:
- `word_progress`: reconciled by `(child_id, word_text)`
- `game_sessions`: reconciled by `(child_id, client_session_id)`
- `statistics`: reconciled by `(child_id, mode)`
- `calibration`: reconciled by `(child_id, client_calibration_id)`
- `word_attempts`: reconciled by `(child_id, client_attempt_id)`

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
| Cross-child data pollution (Child A's data appears in Child B) | Old RPC uses `p_child_id` param for all inserts | Apply migration `024_push_uses_record_child_id.sql` - RPC now uses record's `child_id` |
| Word detail shows "No attempts" despite practice | `attempt_history_json` JSONB field was never synced | Use `word_attempts` table instead; `migrateLocalAttemptHistory()` salvages local data |
| New child on Device B gets 0 records after sync | Parent-level `lastPulledAt` doesn't detect per-child "first sync" | Fixed: `getChildrenNeedingFullSync()` in sync.ts forces full pull for children with no local data |
| Words show "Coming Soon" on other device after sync | `introduced_at` missing from UPDATE path in `push_changes` | Fixed in migration `031_fix_introduced_at_update.sql` |
| word_progress/learning_progress stale on multi-device | Computed mastery changes but `updated_at` timestamp doesn't update | Fixed in migration `032_sync_timestamp_triggers.sql` - trigger updates `word_progress.updated_at` when `word_attempts` inserted |
| Points out of sync between devices | Bidirectional learning_progress sync with timestamp conflicts | Fixed in migration `033_computed_learning_progress.sql` - points now computed from `word_attempts` via `computed_child_learning_progress` view |
| Word mastery (mastery_level, times_used) not syncing | Migration 033 reverted word_progress to use stored table instead of computed_word_mastery view | Fixed in migration `034_fix_word_mastery_sync.sql` - restores computed view + adds trigger to keep stored values in sync |
| Mastery always 1 despite multiple correct attempts | `compute_word_mastery()` uses `DISTINCT ON (session_id)` but session_id is always NULL, so all attempts collapse into one row | Fixed in migration `035_fix_mastery_computation.sql` - removes DISTINCT ON clause |
| "X words waiting" count never changes after practice | `next_review_at` was never computed/updated - all words perpetually "due" | Fixed in migration `036_compute_next_review_at.sql` - computes `next_review_at` using Leitner intervals |
| Words stuck as "Coming Soon" despite being practiced | `wordsToIntroduce` is empty when word selection can fill session from introduced words, so available words that get played are never marked as introduced | Fixed in `GameScreen.tsx:initializeGame()` - now ensures ALL played available words get introduced, plus `recordGame()` has a safety net to fix any that slip through |
| Words "Coming Soon" on Device B after Device A plays | `introduced_at` is client-sourced field requiring bidirectional sync - doesn't match event-sourced architecture | Fixed in migration `037_compute_introduced_at.sql` - `introduced_at` now computed from earliest `word_attempts` timestamp (event-sourced approach) |

**JSONB Fields Don't Auto-Sync:**
JSONB fields (like `attempt_history_json`) require explicit handling in transforms.ts and RPC functions. If a JSONB field is missing from transforms, it silently fails to sync with no errors. **Prefer normalized tables for append-only data** (attempts, sessions, events) - they sync automatically via standard table handling.

**Supabase RPC Functions:**
- `pull_changes_for_parent(p_parent_id, p_last_pulled_at)` - Returns ALL children's data in one query (preferred)
- `pull_changes(p_child_id, p_last_pulled_at)` - Legacy: Returns data for one child
- `push_changes(p_child_id, p_changes)` - Processes client changes with conflict resolution
  - Uses each record's `child_id` (not `p_child_id`) for inserts/updates
  - Validates parent ownership of each child_id before processing
- `set_parent_pin(p_pin)` - Set/update parent PIN with bcrypt hashing
- `verify_parent_pin(p_pin)` - Verify PIN with rate limiting
- `has_parent_pin()` - Check if user has PIN set
- Defined in `supabase/migrations/009_watermelon_sync.sql`, `024_push_uses_record_child_id.sql`, `027_parent_level_sync.sql`, `030_simplified_push_changes.sql`, `031_fix_introduced_at_update.sql`, `032_sync_timestamp_triggers.sql`, `033_computed_learning_progress.sql`, `034_fix_word_mastery_sync.sql`, `035_fix_mastery_computation.sql`, `036_compute_next_review_at.sql`, `037_compute_introduced_at.sql`, `038_parent_pin.sql`

### Supabase (Database & Auth)

**Projects:**
| Environment | Project Ref | Region | Dashboard |
|-------------|-------------|--------|-----------|
| Production | `gibingvfmrmelpchlwzn` | South Asia (Mumbai) | [Dashboard](https://supabase.com/dashboard/project/gibingvfmrmelpchlwzn) |
| Development | `kphvkkoyungqebftytkt` | South Asia (Mumbai) | [Dashboard](https://supabase.com/dashboard/project/kphvkkoyungqebftytkt) |

**Migrations:** `supabase/migrations/`

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
Sign Up → Email confirmation → Sign In → Profile auto-created → Add children → Set PIN → Profile Selection
Google OAuth → Redirect to Google → Callback → Profile auto-created → Add children → Set PIN → Profile Selection
```

**Parent PIN:**
- Required 4-digit PIN protects Parent Dashboard from children
- Server-side bcrypt hashing (cost 10) via `set_parent_pin` RPC
- Rate limiting: 5 failed attempts → 15 minute lockout
- Offline verification via cached bcrypt hash (`src/lib/pinCache.ts`)
- Forgot PIN flow: re-authenticate with password → set new PIN
- PIN setup screen: `src/components/screens/PinSetupScreen.tsx`
- PIN reset modal: `src/components/parent/PinResetModal.tsx`
- Migration: `038_parent_pin.sql`

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
# Load environment variables first
source .env.development  # For dev commands
source .env              # For prod commands

# Check migration status (local vs remote)
supabase migration list -p "$DEV_DB_PASSWORD"           # Dev
supabase migration list -p "$VITE_SUPABASE_DBPASSWPRD"  # Prod

# Apply pending migrations
supabase db push -p "$DEV_DB_PASSWORD"                  # Dev
supabase db push -p "$VITE_SUPABASE_DBPASSWPRD"         # Prod

# Fix out-of-sync migration history (mark as already applied)
supabase migration repair VERSION --status applied -p "$DEV_DB_PASSWORD"           # Dev
supabase migration repair VERSION --status applied -p "$VITE_SUPABASE_DBPASSWPRD"  # Prod

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

**Environment Variables (Dev vs Prod):**

| File | Environment | Variables |
|------|-------------|-----------|
| `.env.development` | Dev | `DEV_PROJECT_REF`, `DEV_DB_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `.env` | Prod | `VITE_SUPABASE_DBPASSWPRD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

**Database password variables:**
| Environment | Variable | File |
|-------------|----------|------|
| Dev | `DEV_DB_PASSWORD` | `.env.development` |
| Prod | `VITE_SUPABASE_DBPASSWPRD` | `.env` |

**Usage:**
```bash
# Dev migrations
source .env.development
supabase db push -p "$DEV_DB_PASSWORD"

# Prod migrations (be careful!)
source .env
supabase db push -p "$VITE_SUPABASE_DBPASSWPRD"
```

**Note:** The CLI is linked to the dev project by default. For prod operations, you may need to re-link:
```bash
supabase link --project-ref gibingvfmrmelpchlwzn -p "$VITE_SUPABASE_DBPASSWPRD"
```

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

### Development & Deployment

**Environments:**
| Environment | Branch | Supabase Project | URL |
|-------------|--------|------------------|-----|
| Production | `main` | `gibingvfmrmelpchlwzn` | https://spellingrun.fictiono.us |
| Development | `develop` | `kphvkkoyungqebftytkt` | http://localhost:5173 |

**Git Workflow:**
```
main (production) ← merges from develop, auto-deploys to Vercel
  └── develop (integration) ← feature branches merge here
        └── feature/* branches
```

**Branch Protection:**
- `main`: Requires PR, status checks (`lint-and-test`), blocks force push
- `develop`: Requires status checks (`lint-and-test`)

**Local Development:**
```bash
# Uses .env.development (gitignored) which points to dev Supabase
npm run dev
```

**Deployment:**
- Vercel auto-deploys `main` to production
- PRs get preview deployments with unique URLs
- Environment variables configured in Vercel Dashboard

**Migration Workflow:**
```bash
# 1. Create migration
supabase migration new description

# 2. Apply to dev and test
source .env.development
supabase db push -p "$DEV_DB_PASSWORD"

# 3. Create PR, CI passes

# 4. Apply to prod (requires confirmation - be careful!)
source .env
supabase link --project-ref gibingvfmrmelpchlwzn -p "$VITE_SUPABASE_DBPASSWPRD"
supabase db push -p "$VITE_SUPABASE_DBPASSWPRD"
# Re-link to dev after prod migration
source .env.development
supabase link --project-ref kphvkkoyungqebftytkt -p "$DEV_DB_PASSWORD"

# 5. Merge PR → Vercel deploys
```

**Key Files:**
- `.env.development` - Dev/Prod Supabase credentials (gitignored)
- `.env.example` - Template for new developers
- `vercel.json` - Vercel configuration
- `.github/workflows/ci.yml` - CI pipeline (lint, typecheck, test, build)

**Auth Redirect Configuration:**
When adding new domains, update:
1. **Supabase Dashboard** → Authentication → URL Configuration
   - Site URL (primary domain)
   - Redirect URLs (all allowed domains with `/**` wildcard)
2. **Google Cloud Console** → OAuth credentials
   - Authorized JavaScript origins
   - Redirect URI: `https://<project>.supabase.co/auth/v1/callback`

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
