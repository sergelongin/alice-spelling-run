# Alice Spelling Run - Documentation

This folder contains detailed documentation for the Alice Spelling Run project.

## Quick Reference

For commands and high-level architecture, see [CLAUDE.md](../CLAUDE.md) in the root directory.

## Documentation Structure

| File | Description |
|------|-------------|
| [AUDIO-SYSTEM.md](./AUDIO-SYSTEM.md) | Audio generation (Cartesia TTS), storage, caching, and admin management |
| [AUTH-SYSTEM.md](./AUTH-SYSTEM.md) | Authentication, OAuth, user management, and child profiles |
| [CODING-PATTERNS.md](./CODING-PATTERNS.md) | React patterns, error handling strategies, and caching best practices |
| [GAME-MODES.md](./GAME-MODES.md) | Detailed specifications for Meadow, Savannah, and Wildlands game modes |
| [LEARNING-SYSTEM.md](./LEARNING-SYSTEM.md) | Spaced repetition algorithm, word lifecycle, and mastery intervals |
| [SYNC-ARCHITECTURE.md](./SYNC-ARCHITECTURE.md) | WatermelonDB offline-first sync with Supabase |

## Historical Reference

For implementation history and detailed phase planning, see [Plans/implementation-plan.md](../Plans/implementation-plan.md).

## Project Overview

**Alice Spelling Run** is an educational spelling game for children ages 9-12. Players spell words correctly to help Alice escape a chasing lion.

### Key Features

- **Two Game Modes**: Chill Mode (practice) and Chase Mode (challenge), with Wildlands League (competitive) planned
- **Simplified Home Screen**: Goal-oriented progress display (e.g., "1/3 days → Streak Starter") instead of abstract numbers
- **665+ Grade-Level Words**: Curated word lists for grades 3-6 with definitions and example sentences
- **Spaced Repetition**: Words are gradually introduced and reviewed based on learning science
- **AI-Powered Hints**: LLM integration for contextual spelling help
- **Progressive Context**: Definition and example sentence disclosure to aid understanding
- **Text-to-Speech**: Web Speech API for word pronunciation

### Tech Stack

- React 18 + TypeScript
- Vite for development/build
- Tailwind CSS for styling
- React Router v6 for navigation
- React Context + localStorage for state persistence
