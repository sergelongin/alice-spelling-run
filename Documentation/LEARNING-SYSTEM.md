# Learning System

The Alice Spelling Run learning system uses spaced repetition and gradual word introduction based on learning science research.

## Core Principles

Based on educational research showing optimal learning at ~85% success rate with 5-10 new items per session.

| Principle | Implementation |
|-----------|---------------|
| Spaced Repetition | Words are reviewed at increasing intervals as mastery grows |
| Gradual Introduction | 1-2 new words per session, 10 per day max |
| Struggling Cap | New word introduction pauses if too many words are struggling |
| Active Recall | Players spell words from memory, not recognition |
| Immediate Feedback | Wordle-style feedback or simple correct/incorrect |

---

## Word Lifecycle

Words progress through four states based on mastery level:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  AVAILABLE  │ ──► │   LEARNING   │ ──► │   REVIEW    │ ──► │   MASTERED   │
│(not intro'd)│     │ (level 0-1)  │     │ (level 2-4) │     │  (level 5)   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
     Pool of            Active              Spaced              Weekly
   future words       practice           repetition          spot-check
```

### State Descriptions

| State | Mastery Level | Description | Review Frequency |
|-------|---------------|-------------|------------------|
| **Available** | N/A (null) | Imported but not yet introduced | Waiting in queue |
| **Learning** | 0-1 | Recently introduced | Every session |
| **Review** | 2-4 | Making progress | Spaced intervals |
| **Mastered** | 5 | Well-learned | Weekly spot-check |

---

## Mastery Intervals

Based on the Leitner spaced repetition system:

| Mastery Level | State | Review Interval |
|---------------|-------|-----------------|
| 0 | Learning | Immediately |
| 1 | Learning | 1 day |
| 2 | Review | 3 days |
| 3 | Review | 7 days |
| 4 | Review | 14 days |
| 5 | Mastered | 7 days (spot-check) |

### Mastery Changes

- **First-try correct** (no wrong attempts in session):
  - Streak increases by 1
  - Level advances IF streak meets requirement (2 consecutive for levels 4-5)
- **Same-session retry** (wrong then correct in same session):
  - Treated as if no attempt occurred (no streak/level change)
  - Records attempt history for tracking
- **Incorrect answer** (time runs out or word skipped):
  - Streak resets to 0
  - Level decreases by 2 (min 0)
- **Mastered word fails spot-check**: Drops to level 3 (Review)

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

## Session Composition

For an 8-word Quick Play session, the ideal mix is:

```
├── 1-2 NEW words (first time, if eligible)
├── 3-4 LEARNING words (level 0-1, high frequency)
├── 2-3 REVIEW words (level 2-4, due for review)
└── 0-1 MASTERED word (weekly spot-check)
```

The selection algorithm prioritizes:
1. Words that are overdue for review
2. Learning words (to build mastery quickly)
3. New words (if struggling cap not reached)
4. Mastered words due for spot-check

---

## Key Rules

### 1. New Word Introduction

- **Maximum per day**: 10 words
- **Maximum per session**: 2 words
- **Condition**: Only if struggling count (level 0-1) < 15
- **Tracking**: `lastNewWordDate` limits daily introduction

#### Word Addition Methods

Different word addition methods have different introduction behaviors:

| Method | `introducedAt` | Behavior |
|--------|----------------|----------|
| Single word input | `now` | Immediately active for practice |
| Import by Grade | `null` | Waits in queue for gradual introduction |
| Word Catalog selection | `null` | Waits in queue for gradual introduction |
| Spelling List Import | `now` | Immediately active (parent explicitly wants practice) |
| Default/Starter words | `now` | Immediately active |

**Rationale:**
- **Gradual introduction** (`introducedAt = null`): Used when bulk-adding curriculum words. The spaced repetition system controls when words enter rotation, preventing overwhelm.
- **Immediate introduction** (`introducedAt = now`): Used when parent explicitly adds specific words for practice. These are high-priority words the child needs to learn now (e.g., this week's spelling list).

### 2. Struggling Cap

When 15 or more words are at level 0-1:
- Pause new word introduction
- Focus on existing struggling words
- Resume introduction when pile shrinks below 15

### 3. Mastered Word Spot-Checks

- Once per week, include 1 mastered word per session
- Tracked via `lastMasteredCheckAt` per word
- If failed, word drops back to Review (level 3)

---

## Data Model

### Word Interface

```typescript
export interface Word {
  text: string;
  masteryLevel: number;           // 0-5
  lastAttempt: string | null;     // ISO date
  nextReview: string | null;      // ISO date when due

  // Gradual introduction fields
  introducedAt: string | null;    // null = available but not introduced
  lastMasteredCheckAt: string | null; // When mastered word was last spot-checked
}
```

### WordBank Interface

```typescript
export interface WordBank {
  words: Word[];
  lastUpdated: string;

  // Daily introduction tracking
  lastNewWordDate: string | null;    // Date when new words were last introduced
  newWordsIntroducedToday: number;   // Count of words introduced today
}
```

---

## Word Selection Algorithm

The `selectWordsForSession` function follows this priority:

1. **Overdue words** (sorted by how overdue)
2. **Learning words** (level 0-1, sorted by next review)
3. **New words** (if eligible, random selection from available pool)
4. **Mastered spot-check** (if any are due for weekly check)
5. **Fill remaining** with due review words

The algorithm returns a `WordSelectionResult` containing:
- Selected words for the session
- Metadata about word categories
- Introduction eligibility status

---

## Visual Indicators

### Home Screen Progress

The `MotivationalProgress` component displays goal-oriented progress:

| Element | Display | Purpose |
|---------|---------|---------|
| Streak progress | "🔥 1/3 days → Streak Starter" | Shows days until next streak badge |
| Mastery progress | "📚 0/10 → Word Learner" | Shows words until next mastery badge |

**Design principle:** Show "what you're working toward" not "what you have."

- Streak row hidden when streak = 0 (cleaner look)
- All badges earned shows celebration message
- Tappable to navigate to achievements view

### Word Bank Screen

Words display their state with color coding:

| State | Color | Description |
|-------|-------|-------------|
| Available | Gray | Not yet introduced |
| Learning | Orange | Needs practice |
| Review | Blue | Making progress |
| Mastered | Green | Well learned |

---

## Parent Word Bank Management

Parents can manage their child's word bank at `/parent-dashboard/child/:childId/word-bank`.

### Features

| Feature | Component | Description |
|---------|-----------|-------------|
| **Single Word Add** | Text input | Add one word at a time (immediate introduction) |
| **Import by Grade** | Modal | Import all words from Grade 3/4/5/6 (gradual introduction) |
| **Word Catalog** | `WordCatalogModal` | Browse ~665 words with search/filters, select multiple (gradual introduction) |
| **Spelling List Import** | `SpellingListImport` | Paste comma/newline list from school (immediate introduction) |
| **Word Management Table** | `WordManagementTable` | View all words, archive/unarchive, force introduce |

### Word Catalog

The catalog modal (`src/components/wordbank/WordCatalogModal.tsx`) allows:
- **Search**: Filter by word text or definition
- **Grade filter**: All / Grade 3 / 4 / 5 / 6
- **Status filter**: All / Available / Already Added
- **Multi-select**: Check multiple words to add at once
- **Pagination**: 50 words per page

Words added from catalog use **gradual introduction** - they wait in queue until the learning system introduces them.

### Spelling List Import

The import component (`src/components/wordbank/SpellingListImport.tsx`) allows:
- Paste comma-separated or newline-separated words
- Auto-parsing with duplicate detection
- Preview of words to be added
- Validation (letters only, 2+ chars)

Custom words use **immediate introduction** - they're active for practice immediately since the parent explicitly wants them practiced (e.g., this week's spelling test words).
