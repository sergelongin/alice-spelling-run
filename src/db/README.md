# WatermelonDB Implementation

This directory contains the WatermelonDB offline-first database implementation for Alice Spelling Run.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Web / React Native                           │
│  ┌────────────────────────────────────────────┐    │
│  │  WatermelonDB                               │    │
│  │  └── SQLite (LokiJS on web, native mobile) │    │
│  │  ┌────────────────────────────────────┐    │    │
│  │  │ Custom Sync Adapter (~500 lines)   │    │    │
│  │  └────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────┘
                       │ Direct API calls
                       ▼
              ┌─────────────────┐
              │    Supabase     │
              │  + 2 RPC funcs  │
              └─────────────────┘
```

## Directory Structure

```
src/db/
├── index.ts                # Database initialization
├── schema.ts               # WatermelonDB schema definition
├── sync.ts                 # Sync adapter for Supabase
├── transforms.ts           # Data transformers (WatermelonDB ↔ Supabase)
├── models/                 # Model classes
│   ├── index.ts
│   ├── WordProgress.ts
│   ├── GameSession.ts
│   ├── Statistics.ts
│   ├── Calibration.ts
│   ├── LearningProgress.ts
│   └── WordBankMetadata.ts
├── hooks/                  # React hooks
│   ├── index.ts
│   └── useDatabase.ts     # Main hook for database access
└── migration/
    └── localStorage-to-watermelon.ts  # Migration from localStorage
```

## Migration from localStorage

The migration script automatically runs when a child's data is first accessed:

1. Checks if localStorage has data for the child
2. If yes and not migrated, copies all data to WatermelonDB
3. Marks migration as complete
4. Does NOT delete localStorage data (kept as backup)

## Using the Database

### Option 1: Use GameContextDB (New Way)

```tsx
import { GameProvider, useGameContext } from '@/context/GameContextDB';

// Wrap your app
<GameProvider childId={activeChild.id}>
  <YourApp />
</GameProvider>

// In components
const { wordBank, recordGame, statistics } = useGameContext();
```

### Option 2: Use useDatabase Hook Directly

```tsx
import { useDatabase } from '@/db/hooks';

function MyComponent() {
  const db = useDatabase(childId, isOnline);

  // db.wordBank - current words
  // db.statistics - game statistics
  // db.addWord(text) - add a word
  // db.recordGame(result) - record a game
  // db.syncNow() - trigger sync
}
```

## Sync Strategy

### Conflict Resolution

- **Counters (times_used, times_correct, total_games)**: MAX strategy
- **Mastery state (mastery_level, correct_streak)**: LWW by client_updated_at
- **Game sessions**: Insert-only, deduplicated by client_session_id

### Sync Flow

1. **Pull**: Get changes from server since last sync
2. **Push**: Send local changes to server
3. Server applies conflict resolution in RPC functions

## Supabase RPC Functions

Migration file: `supabase/migrations/009_watermelon_sync.sql`

### pull_changes(p_child_id, p_last_pulled_at)
Returns all data modified since the timestamp.

### push_changes(p_child_id, p_changes)
Applies local changes with conflict resolution.

## Gradual Adoption

Both the old localStorage-based system and the new WatermelonDB system can coexist:

1. Old code: `GameContext` + `SyncContext`
2. New code: `GameContextDB` or `useDatabase`

To migrate:
1. Import from `@/context/GameContextDB` instead of `@/context/GameContext`
2. The API is compatible, but all operations are now async
3. Remove SyncProvider wrapper (sync is built into the new context)

## Notes

- WatermelonDB uses decorators, so `experimentalDecorators: true` is required in tsconfig.json
- On web, LokiJS adapter uses IndexedDB for persistence
- For React Native, you'll need to switch to SQLite adapter
