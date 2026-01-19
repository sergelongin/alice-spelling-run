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

- **Correct answer**: Level increases by 1 (max 5)
- **Incorrect answer**: Level decreases by 1 (min 0)
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

In the Word Bank screen, words display their state with color coding:

| State | Color | Description |
|-------|-------|-------------|
| Available | Gray | Not yet introduced |
| Learning | Orange | Needs practice |
| Review | Blue | Making progress |
| Mastered | Green | Well learned |
