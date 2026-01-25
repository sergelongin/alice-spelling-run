# Coding Patterns & Best Practices

Lessons learned and established patterns for the Alice Spelling Run codebase.

## React Hooks Rules

### The Problem
React tracks hooks by call order. If a component returns early BETWEEN hooks, subsequent renders may call fewer hooks than expected, causing:
```
Uncaught Error: Rendered fewer hooks than expected.
```

### The Rule
**ALL hooks must execute before ANY conditional return.**

### Safe Pattern
```typescript
function MyComponent({ isVisible }) {
  // 1. ALL hooks first (always run, same order)
  const [state, setState] = useState(initial);
  const ref = useRef(null);

  useEffect(() => {
    // side effects
  }, []);

  // 2. Helper functions (no hooks inside)
  const handleClick = () => setState(true);

  // 3. NOW safe to return early
  if (!isVisible) return null;

  // 4. Render
  return <div>...</div>;
}
```

### Where Early Returns ARE Safe
- Inside `useMemo`/`useCallback` callbacks
- Inside event handlers
- Inside helper functions (not hooks)
- AFTER all hooks have been called

---

## Error Handling Patterns

### Pattern 1: Silent Fallback (localStorage, caches)
```typescript
try {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
} catch (error) {
  console.warn(`Error reading ${key}:`, error);
  return defaultValue;  // Never throw, always fallback
}
```
**Use for:** Non-critical operations where failure shouldn't break the app.

### Pattern 2: Explicit Error Typing
```typescript
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
}
```
**Use for:** User-facing error messages.

### Pattern 3: Multi-Level Fallbacks
```typescript
try {
  await primaryProvider.execute();
} catch {
  try {
    await secondaryProvider.execute();
  } catch {
    await tertiaryProvider.execute();
  }
}
```
**Use for:** External services (TTS, AI providers).
**Example:** `src/hooks/useTextToSpeech.ts` - Supabase → Cartesia → Browser TTS

---

## Cache Management

From `src/lib/authCache.ts`:

### Version Invalidation
```typescript
const CACHE_VERSION = 1;
const cached = JSON.parse(raw);
if (cached.version !== CACHE_VERSION) return null;  // Invalidate old format
```

### TTL-Based Expiry
```typescript
const SESSION_TTL = 5 * 60 * 1000;  // 5 minutes
if (Date.now() - cached.timestamp > SESSION_TTL) return null;
```

### Sync Flag (Prevent Waterfalls)
```typescript
let syncInProgress = false;
if (syncInProgress) return getCachedData();
syncInProgress = true;
// ... fetch fresh data
syncInProgress = false;
```

---

## Modal Pattern

### Conditional Render with Early Return
```typescript
function Modal({ isOpen, children }) {
  // Early return BEFORE hooks is safe for pure conditional components
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-content">{children}</div>
    </div>,
    document.body
  );
}
```

**Note:** This works because Modal has NO hooks. If you add hooks, move the early return after them.

---

## UI Design Patterns

### Goal-Oriented Progress Display

Instead of showing raw statistics, display progress toward meaningful goals:

```typescript
// ❌ Abstract numbers (user asks "why should I care?")
<StreakBadge streak={1} />  // "1 day streak - Great start!"
<ProgressBar mastered={0} reviewing={0} learning={22} />

// ✅ Goal-oriented (user sees the reward)
<MotivationalProgress
  streak={1}
  nextStreakAchievement={{ name: 'Streak Starter', goal: 3 }}
/>
// Shows: "🔥 1/3 days → Streak Starter"
```

**Key principle:** Every metric should answer "what am I working toward?"

### Component Consolidation

When multiple components serve similar purposes, consolidate:

```
Before: 8 competing elements
- Character scene
- Streak badge
- Hero mission card
- Chill Mode button
- Chase Mode button
- Next badge teaser
- Recent mastery badge
- Progress bar

After: 5 focused elements
- Character scene
- Hero card (primary CTA, launches Chill Mode)
- Chase Mode button (secondary option)
- Goal-oriented progress (combines streak + badges)
```

**Pattern:** Primary action as hero card, secondary actions as smaller buttons, progress as unified view.

### Color Consistency

Match component colors to their actions:
- Hero card launches Chill Mode → Use Chill Mode's green gradient
- Chase Mode button → Use Chase Mode's orange gradient

```typescript
// Hero card gradient matches mode it launches
gradient: 'from-green-500 via-emerald-500 to-teal-500'  // Chill Mode green
```

### Conditional Visibility

Hide elements when they provide no value:

```typescript
// Hide streak row when streak = 0 (no value to user)
{streak > 0 && nextStreakAchievement && (
  <StreakRow />
)}

// Show celebration when all badges earned
{allBadgesEarned && (
  <CelebrationMessage />
)}
