# Sync Architecture Simplification Plan

## Status: COMPLETED

All phases implemented:
- Phase 1: Parent-level sync (migration 027)
- Phase 2: Computed statistics (migration 028)
- Phase 3: Computed word mastery (migration 029)
- Phase 4: Simplified push_changes (migration 030)

### Post-Implementation Bug Fixes
- **Migration 031**: Fixed `introduced_at` missing from UPDATE path in `push_changes` (words showing "Coming Soon" on other devices)
- **sync.ts**: Added `getChildrenNeedingFullSync()` to force full pull when a child has no local data (multi-device first sync issue)

---

## Executive Summary

The sync architecture is **more complex than typical** for an educational game, but the complexity is **justified** given multi-child, multi-device requirements. The architecture aligns with industry best practices (offline-first, local-first), but there are specific areas where simplification will reduce fragility without sacrificing functionality.

**Verdict**: The core design is sound. The fragility comes from implementation details, not architectural choices.

---

## Current Architecture Overview

| Component | Implementation | Industry Standard |
|-----------|----------------|-------------------|
| Local storage | WatermelonDB (SQLite) | ✅ Correct choice |
| Sync model | Pull-then-push with custom reconciliation | ✅ Standard pattern |
| Conflict resolution | MAX for counters, LWW for state, INSERT-only for events | ✅ Well-designed |
| Multi-user handling | Per-child timestamps in localStorage | ⚠️ Unusual workaround |
| Business-key reconciliation | Custom matching by (child_id, word_text) etc. | ⚠️ Non-standard |

---

## What's Being Done Right

### 1. Offline-First Architecture
The app works fully offline and syncs when connected—this is the gold standard for educational apps (used by Duolingo, Khan Academy).

### 2. Smart Conflict Resolution
```
Counters (times_used, times_correct): MAX → Never lose progress
Mastery state: LWW → Latest device wins
Game sessions: INSERT-only → Append with deduplication
```

### 3. Local-First Data Model
All gameplay happens against local WatermelonDB. Server sync is async background operation. This gives instant responsiveness (0ms perceived latency).

### 4. Per-Table Sync Strategies
Different data types have different sync strategies—this is sophisticated and correct.

---

## Sources of Fragility

### 1. **Business-Key Reconciliation** (High Complexity)

**The Problem**: Client generates UUID A, server generates UUID B for the same word. Matching by business key (word_text) instead.

```typescript
// sync.ts:137-151
const localMatch = localByWordText.get(serverRecord.word_text.toLowerCase());
if (localMatch) {
  updated.push({ ...transformed, id: localMatch.id });  // Use LOCAL id
} else {
  created.push(transformWordProgressFromServer(serverRecord));
}
```

**Why It's Fragile**:
- ~420 lines of reconciliation code across 7 tables
- Each table has subtly different matching logic
- Easy to introduce bugs when adding new tables/fields

### 2. **Per-Child Timestamp Workaround** (Medium Complexity)

**The Problem**: WatermelonDB has one global `lastPulledAt`, but per-child tracking is needed.

```typescript
// sync.ts:437-439
const perChildLastPulledAt = getLastPulledAt(childId);  // localStorage
const effectiveTimestamp = perChildLastPulledAt;
```

**Why It's Fragile**:
- Fighting against WatermelonDB's design
- localStorage can get out of sync with WatermelonDB state
- Race conditions possible when switching children rapidly

### 3. **Transform Layer Brittleness** (Medium Complexity)

**567 lines** of bidirectional transforms between WatermelonDB and Supabase:
- Timestamp conversions (ms ↔ ISO strings)
- JSON stringification/parsing for complex fields
- Field name mapping (camelCase ↔ snake_case)

**Silent Failure Mode**: If you add a JSONB field but forget to add it to transforms, it silently fails to sync with no error.

### 4. **Complex RPC Functions** (High Complexity)

The `push_changes` PostgreSQL function handles:
- 7 different table types
- MAX vs LWW vs INSERT-only strategies per table
- Per-record child_id validation
- JSONB concatenation edge cases

**~600 lines of SQL** that's hard to test and debug.

---

## Recommended Architecture: Event Sourcing with Server-Derived State

### Current Architecture (Complex)
```
Device A                          Server                         Device B
   │                                │                                │
   ├─ word_progress ───────────────►│◄─────────────── word_progress ─┤
   ├─ statistics ──────────────────►│◄───────────────── statistics ──┤
   ├─ game_sessions ───────────────►│◄─────────────── game_sessions ─┤
   │                                │                                │
   └─ Conflict resolution needed ───┴─── Conflict resolution needed ─┘
```

### Proposed Architecture (Simple)
```
Device A                          Server                         Device B
   │                                │                                │
   ├─ game_sessions (INSERT) ──────►│◄────── game_sessions (INSERT) ─┤
   ├─ word_attempts (INSERT) ──────►│◄────── word_attempts (INSERT) ─┤
   │                                │                                │
   │        ┌───────────────────────┴───────────────────────┐        │
   │        │  Server computes:                             │        │
   │        │  - statistics (from game_sessions)            │        │
   │        │  - word_progress mastery (from word_attempts) │        │
   │        │  - streaks, trophies (from events)            │        │
   │        └───────────────────────┬───────────────────────┘        │
   │                                │                                │
   ◄────── Pull computed state ─────┤────── Pull computed state ────►│
```

### What This Changes

| Table | Current | Proposed |
|-------|---------|----------|
| `game_sessions` | INSERT-only ✅ | Same (no change) |
| `word_attempts` | INSERT-only ✅ | Same (no change) |
| `calibration` | INSERT-only ✅ | Same (no change) |
| `statistics` | Bidirectional (complex) | **Pull-only** (computed server-side) |
| `word_progress` | Bidirectional (complex) | **Events + computed mastery** |
| `learning_progress` | Bidirectional (complex) | **Pull-only** (computed from points) |
| `grade_progress` | Bidirectional (complex) | **Pull-only** (computed from events) |

### Key Benefits

1. **No conflict resolution needed** — INSERT-only events never conflict
2. **No business-key reconciliation** — Client UUIDs are authoritative
3. **Server is single source of truth** — Derived state is always consistent
4. **Simpler client code** — Push events, pull state, done

### Offline Functionality (Preserved)

Both client and server can compute derived state from events:

```
Offline:  Local events ──► Client computes ──► Display stats/mastery
Online:   All events ────► Server computes ──► Pull authoritative state
```

| Feature | Works Offline? | How |
|---------|----------------|-----|
| Session history | ✅ | Query local `game_sessions` |
| Word mastery | ✅ | Compute from local `word_attempts` |
| Statistics | ✅ | Compute from local events |
| Streaks/Trophies | ✅ | Compute from local sessions |

---

## Implementation Plan

### Phase 1: Parent-Level Sync + Client UUID Authority

**Goal**: Remove per-child timestamp workaround and business-key reconciliation

**Files to Modify**:
| File | Change |
|------|--------|
| `src/db/sync.ts` | Change `syncWithSupabase(childId)` → `syncWithSupabase(parentId)`, remove per-child timestamp logic |
| `src/db/syncTimestamps.ts` | Delete entirely (use WatermelonDB's native lastPulledAt) |
| `supabase/migrations/XXX_parent_level_sync.sql` | Change `pull_changes(p_child_id)` → `pull_changes(p_parent_id)` |

**Removes**: ~470 lines of reconciliation + timestamp code

### Phase 2: Event-First Statistics

**Goal**: Stop syncing statistics bidirectionally

**Files to Modify**:
| File | Change |
|------|--------|
| `src/db/sync.ts` | Remove `statistics` from push, make pull-only |
| `src/db/transforms.ts` | Remove `transformStatisticsToServer()` |
| `supabase/migrations/XXX_computed_stats.sql` | Create `computed_child_statistics` view from `game_sessions` |

**New File**:
| File | Purpose |
|------|---------|
| `src/utils/computeStats.ts` | Shared computation logic for offline stats display |

### Phase 3: Event-First Word Progress

**Goal**: Derive mastery from attempts instead of syncing word_progress bidirectionally

**Files to Modify**:
| File | Change |
|------|--------|
| `src/db/sync.ts` | Simplify word_progress to pull-only |
| `supabase/migrations/XXX_computed_mastery.sql` | Create view deriving mastery from `word_attempts` |

### Phase 4: Cleanup

**Goal**: Remove dead code from previous sync approach

**Files to Delete/Simplify**:
- Most of `reconcilePullChanges` logic
- LWW/MAX conflict resolution code
- Complex RPC push logic

---

## Lines of Code Impact

| Component | Current | After Phase 4 |
|-----------|---------|---------------|
| `sync.ts` | 696 lines | ~150 lines |
| `transforms.ts` | 567 lines | ~200 lines |
| PostgreSQL RPC | ~600 lines | ~200 lines |
| Total sync code | ~1,800 lines | ~550 lines |

---

## Verification Plan

### Unit Tests
- [ ] Offline: Can play game, stats update locally
- [ ] Offline: Word mastery computes from local attempts
- [ ] Online: Events push without conflicts
- [ ] Multi-device: Events from both devices merge correctly

### Integration Tests
- [ ] Parent with 2 children: sync pulls both children's data
- [ ] Switch child: no timestamp confusion
- [ ] Device A plays offline → Device B plays online → Device A syncs → data merged

### Manual QA
```bash
# 1. Play game offline
npm run dev  # disconnect network
# Complete a game session

# 2. Verify local stats computed
# Check Statistics screen shows updated counts

# 3. Reconnect and sync
# Verify push shows INSERT events (no conflicts)

# 4. Pull on another device
# Verify both devices show same computed state
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Run Phase 1 in shadow mode (both old and new sync, compare results) |
| Performance of computing stats from events | Cache computed values in memory, invalidate on new events |
| Breaking existing clients | Deploy server changes as backwards-compatible (support both old and new RPC) |

---

## Timeline

| Phase | Scope | Dependencies |
|-------|-------|--------------|
| Phase 1 | Parent-level sync | None (can start immediately) |
| Phase 2 | Event-first statistics | Phase 1 (simpler sync foundation) |
| Phase 3 | Event-first word progress | Phase 2 (similar pattern) |
| Phase 4 | Cleanup | Phases 1-3 verified working |

**Start with Phase 1** — it's low-risk and immediately removes the per-child timestamp workaround that's fighting WatermelonDB's design.
