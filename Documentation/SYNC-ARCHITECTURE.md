# Sync Architecture (WatermelonDB)

## Overview

Alice Spelling Run uses **WatermelonDB** for offline-first local storage with **Supabase RPC functions** for cloud sync. This ensures:

- **Zero-latency gameplay**: IndexedDB queries are instant
- **Offline support**: Full functionality without internet
- **Data durability**: Changes sync to cloud when connectivity is available
- **Multi-device support**: Progress syncs across devices

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                        React App                            │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │  useDatabase()  │───▶│  WatermelonDB (IndexedDB)   │    │
│  │     hook        │    │  - word_progress            │    │
│  └────────┬────────┘    │  - game_sessions            │    │
│           │             │  - statistics               │    │
│           │             │  - calibration              │    │
│           ▼             └──────────────┬──────────────┘    │
│  ┌─────────────────┐                   │                   │
│  │ syncWithSupabase│◀──────────────────┘                   │
│  │   (sync.ts)     │                                       │
│  └────────┬────────┘                                       │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                     Supabase RPC                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │   pull_changes()    │    │      push_changes()         │  │
│  │ - Returns updated   │    │ - MAX for counters          │  │
│  │   records since     │    │ - LWW for state             │  │
│  │   last sync         │    │ - Insert-only for sessions  │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | WatermelonDB schema definition |
| `src/db/models.ts` | Model classes with field mappings |
| `src/db/sync.ts` | Sync adapter with custom reconciliation |
| `src/db/transforms.ts` | Data transformers (WatermelonDB ↔ Supabase) |
| `src/db/hooks/useDatabase.ts` | React hook for database access |
| `supabase/migrations/009_watermelon_sync.sql` | RPC function definitions |
| `supabase/migrations/012_fix_push_changes_jsonb.sql` | JSON concatenation fix |

## Sync Tables

### 1. word_progress

Per-child mastery data for each word.

| Field | Type | Merge Strategy | Notes |
|-------|------|----------------|-------|
| `child_id` | string | - | Foreign key to child |
| `word_text` | string | Business key | Used for reconciliation |
| `mastery_level` | number | LWW | 0-5 spaced repetition level |
| `correct_streak` | number | LWW | Consecutive correct count |
| `times_used` | number | MAX | Total attempts (prevent loss) |
| `times_correct` | number | MAX | Total correct (prevent loss) |
| `last_attempt_at` | number | LWW | Timestamp of last attempt |
| `next_review_at` | number | LWW | Spaced repetition schedule |
| `introduced_at` | number | LWW | When word entered rotation |
| `is_active` | boolean | LWW | Active vs archived |

### 2. statistics

Per-mode aggregate statistics.

| Field | Type | Merge Strategy | Notes |
|-------|------|----------------|-------|
| `child_id` | string | - | Foreign key to child |
| `mode` | string | Business key | 'meadow', 'savannah', 'wildlands' |
| `total_games_played` | number | MAX | Prevent data loss |
| `total_wins` | number | MAX | Prevent data loss |
| `total_words_attempted` | number | MAX | Prevent data loss |
| `total_words_correct` | number | MAX | Prevent data loss |
| `streak_current` | number | LWW | Resets on loss |
| `streak_best` | number | MAX | Never decrease |
| `trophy_counts_json` | string | MAX per tier | JSON object |

### 3. game_sessions

Individual game session history (append-only).

| Field | Type | Notes |
|-------|------|-------|
| `child_id` | string | Foreign key to child |
| `client_session_id` | string | Business key for deduplication |
| `mode` | string | Game mode |
| `played_at` | number | Timestamp |
| `duration_seconds` | number | Session length |
| `words_attempted` | number | Count |
| `words_correct` | number | Count |
| `won` | boolean | Victory status |
| `trophy` | string | Trophy tier awarded |
| `completed_words_json` | string | JSON array of word results |
| `wrong_attempts_json` | string | JSON array of wrong attempts |

### 4. calibration

Grade-level assessment results.

| Field | Type | Notes |
|-------|------|-------|
| `child_id` | string | Foreign key to child |
| `client_calibration_id` | string | Business key for deduplication |
| `completed_at` | number | Timestamp |
| `status` | string | 'completed' or 'skipped' |
| `recommended_grade` | number | 3-6 |
| `confidence` | string | 'high', 'medium', 'low' |

## Sync Flow

### Pull (Server → Local)

```
1. syncWithSupabase(childId) called
2. pullChanges() invokes Supabase RPC:
   - pull_changes(p_child_id, p_last_pulled_at)
   - Returns records updated since last sync
3. reconcilePullChanges() processes server data:
   - Matches by business key (not ID) to prevent duplicates
   - Routes to created[] or updated[] based on local match
4. WatermelonDB applies changes to IndexedDB
```

### Push (Local → Server)

```
1. WatermelonDB collects ALL dirty records from database
2. filterChangesByChildId() filters to current child only
   ⚠️ CRITICAL: Without this, other children's data leaks
3. transformPushChanges() converts to server format
4. push_changes() RPC applies with conflict resolution:
   - MAX for counters (never lose progress)
   - LWW for state (based on client_updated_at)
   - ON CONFLICT DO NOTHING for sessions
```

## Reconciliation Strategy

WatermelonDB sync matches by record ID, but our client and server generate different UUIDs. We use **business-key reconciliation** instead:

| Table | Business Key | Rationale |
|-------|-------------|-----------|
| `word_progress` | `(child_id, word_text)` | Same word = same record |
| `game_sessions` | `(child_id, client_session_id)` | Client generates session ID |
| `statistics` | `(child_id, mode)` | One stats record per mode |
| `calibration` | `(child_id, client_calibration_id)` | Client generates calibration ID |

### Reconciliation Logic

```typescript
for (const serverRecord of serverData.word_progress) {
  const localMatch = localByWordText.get(serverRecord.word_text);

  if (localMatch) {
    // Match found → update with LOCAL id
    updated.push({ ...transformed, id: localMatch.id });
  } else {
    // No match → create with server id
    created.push(transformed);
  }
}
```

## Merge Strategies

### MAX (Counters)

Used for cumulative values to prevent data loss:

```sql
times_used = GREATEST(
  (wp_item->>'times_used')::integer,
  child_word_progress.times_used
)
```

### LWW (State)

Used for state fields where newest value is correct:

```sql
mastery_level = CASE
  WHEN (wp_item->>'client_updated_at')::timestamptz > child_word_progress.client_updated_at
  THEN (wp_item->>'mastery_level')::smallint
  ELSE child_word_progress.mastery_level
END
```

### Insert-Only (Sessions)

Game sessions are immutable after creation:

```sql
ON CONFLICT (child_id, client_session_id) DO NOTHING
```

## Critical Implementation Details

### Multi-Child Database Isolation

**Problem**: WatermelonDB's `synchronize()` operates on the ENTIRE database, not per-child. Without filtering, syncing Child B would push Child A's pending records.

**Solution**: `filterChangesByChildId()` filters pushChanges before sending:

```typescript
pushChanges: async ({ changes }) => {
  // Filter to only push records for this child
  const filteredChanges = filterChangesByChildId(changes, childId);
  const transformedChanges = transformPushChanges(filteredChanges);
  // ...
}
```

### Transform Functions Must NOT Include Internal Fields

WatermelonDB manages `_status` and `_changed` internally. Transform functions must NOT add these:

```typescript
// ❌ WRONG - causes sync error
return { id: row.id, _status: 'synced', _changed: '', ... }

// ✅ CORRECT
return { id: row.id, child_id: row.child_id, ... }
```

### PostgreSQL JSON vs JSONB

The `||` concatenation operator only works with `jsonb`, not `json`:

```sql
-- ❌ WRONG: operator does not exist: json || json
COALESCE(p_changes->'foo', '[]'::json) || COALESCE(p_changes->'bar', '[]'::json)

-- ✅ CORRECT: cast to jsonb first
COALESCE((p_changes->'foo')::jsonb, '[]'::jsonb) || COALESCE((p_changes->'bar')::jsonb, '[]'::jsonb)
```

## Debugging Sync Issues

### Console Logs

```
[Sync] Starting sync for child: abc-123
[Sync] Pulling changes since: 2024-01-15T10:30:00.000Z
[Sync] Pulled data: {wordProgress: 24, gameSessions: 5, statistics: 1, calibration: 1}
[Sync] word_progress reconciled: 0 created, 24 updated
[Sync] Pushing changes
[Sync] Push result: {success: true, synced_at: "2024-01-15T10:35:00.000Z"}
[Sync] Sync completed successfully
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `Migration syncs cannot be enabled...` | `migrationsEnabledAtVersion` set without migrations | Remove from `synchronize()` call |
| `Invalid raw record... _status or _changed` | Transform adds internal fields | Remove `_status`/`_changed` from transforms |
| `operator does not exist: json \|\| json` | Using `\|\|` on `json` type | Cast to `jsonb` before concatenation |
| Child A's data appears in Child B | pushChanges sends all children's data | Ensure `filterChangesByChildId()` is called |
| Duplicate records after sync | Reconciliation not matching by business key | Check reconcile functions use correct key |
| `gameHistory` always empty | Reading from `statistics.game_history_json` which is null | Query `game_sessions` table directly (see Data Access Patterns) |

### Force Re-sync

Clear WatermelonDB's sync state to force full re-sync:

```javascript
// In browser DevTools
indexedDB.deleteDatabase('watermelon');
// Then refresh the page
```

## Data Access Patterns

### Game History: Query game_sessions, Not statistics

**Design Decision**: Game history is stored in `game_sessions` table, NOT in `statistics.game_history_json`.

The `statistics` table stores **aggregate counters** (total games, wins, streaks) while `game_sessions` stores **individual game records** with full details. This separation follows normalization principles:

```
statistics (aggregates)          game_sessions (records)
├── total_games_played: 15       ├── session_1: {mode, trophy, completedWords...}
├── total_wins: 12               ├── session_2: {mode, trophy, completedWords...}
├── streak_current: 3            └── session_3: {mode, trophy, completedWords...}
└── trophy_counts: {...}
```

**Implementation in useDatabase.ts**:

```typescript
// ❌ WRONG: statistics.game_history_json is always null
const history = statisticsRecord.gameHistory || [];

// ✅ CORRECT: Subscribe to game_sessions and build history from there
const [gameSessionRecords, setGameSessionRecords] = useState<GameSession[]>([]);

// In subscribeToData():
const gsSubscription = gameSessionCollection
  .query(Q.where('child_id', childId), Q.sortBy('played_at', Q.desc))
  .observe()
  .subscribe(records => setGameSessionRecords(records));

// In statisticsToGameStatistics():
initial.gameHistory = gameSessions.map(gameSessionToGameResult);
```

**Why This Design**:
1. **Single source of truth**: Game details live in one place
2. **Efficient sync**: Only counters sync in statistics (small payload)
3. **Query flexibility**: Can filter/sort game_sessions independently
4. **No data duplication**: Avoids keeping history in two places

## Architecture Decisions

### Why WatermelonDB?

1. **Reactive**: Observable queries auto-update React components
2. **Lazy loading**: Large datasets don't block UI
3. **Built-in sync**: Designed for offline-first with sync primitives
4. **IndexedDB**: Larger storage than localStorage (GB vs 5MB)

### Why Custom Reconciliation?

1. **UUID mismatch**: Client and server generate different IDs
2. **Business semantics**: "Same word" matters more than "same UUID"
3. **Deduplication**: Prevents duplicate records from sync races

### Why MAX for Counters?

1. **Data preservation**: Never lose progress from either device
2. **Eventual consistency**: Both sides converge to highest value
3. **User trust**: Progress only goes up, never mysteriously down

### Why LWW for State?

1. **Latest wins**: Most recent action is user's intent
2. **Simple resolution**: No complex merge logic needed
3. **Predictable**: User can understand the behavior
