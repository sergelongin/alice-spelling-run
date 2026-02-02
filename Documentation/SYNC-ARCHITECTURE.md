# Sync Architecture (WatermelonDB)

## Overview

Alice Spelling Run uses **WatermelonDB** for offline-first local storage with **Supabase RPC functions** for cloud sync. This ensures:

- **Zero-latency gameplay**: IndexedDB queries are instant
- **Offline support**: Full functionality without internet
- **Data durability**: Changes sync to cloud when connectivity is available
- **Multi-device support**: Progress syncs across devices

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                           React App                                  │
│                                                                      │
│  ┌─────────────────┐    ┌───────────────────────────────────────┐   │
│  │  useDatabase()  │───▶│      WatermelonDB (IndexedDB)         │   │
│  │     hook        │    │  Per-Child Data:      Global Data:    │   │
│  └────────┬────────┘    │  - word_progress      - word_catalog  │   │
│           │             │  - game_sessions                      │   │
│  ┌────────┴────────┐    │  - statistics                         │   │
│  │ useWordCatalog()│───▶│  - calibration                        │   │
│  │     hook        │    │  - word_attempts                      │   │
│  └────────┬────────┘    └──────────────┬────────────────────────┘   │
│           │                            │                            │
│           ▼                            ▼                            │
│  ┌─────────────────────┐    ┌─────────────────┐                    │
│  │ syncWordCatalog()   │    │ syncWithSupabase│                    │
│  │ (syncWordCatalog.ts)│    │   (sync.ts)     │                    │
│  └─────────┬───────────┘    └────────┬────────┘                    │
└────────────┼─────────────────────────┼──────────────────────────────┘
             │                         │
             ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase RPC                                 │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  pull_word_catalog()  │  │  pull_changes() │  │ push_changes()│  │
│  │  - System words       │  │  - Per-child    │  │ - MAX counters│  │
│  │  - Parent custom words│  │  - Incremental  │  │ - LWW state   │  │
│  │  - Pull-only          │  │                 │  │ - Insert-only │  │
│  └───────────────────────┘  └─────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Two Sync Domains

The app has **two separate sync flows**:

| Sync Domain | Scope | Direction | Trigger |
|-------------|-------|-----------|---------|
| **Per-Child Data** | word_progress, game_sessions, statistics, calibration, word_attempts | Bidirectional (push + pull) | Auto on login, periodic, manual |
| **Word Catalog** | word_catalog (system + custom words) | Pull-only | On login, after custom word creation, manual |

This separation exists because:
1. **Child data** is per-child and requires push/pull with conflict resolution
2. **Word catalog** is global (shared across children) and read-only from client perspective

## Key Files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | WatermelonDB schema definition |
| `src/db/models.ts` | Model classes with field mappings |
| `src/db/sync.ts` | Sync adapter with custom reconciliation |
| `src/db/transforms.ts` | Data transformers (WatermelonDB ↔ Supabase) |
| `src/db/syncDiagnostics.ts` | Sync health checking and deep repair |
| `src/db/syncWordCatalog.ts` | Word catalog sync (pull-only, global) |
| `src/db/hooks/useDatabase.ts` | React hook for database access |
| `src/hooks/useWordCatalog.ts` | React hook for word catalog access with fallback |
| `supabase/migrations/009_watermelon_sync.sql` | RPC function definitions |
| `supabase/migrations/012_fix_push_changes_jsonb.sql` | JSON concatenation fix |
| `supabase/migrations/018_get_record_keys.sql` | RPC for orphan detection |
| `supabase/migrations/022_word_catalog_sync.sql` | RPC for word catalog sync |
| `supabase/migrations/030_simplified_push_changes.sql` | Event-sourced push_changes |
| `supabase/migrations/031_fix_introduced_at_update.sql` | Fix introduced_at in UPDATE path |
| `supabase/migrations/035_fix_mastery_computation.sql` | Fix DISTINCT ON NULL session_id bug in compute_word_mastery |

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

### 5. word_attempts

Individual word attempt history (append-only, like game_sessions).

| Field | Type | Notes |
|-------|------|-------|
| `child_id` | string | Foreign key to child |
| `word_text` | string | Word that was attempted |
| `client_attempt_id` | string | Business key for deduplication |
| `attempt_number` | number | Which try in the session (1st, 2nd, etc.) |
| `typed_text` | string | What the user typed |
| `was_correct` | boolean | Whether attempt was correct |
| `mode` | string | Game mode |
| `time_ms` | number | Time to complete (optional) |
| `attempted_at` | number | Timestamp |
| `session_id` | string | Link to game session (optional) |

**Design Decision**: Attempt history uses a normalized table, NOT a JSONB field.

See "Attempt History: Use word_attempts, Not JSONB" in Data Access Patterns section.

### 6. word_catalog (Global - Not Per-Child)

Local cache of system words and parent's custom words. **Pull-only sync**.

| Field | Type | Notes |
|-------|------|-------|
| `word_text` | string | Display text |
| `word_normalized` | string | Lowercase, no punctuation (for lookups) |
| `definition` | string | Word definition |
| `example_sentence` | string | Example usage (optional) |
| `grade_level` | number | 3-6 |
| `is_custom` | boolean | System word vs parent-created |
| `created_by` | string | Parent ID for custom words (optional) |
| `server_id` | string | Supabase word ID |
| `server_updated_at` | number | For incremental sync |

**Key Differences from Per-Child Tables**:
- **Global**: Not filtered by child_id (shared across all children)
- **Pull-only**: Client never pushes changes (custom words added via Supabase API)
- **Separate sync**: Uses `syncWordCatalog()`, not `syncWithSupabase()`
- **Fallback**: Falls back to bundled `GRADE_WORDS` files when empty

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
2. transformPushChanges() converts to server format (includes child_id per record)
3. push_changes() RPC applies with conflict resolution:
   - Each record's child_id is validated (parent must own child)
   - MAX for counters (never lose progress)
   - LWW for state (based on client_updated_at)
   - ON CONFLICT DO NOTHING for sessions
```

**NOTE**: Unlike earlier versions, we no longer filter by child_id on the client side.
Each record carries its own child_id, and the RPC validates ownership and uses that
child_id for inserts/updates. This allows syncing ALL children's data in one push.

### Word Catalog Sync (Separate Flow)

The word catalog uses a **separate sync flow** because it's global (not per-child) and pull-only.

```
1. syncWordCatalog(parentId) called (on login, after custom word creation, or manual)
2. Check rate limiting (min 5 minutes between syncs)
3. Call pull_word_catalog(p_parent_id, p_last_synced_at) RPC:
   - Returns system words (is_custom = false)
   - Returns parent's custom words (created_by = parentId)
   - Returns deleted word IDs for removal
4. Upsert words into local word_catalog table
5. Delete any words marked as deleted on server
6. Update localStorage timestamp for incremental sync
```

**Key Design Points**:

| Aspect | Per-Child Sync | Word Catalog Sync |
|--------|----------------|-------------------|
| Scope | Per-child tables | Global word_catalog table |
| Direction | Bidirectional | Pull-only |
| RPC | pull_changes / push_changes | pull_word_catalog |
| Reconciliation | By business key | By server_id |
| Filtering | By child_id | By parent_id (for custom words) |
| Fallback | None (sync required) | Bundled GRADE_WORDS files |

**Fallback Behavior**:

When the local `word_catalog` table is empty (first launch, offline), the app uses bundled word files:

```typescript
// In useWordCatalog hook
const count = await wordCatalogCollection.query().fetchCount();
if (count === 0) {
  // Return from local GRADE_WORDS files as fallback
  return getLocalFallbackWords();
}
```

## Reconciliation Strategy

WatermelonDB sync matches by record ID, but our client and server generate different UUIDs. We use **business-key reconciliation** instead:

| Table | Business Key | Rationale |
|-------|-------------|-----------|
| `word_progress` | `(child_id, word_text)` | Same word = same record |
| `game_sessions` | `(child_id, client_session_id)` | Client generates session ID |
| `statistics` | `(child_id, mode)` | One stats record per mode |
| `calibration` | `(child_id, client_calibration_id)` | Client generates calibration ID |
| `word_attempts` | `(child_id, client_attempt_id)` | Client generates attempt ID |

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

### Record Updates Must Use Decorated Field Setters

**Problem**: WatermelonDB tracks changes via `_status` and `_changed` fields. Direct `_raw` modifications bypass this tracking, causing records to appear "synced" when they have local changes that haven't been pushed.

```typescript
// ❌ WRONG - bypasses change tracking, record stays _status: "synced"
await record.update(r => {
  r._raw.total_games_played = newValue;
});

// ✅ CORRECT - uses decorated setter, properly sets _status: "updated"
await record.update(r => {
  r.totalGamesPlayed = newValue;
});
```

**Why This Matters**:
- The `@field` decorator creates getters that read from `_raw` AND setters that call `_setRaw()`
- `_setRaw()` internally marks the record as dirty (`_status: "updated"`) and tracks changed fields
- Direct `_raw` assignments skip `_setRaw()`, so the record appears unchanged to the sync engine
- Symptoms: Local data updates correctly, but changes never reach the server

**How to Verify**: Check the raw record in IndexedDB:
```javascript
// In browser DevTools
const dbReq = indexedDB.open('alice_spelling_run');
dbReq.onsuccess = () => {
  const tx = dbReq.result.transaction('LokiIncrementalData', 'readonly');
  tx.objectStore('LokiIncrementalData').get('statistics.chunk.0').onsuccess = (e) => {
    const records = JSON.parse(e.target.result.value);
    console.log(records.map(r => ({ _status: r._status, _changed: r._changed })));
  };
};
// Should show _status: "updated" and _changed: "field1,field2,..." for pending changes
```

### Multi-Child Database Architecture

**Design**: WatermelonDB's `synchronize()` operates on the ENTIRE database, not per-child.
Rather than filtering records client-side (which was error-prone), each record includes its
own `child_id` and the RPC uses that value for inserts/updates.

**Security**: The RPC validates that the authenticated parent owns each record's `child_id`:

```sql
IF NOT EXISTS (SELECT 1 FROM children WHERE id = record_child_id AND parent_id = auth.uid()) THEN
  RAISE EXCEPTION 'Unauthorized: cannot push data for child %', record_child_id;
END IF;
```

**Benefit**: This approach allows syncing all children's pending changes in a single push
operation, regardless of which child triggered the sync.

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

### PostgreSQL DISTINCT ON with NULL Values

**Critical Bug**: `DISTINCT ON (column)` treats **all NULL values as equal**, collapsing multiple rows into one.

```sql
-- ❌ BUG: If session_id is always NULL, this returns only ONE row!
SELECT DISTINCT ON (session_id) * FROM child_word_attempts
WHERE child_id = p_child_id AND LOWER(word_text) = LOWER(p_word_text)
ORDER BY session_id, attempted_at ASC;

-- With data like:
-- session_id | word_text | was_correct
-- NULL       | beautiful | true
-- NULL       | beautiful | true
-- NULL       | beautiful | true
-- Result: Only 1 row returned (all NULLs collapse)

-- ✅ FIX: Remove DISTINCT ON if the grouping column is nullable and often NULL
SELECT * FROM child_word_attempts
WHERE child_id = p_child_id AND LOWER(word_text) = LOWER(p_word_text)
ORDER BY attempted_at ASC;
```

**This caused the mastery computation bug** where a word with 3 correct attempts showed mastery level 1 instead of 3. Fixed in migration `035_fix_mastery_computation.sql`.

### Backfill Migration Timestamps

When writing migrations that backfill historical data into synced tables, **set `created_at` to the actual event time, not `NOW()`**.

**The Problem**: Incremental sync filters by timestamp (e.g., `WHERE created_at > p_last_pulled_at`). If a backfill migration runs and sets `created_at = NOW()`, but a user's `lastPulledAt` is already set to a time AFTER the migration ran, those backfilled records will never be pulled.

```sql
-- ❌ WRONG: Backfilled records may be older than lastPulledAt
INSERT INTO child_word_attempts (..., created_at)
VALUES (..., NOW());

-- ✅ CORRECT: Use actual event time so records sync based on when they happened
INSERT INTO child_word_attempts (..., created_at)
VALUES (..., v_session.played_at);  -- or attempted_at, etc.
```

**If backfill already ran with `NOW()`**: Users need to use Deep Repair (which bypasses `lastPulledAt` by passing `null` timestamp) to pull all records.

## Debugging Sync Issues

### Console Logs

```
[Sync] Starting parent-level sync for: parent-uuid children: 2
[Sync] Has unsynced changes: false
[Sync] Pulling changes since: 1705315800000
[Sync] Forcing full pull - children have no local data: ["child-uuid-abc"]
[Sync] Pulled data: {wordProgress: 24, gameSessions: 5, statistics: 1, calibration: 1, wordAttempts: 50}
[Sync] word_progress reconciled: 24 created, 0 updated
[Sync] Pushing changes (statistics=pull-only): {...}
[Sync] Push result: {success: true, synced_at: "2024-01-15T10:35:00.000Z", architecture: "event-sourced"}
[Sync] Sync completed successfully
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| `Migration syncs cannot be enabled...` | `migrationsEnabledAtVersion` set without migrations | Remove from `synchronize()` call |
| `Invalid raw record... _status or _changed` | Transform adds internal fields | Remove `_status`/`_changed` from transforms |
| `operator does not exist: json \|\| json` | Using `\|\|` on `json` type | Cast to `jsonb` before concatenation |
| Child A's data appears in Child B | Old RPC uses p_child_id param instead of record's child_id | Apply migration 024_push_uses_record_child_id.sql |
| Duplicate records after sync | Reconciliation not matching by business key | Check reconcile functions use correct key |
| `gameHistory` always empty | Reading from `statistics.game_history_json` which is null | Query `game_sessions` table directly (see Data Access Patterns) |
| Word detail shows "No attempts" despite practice | `attempt_history_json` JSONB field never synced | Data is in `word_attempts` table; run `migrateLocalAttemptHistory()` to salvage local JSONB data |
| Local 0 records, Server has data, sync says "healthy" | `lastPulledAt` timestamp issue - sync only pulls changes since last sync | Use Deep Repair to force full pull with null timestamp |
| Server data manually corrected but local unchanged | Normal sync uses LWW/MAX strategies, local may "win" | Use Deep Repair (server authority) to overwrite local |
| Orphaned local records after server cleanup | Normal sync doesn't delete records missing from server | Use Deep Repair with orphan cleanup enabled |
| Backfilled records not syncing (e.g., word_attempts) | Backfill migration set `created_at = NOW()` which is older than `lastPulledAt`, so incremental pull returns 0 | Use Deep Repair; for future backfills, set `created_at` to actual event time (e.g., `attempted_at`) |
| Word catalog shows 0 local words | Catalog never synced or sync failed | Click "Sync Word Catalog" in sync panel; check console for RPC errors |
| Custom words not appearing in catalog | Sync hasn't run since word was created | `insertCustomWord()` auto-triggers sync; manual sync if needed |
| Word definitions missing during gameplay | Local catalog empty, using fallback files | Normal on first launch; definitions from GRADE_WORDS files used as fallback |
| New child on Device A, Device B gets 0 records | Parent-level `lastPulledAt` doesn't detect per-child "first sync" | Fixed in sync.ts: `getChildrenNeedingFullSync()` forces full pull for children with no local data |
| Words show "Coming Soon" after sync on other device | `introduced_at` not included in UPDATE path of `push_changes` | Fixed in migration 031_fix_introduced_at_update.sql |
| Mastery always 1 despite multiple correct attempts | `compute_word_mastery()` uses `DISTINCT ON (session_id)` but `session_id` is always NULL (never passed), so PostgreSQL treats all NULLs as equal and collapses all attempts into one row | Fixed in migration 035_fix_mastery_computation.sql - removes DISTINCT ON clause |

### Force Re-sync

Clear WatermelonDB's sync state to force full re-sync:

```javascript
// In browser DevTools
indexedDB.deleteDatabase('watermelon');
// Then refresh the page
```

## Sync Health & Deep Repair

### Overview

The sync system includes diagnostics and repair features accessible via the cloud icon in the header. This handles scenarios where local and server data diverge, especially after manual server-side data corrections.

### Sync Health Status

| Status | Icon | Meaning |
|--------|------|---------|
| `healthy` | Green cloud + check | Local and server in sync |
| `has_unsynced` | Yellow cloud + arrow | Local changes pending upload |
| `inconsistent` | Red cloud + warning | Count mismatch detected |
| `offline` | Gray cloud | No internet connection |
| `error` | Red cloud + warning | Sync check failed |

### Repair Options

#### Sync Now
Performs an actual sync (push local, pull server) and reports the result. This replaced the old "Refresh" (read-only check) and "Quick Repair" (sync) buttons - now checking health always syncs first.

```typescript
await checkSyncHealth(childId); // Syncs, then compares counts
```

#### Deep Repair (Server Authority)
Use when server data was manually corrected and local should match server.

```typescript
await healSync({
  includeOrphanCleanup: true,
  forceRefreshCollections: ['word_progress', 'statistics', 'game_sessions', 'calibration'],
});
```

**What Deep Repair does:**
1. Deletes ALL local records for specified collections
2. Calls `pull_changes(childId, null)` with **null timestamp** (bypasses `lastPulledAt`)
3. Inserts ALL server records into local database
4. Cleans up any orphaned records (local records not on server)

### Why Deep Repair Bypasses Normal Sync

**The Problem:** WatermelonDB's `synchronize()` tracks `lastPulledAt` timestamp internally. When you delete local records:
- `synchronize()` still uses the old `lastPulledAt`
- Server returns "nothing changed since then"
- Local stays empty!

**The Solution:** `forceRefreshFromServer()` bypasses `synchronize()` entirely:

```typescript
// Directly call RPC with null timestamp = get ALL records
const { data } = await supabase.rpc('pull_changes', {
  p_child_id: childId,
  p_last_pulled_at: null, // null = full pull, not incremental
});

// Manually insert records into WatermelonDB
await database.write(async () => {
  for (const serverRecord of data.word_progress) {
    await wpCollection.create(record => {
      record._raw.id = serverRecord.id;
      // ... copy all fields
    });
  }
});
```

### Orphan Cleanup

Detects and removes local records that don't exist on server (orphans).

**How it works:**
1. Calls `get_record_keys(childId)` RPC to fetch server business keys
2. Compares local records against server keys
3. Deletes orphans (records not on server)
4. **Safe:** Records with `_status='created'` (pending upload) are NEVER deleted

```typescript
await cleanupOrphanedRecords(childId, false); // false = actually delete
await cleanupOrphanedRecords(childId, true);  // true = dry run (report only)
```

### RPC: get_record_keys

Returns business keys for all records belonging to a child. Used for efficient orphan detection without fetching full records.

```sql
-- supabase/migrations/018_get_record_keys.sql
CREATE FUNCTION get_record_keys(p_child_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'word_progress', (SELECT json_agg(word_text) FROM child_word_progress WHERE child_id = p_child_id),
    'game_sessions', (SELECT json_agg(client_session_id) FROM child_game_sessions WHERE child_id = p_child_id),
    'statistics', (SELECT json_agg(mode) FROM child_statistics WHERE child_id = p_child_id),
    'calibration', (SELECT json_agg(client_calibration_id) FROM child_calibration WHERE child_id = p_child_id)
  );
$$;
```

### When to Use Deep Repair

| Scenario | Use |
|----------|-----|
| Manually deleted server records | Deep Repair removes local orphans |
| Manually corrected mastery levels on server | Deep Repair overwrites local with server values |
| Local data corrupted or stale | Deep Repair rebuilds from server |
| Backfilled data not syncing | Deep Repair bypasses `lastPulledAt` to pull all records |
| Normal sync not working | Try Sync Now first, then Deep Repair |

### UI Access

The sync status indicator in the header provides access to repair functions:

```
[Cloud Icon] → Click to open panel
  ├── Status badge (Healthy/Inconsistent/etc.)
  ├── Record counts (local / server)
  │     - Words, Games, Stats, Attempts (per-child)
  ├── Word Catalog section
  │     - Cached count / Server count
  │     - [Sync Word Catalog] button
  ├── [Sync Now] - Sync and report health
  └── [Deep Repair (server authority)] - Full server refresh
```

The Word Catalog section shows:
- How many words are cached locally vs available on server
- Warning if local cache is missing words
- Manual sync button (bypasses rate limiting)

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

### Attempt History: Use word_attempts, Not JSONB

**Design Decision**: Word attempt history is stored in the `word_attempts` table, NOT in `word_progress.attempt_history_json`.

**Historical Context**: The schema originally had an `attempt_history_json` JSONB field on `word_progress`. This field was:
- Populated locally in WatermelonDB
- **Never included in transform functions** (transforms.ts)
- **Never synced to the server** (push_changes/pull_changes ignored it)
- Result: Attempt history was lost when switching devices

**The Fix**: A normalized `word_attempts` table was added with proper sync support (insert-only, like game_sessions).

```
word_progress (aggregates)           word_attempts (records)
├── mastery_level: 3                 ├── attempt_1: {typed: "recieve", correct: false}
├── times_used: 5                    ├── attempt_2: {typed: "receive", correct: true}
├── times_correct: 4                 └── attempt_3: {typed: "receive", correct: true}
└── attempt_history_json: (LEGACY)
```

**Migration**: A one-time migration in `useDatabase.ts` (`migrateLocalAttemptHistory()`) salvages any historical data from the JSONB field into the new table:

```typescript
// Runs once per child during initialization
async function migrateLocalAttemptHistory(childId: string) {
  // Check localStorage flag to skip if already done
  const migrationFlag = `attemptHistoryMigrationComplete_${childId}`;
  if (localStorage.getItem(migrationFlag) === 'true') return;

  // Read JSONB data from word_progress.attemptHistory
  // Create word_attempts records for each attempt
  // Mark migration complete
}
```

**Lesson Learned**: JSONB fields on parent records are tempting for "embedded" data, but they:
1. Require explicit handling in EVERY sync function (easy to miss)
2. Don't benefit from conflict resolution strategies
3. Can silently fail to sync without any errors

**Prefer normalized tables for append-only data** (attempts, sessions, events). They:
1. Sync automatically via standard table handling
2. Use insert-only deduplication (ON CONFLICT DO NOTHING)
3. Are queryable independently

### Word Catalog: Use Local Cache with Fallback

**Design Decision**: Word definitions are stored in Supabase `words` table and synced to local `word_catalog` table, with fallback to bundled TypeScript files.

**Architecture**:

```
Supabase `words` table (source of truth, ~640 words)
├── System words (is_custom=false)
└── Parent custom words (is_custom=true, created_by=parent_id)
         │
         ▼ (pull_word_catalog RPC, pull-only)
         │
WatermelonDB `word_catalog` table (local cache)
         │
         ▼ (useWordCatalog hook)
         │
Components (with fallback to GRADE_WORDS files)
```

**Why This Design**:

1. **Supabase as source of truth**: Definitions can be updated server-side without app updates
2. **Offline support**: Local cache provides instant access without network
3. **Graceful degradation**: Bundled files ensure app works on first launch before any sync
4. **Custom words**: Parents can create custom words that sync to their children

**Implementation**:

```typescript
// In components - use the hook
const { words, findWord, getWordsForGrade, isFallback } = useWordCatalog();

// The hook automatically:
// 1. Subscribes to local word_catalog table
// 2. Falls back to bundled GRADE_WORDS if table is empty
// 3. Provides lookup functions (findWord, getWordsForGrade)
```

**Sync Triggers**:

| Event | Action |
|-------|--------|
| User login | `syncWordCatalog(userId)` if stale (>24 hours) |
| Custom word created | `syncWordCatalog(userId, forceFullSync=true)` |
| Manual sync button | `syncWordCatalog(userId, forceFullSync=true)` |

**Key Files**:
- `src/db/syncWordCatalog.ts` - Sync logic
- `src/hooks/useWordCatalog.ts` - React hook with fallback
- `src/data/gradeWords/` - Bundled fallback files (~640 words)
- `supabase/migrations/022_word_catalog_sync.sql` - RPC function

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

---

## Event-Sourced Architecture Checklist

### The Golden Rule

**If a field can be derived from INSERT-only event tables, compute it server-side.**

The app uses event-sourced architecture where derived state is computed from immutable events:

| Event Table | Derived State |
|-------------|---------------|
| `word_attempts` | `mastery_level`, `correct_streak`, `times_used`, `times_correct`, `last_attempt_at`, `next_review_at`, `introduced_at` |
| `game_sessions` | `total_games_played`, `total_wins`, `streak_current`, `streak_best`, `trophy_counts` |
| `word_attempts` | `total_lifetime_points` (learning_progress) |

### Field Classification Decision Tree

When adding a new field, ask these questions:

```
1. Can this be computed from existing events?
   └─ YES → Compute server-side (add to view/trigger)
   └─ NO → Continue to #2

2. Is this an event/fact that happened?
   └─ YES → INSERT-only table with client-generated ID
            (e.g., game_sessions, word_attempts, calibration)
   └─ NO → Continue to #3

3. Is this a counter that should never decrease?
   └─ YES → Use MAX merge strategy
   └─ NO → Continue to #4

4. Is this user-sourced metadata/preference?
   └─ YES → Bidirectional sync with LWW
            (e.g., is_active, archived_at, display preferences)
```

### Anti-Pattern: Client-Sourced Derived Fields

**❌ DON'T**: Set derived fields client-side and sync bidirectionally.

This was the bug with `introduced_at`:
- Client set `introduced_at` when word entered rotation
- Client pushed to server, other devices pulled
- BUT: Sync timing, conflicts, and "local wins" logic caused inconsistencies
- Result: Device B saw words as "Coming Soon" that Device A had practiced

**✅ DO**: Compute derived fields server-side from events.

The fix for `introduced_at`:
- Server computes `introduced_at = MIN(attempted_at)` from `word_attempts`
- If a word has been attempted, it HAS been introduced
- Trigger updates stored table when attempts sync
- All devices get consistent computed value

### Implementation Pattern for Computed Fields

1. **Add to compute function** (e.g., `compute_word_mastery()`):
   ```sql
   SELECT MIN(attempted_at) INTO v_introduced_at
   FROM child_word_attempts
   WHERE child_id = p_child_id AND LOWER(word_text) = LOWER(p_word_text);
   ```

2. **Add to view** with fallback for metadata-only records:
   ```sql
   -- Computed value takes precedence, stored value is fallback
   COALESCE(cm.introduced_at, wp.introduced_at) AS introduced_at
   ```

3. **Add to trigger** to sync computed value to stored table:
   ```sql
   UPDATE child_word_progress SET
     introduced_at = COALESCE(v_mastery.introduced_at, introduced_at),
     updated_at = NOW()
   WHERE ...;
   ```

4. **Remove client-side "local wins" logic** - server is authoritative.

### Sync Strategy Reference

| Field Type | Example | Sync Direction | Merge Strategy |
|------------|---------|----------------|----------------|
| Computed from events | `mastery_level`, `introduced_at` | Pull-only | Server computes |
| Event record | `word_attempts`, `game_sessions` | Push (insert-only) | ON CONFLICT DO NOTHING |
| Counter | `times_used`, `total_games_played` | Bidirectional | MAX |
| State/preference | `is_active`, `archived_at` | Bidirectional | LWW |
| Metadata (no events yet) | `introduced_at` (parent UI) | Bidirectional | LWW (fallback) |

### Client-Side Implications

When a field becomes server-computed:

1. **Remove proactive client-side setting** (e.g., `markWordsAsIntroduced()` before gameplay)
2. **Keep safety net in record functions** for immediate local UI feedback
3. **Remove "local wins" logic in sync** - trust server value
4. **Document the computation** in CLAUDE.md sync errors table

### Testing Multi-Device Sync

Always test computed fields across devices:

1. Device A: Perform action that generates events (e.g., play game)
2. Device A: Sync to server
3. Device B: Sync from server
4. Device B: Verify computed field has correct value
5. Check: Both devices show same state for the record
