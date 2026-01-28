# Sync Architecture

## Overview

Alice Spelling Run uses an **offline-first architecture** where localStorage is the authoritative source during gameplay, with Supabase as the sync/backup target. This ensures:

- **Zero-latency gameplay**: No waiting for network requests during games
- **Offline support**: Full functionality without internet
- **Data durability**: Changes sync to cloud when connectivity is available
- **Multi-device support**: Progress syncs across devices

## Sync Tables

### 1. child_word_progress

Per-child mastery data for each word.

| Field | Merge Strategy | Notes |
|-------|---------------|-------|
| `mastery_level` | LWW | 0-5 spaced repetition level |
| `correct_streak` | LWW | Consecutive correct count |
| `times_used` | MAX | Total attempts (prevent loss) |
| `times_correct` | MAX | Total correct (prevent loss) |
| `last_attempt_at` | LWW | Determines "newer" side |
| `next_review_at` | LWW | Spaced repetition schedule |
| `introduced_at` | LWW | When word entered rotation |
| `is_active` | LWW | Active vs archived |

**Local-only fields**: `attemptHistory`, `definition`, `exampleSentence`

### 2. child_statistics

Per-mode aggregate statistics.

| Field | Merge Strategy | Notes |
|-------|---------------|-------|
| `total_games_played` | MAX | Prevent data loss |
| `total_wins` | MAX | Prevent data loss |
| `total_words_*` | MAX | Prevent data loss |
| `streak_current` | MAX | Prevent data loss |
| `streak_best` | MAX | Prevent data loss |
| `trophy_counts` | MAX per tier | Prevent trophy loss |
| `word_accuracy` | MAX per word | JSONB detailed stats |
| `error_patterns` | MAX + merge | JSONB with examples |

### 3. child_game_sessions

Individual game session history (append-only log).

- **Push**: Insert-only (immutable after creation)
- **Pull**: Merged via `mergeGameHistory()` - uses version with more complete data
- **JSONB fields**: `completed_words`, `wrong_attempts`

### 4. child_calibration

Grade-level assessment results.

- **Push-only**: Results uploaded but never pulled back
- **Rationale**: One-time assessment, can be re-done on new device

## Merge Strategies

### Last-Write-Wins (LWW)

Used for state fields where the most recent value is correct.

- Comparison based on `client_updated_at` timestamp
- Example: `masteryLevel`, `isActive`, `correctStreak`

```typescript
const localUpdated = local.lastAttemptAt ? new Date(local.lastAttemptAt).getTime() : 0;
const serverUpdated = new Date(server.client_updated_at).getTime();
const useServer = serverUpdated > localUpdated;
```

### MAX

Used for counters to prevent data loss from either side.

- Always takes the higher value
- Example: `timesUsed`, `timesCorrect`, `totalGamesPlayed`

```typescript
timesUsed: Math.max(local.timesUsed, server.times_used)
```

### Specialized

- **Earliest date**: `firstCorrectDates` (first time is first time)
- **Fastest time**: `personalBests` (lower is better)
- **Dedupe + limit**: `errorPatterns.examples` (keep 10 most recent)

## Sync Flow

### Push (Local -> Server)

```
1. Game action updates localStorage
2. Change queued in sync queue (syncQueue.ts)
3. Debounced sync (2s) or periodic sync (5min)
4. pushQueuedChanges() processes queue
5. Items marked confirmed or failed
```

### Pull (Server -> Local)

```
1. pullServerChanges() fetches since last sync
2. mergeServerData() applies changes:
   - Merge word progress (LWW + MAX)
   - Merge statistics (MAX)
   - Merge game sessions (append)
   - Apply fallback derivations if needed
   - Recalculate legacy aggregates
3. setWordBankFromSync() / setStatisticsFromSync() update state
```

### Initial Migration

First sync with existing local data:

```
1. Check hasServerData() - any word progress on server?
2. If no server data: performInitialMigration() uploads all local data
3. If server has data: Skip migration, proceed to merge
```

## Fallback Derivations

### Derive Statistics from Game Sessions

If `child_statistics` table is empty but `child_game_sessions` exists:

- Aggregate `totalGamesPlayed`, `totalWins`, `totalWordsAttempted`, etc.
- Calculate `trophyCounts` from session trophies
- Applied per mode

### Derive Word Progress from Game Sessions

If `child_word_progress` table is empty but `child_game_sessions` exists:

- `timesUsed` = count of times word appears in any session
- `timesCorrect` = count of times with `attempts === 1` (first-try correct)
- `lastAttemptAt` = most recent session containing the word
- `masteryLevel` = derived from accuracy ratio:
  - 90%+ accuracy with 5+ uses -> Level 4
  - 80%+ accuracy with 4+ uses -> Level 3
  - 70%+ accuracy with 3+ uses -> Level 2
  - 50%+ accuracy with 2+ uses -> Level 1
  - Otherwise -> Level 0

## Sync Triggers

| Trigger | Delay | Condition |
|---------|-------|-----------|
| Initial load | 100ms | After GameContext registers getters |
| Change queued | 2000ms | Debounced after change |
| Periodic | 5min | If pending changes exist |
| Reconnect | Immediate | When coming back online |

## Key Files

| File | Purpose |
|------|---------|
| `src/context/SyncContext.tsx` | Sync orchestration and triggers |
| `src/services/syncService.ts` | Core sync logic (push/pull/merge) |
| `src/services/progressService.ts` | Supabase CRUD operations |
| `src/lib/syncMerge.ts` | Merge conflict resolution |
| `src/services/syncQueue.ts` | Offline queue management |
| `src/types/sync.ts` | Type definitions |

## Debugging Sync Issues

### Check Console Logs

```
[SyncService] Pull result: {wordProgress: 0, statistics: 0, gameSessions: 7, hasChanges: true}
[SyncService] Deriving word progress from game sessions
[SyncService] Derived word progress for 15 words from 7 sessions
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Word progress not syncing | Queue not being pushed | Check sync triggers, verify online status |
| Statistics show 0 on fresh browser | Stats derived from empty gameHistory | Ensure game sessions have `completed_words` populated |
| Duplicate game sessions | Missing client_session_id dedup | Check `mergeGameHistory()` |

### Force Re-sync

Clear sync metadata to force a full re-sync:

```javascript
// In browser console
localStorage.removeItem('alice-spelling-run-sync-metadata-CHILD_ID');
```

## Database Schema Reference

### child_word_progress

```sql
CREATE TABLE child_word_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id),
  word_text TEXT NOT NULL,
  mastery_level INTEGER DEFAULT 0,
  correct_streak INTEGER DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  introduced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  client_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, word_text)
);
```

### child_game_sessions

```sql
CREATE TABLE child_game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id),
  mode TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  words_attempted INTEGER DEFAULT 0,
  words_correct INTEGER DEFAULT 0,
  won BOOLEAN DEFAULT FALSE,
  trophy TEXT,
  client_session_id TEXT NOT NULL,
  completed_words JSONB,      -- [{word, attempts, timeMs}]
  wrong_attempts JSONB,       -- [{word, attempts: [string]}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, client_session_id)
);
```

## Architecture Decisions

### Why localStorage as Source of Truth?

1. **Zero latency**: Game feedback must be instant
2. **Offline play**: Kids often play without internet
3. **Simplicity**: Single source during gameplay avoids race conditions

### Why Append-Only Game Sessions?

1. **Immutability**: Sessions can't be modified after completion
2. **Audit trail**: Full history for analytics
3. **Derivability**: Statistics can be recalculated from sessions

### Why MAX for Counters?

1. **Data preservation**: Never lose progress from either device
2. **Eventual consistency**: Both sides converge to highest known value
3. **User trust**: Progress always goes up, never mysteriously down
