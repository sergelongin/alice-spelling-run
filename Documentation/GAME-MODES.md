# Game Modes

Alice Spelling Run features three distinct game modes, each designed for different learning contexts.

## Mode Overview

| Mode | Description | Target Use Case |
|------|-------------|-----------------|
| **Meadow Mode** | Relaxed practice | Learning new words, building confidence |
| **Savannah Run** | Timed challenge | Testing mastery, earning trophies |
| **Wildlands League** | Competitive | Leaderboards, daily challenges (planned) |

---

## Meadow Mode (Practice)

A stress-free practice environment for learning and exploring new words.

### Features

| Feature | Value |
|---------|-------|
| Timer | None |
| Lives | Unlimited |
| Lion Chase | No |
| Feedback Style | Wordle (green/yellow/gray letters) |
| Attempts | Unlimited per word |
| Trophies | No |
| AI Hints | Yes (after 2 wrong attempts) |
| Context Disclosure | Yes (definition + example sentence) |

### Learning Aids

**Wordle-Style Feedback:**
- **Green**: Correct letter in correct position
- **Yellow**: Correct letter in wrong position
- **Gray**: Letter not in word

**AI-Powered Hints:**
After 2 incorrect attempts, LLM-generated hints appear to guide learning without giving away the answer.

**Progressive Context Disclosure:**
1. Word is spoken aloud (TTS)
2. After wrong attempts: Definition shown
3. After more attempts: Example sentence shown
4. Manual "More Context" button available

### Configuration

```typescript
{
  id: 'meadow',
  name: 'Meadow Mode',
  description: 'Practice spelling at your own pace',
  hasTimer: false,
  timePerWord: 0,
  hasLives: false,
  initialLives: 0,
  hasLionChase: false,
  feedbackStyle: 'wordle',
  unlimitedAttempts: true,
  awardsTrophies: false,
}
```

---

## Savannah Run (Challenge)

The core game mode with timed spelling challenges and a chasing lion.

### Features

| Feature | Value |
|---------|-------|
| Timer | 30 seconds per word |
| Lives | 5 |
| Lion Chase | Yes |
| Feedback Style | Simple (correct/incorrect) |
| Attempts | Until time runs out or lives depleted |
| Trophies | Yes |
| AI Hints | No |
| Context Disclosure | Yes (definition + example sentence) |

### Gameplay Loop

1. Word is spoken aloud
2. Player has 30 seconds to spell correctly
3. Lion advances as timer counts down
4. Correct spelling: Lion resets, next word
5. Wrong spelling or time up: Lose a life
6. Game continues until all words complete (victory) or 0 lives (game over)

### Trophy System

| Trophy | Lives Remaining | Description |
|--------|-----------------|-------------|
| Platinum | 5 | Perfect run, no mistakes |
| Gold | 4 | Excellent performance |
| Silver | 3 | Great job |
| Bronze | 2 | Good effort |
| Participant | 1 | Keep practicing! |

### Lion Distance Calculation

```typescript
const lionDistance = (timeRemaining / 30) * 100; // Percentage from player
```

### Configuration

```typescript
{
  id: 'savannah',
  name: 'Savannah Run',
  description: 'Race against the lion!',
  hasTimer: true,
  timePerWord: 30,
  hasLives: true,
  initialLives: 5,
  hasLionChase: true,
  feedbackStyle: 'simple',
  unlimitedAttempts: false,
  awardsTrophies: true,
}
```

---

## Wildlands League (Competitive)

**Status: Planned**

Asynchronous multiplayer mode with leaderboards and daily challenges.

### Planned Features

| Feature | Value |
|---------|-------|
| Timer | Yes (TBD) |
| Lives | Yes (TBD) |
| Lion Chase | Yes |
| Feedback Style | Simple |
| Challenges | Daily/Weekly |
| Leaderboards | Global and friends |
| Scoring | Time-based with accuracy bonus |

### Planned Architecture

```
/wildlands (hub)
├── Daily Challenge
├── Weekly Challenge
├── Leaderboards
│   ├── Daily
│   ├── Weekly
│   └── All-Time
└── /game?mode=wildlands
```

### Configuration (Tentative)

```typescript
{
  id: 'wildlands',
  name: 'Wildlands League',
  description: 'Compete with players worldwide',
  hasTimer: true,
  timePerWord: 20, // Faster for competition
  hasLives: true,
  initialLives: 3, // Fewer lives for difficulty
  hasLionChase: true,
  feedbackStyle: 'simple',
  unlimitedAttempts: false,
  awardsTrophies: true,
}
```

---

## Mode Selection

Modes are selected from the Home Screen and passed via URL parameter:

```
/game?mode=meadow
/game?mode=savannah
/game?mode=wildlands
```

The `GameScreen` component reads the mode parameter and applies the appropriate `GameModeConfig`.

---

## Statistics

Each mode tracks statistics separately:

- **Meadow Mode**: Words practiced, sessions completed
- **Savannah Run**: Games played, wins, losses, trophies earned
- **Wildlands League**: Challenge scores, rankings, streaks

Statistics are filtered by mode in the Statistics Screen.
