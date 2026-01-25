# Common Visual Test Scenarios

Reference patterns for visual testing Alice Spelling Run.

## 1. New User Flow (Logged Out)

Test the experience for first-time visitors.

```bash
# Start fresh (no auth)
agent-browser navigate http://localhost:5173

# Capture landing state
agent-browser screenshot qa-screenshots/new-user-landing.png --full
agent-browser snapshot > qa-screenshots/new-user-a11y.txt
```

**Criteria to verify:**
- Welcome/hero section visible
- Sign up / Sign in buttons present
- No authenticated user elements visible
- Mode cards (if shown) accessible

## 2. Returning User Flow (With Data)

Test the experience for users with practice history.

```bash
# Login as returning user
agent-browser navigate http://localhost:5173
agent-browser fill "input[name=email]" "claude-qa-returning@testmail.dev"
agent-browser fill "input[type=password]" "TestSpelling2024x"
agent-browser click "button:has-text('Sign In')"

# Seed practice data (required for each session)
agent-browser eval "$(cat scripts/seed-returning-user.js)"
agent-browser reload

# Capture home screen with data
agent-browser screenshot qa-screenshots/returning-user-home.png --full
```

**Criteria to verify:**
- Progress bar shows actual progress
- Statistics displayed (games played, streak, etc.)
- Star words section populated (if implemented)
- Child profile selector (if multiple children)

## 3. Responsive Testing

Test at standard breakpoints.

```bash
# Desktop (default)
agent-browser set viewport 1280 800
agent-browser screenshot qa-screenshots/responsive-desktop.png --full

# Tablet
agent-browser set viewport 768 1024
agent-browser screenshot qa-screenshots/responsive-tablet.png --full

# Mobile
agent-browser set viewport 390 844
agent-browser screenshot qa-screenshots/responsive-mobile.png --full

# Reset
agent-browser set viewport 1280 800
```

**Criteria to verify:**
- No horizontal overflow
- Touch targets minimum 44px on mobile
- Navigation adapts appropriately
- Text remains readable
- Images scale properly

## 4. Game Mode Entry

Test starting each game mode.

```bash
# Navigate to home (logged in)
agent-browser navigate http://localhost:5173

# Click Meadow Mode
agent-browser click "button:has-text('Meadow')"
agent-browser screenshot qa-screenshots/meadow-start.png --full

# Go back and try Savannah
agent-browser navigate http://localhost:5173
agent-browser click "button:has-text('Savannah')"
agent-browser screenshot qa-screenshots/savannah-start.png --full
```

**Criteria to verify:**
- Mode selection buttons clickable
- Correct mode screen loads
- Game UI elements present (timer, lives, word display)
- Back/exit option available

## 5. Game In-Progress

Test active gameplay states.

```bash
# Start a game
agent-browser navigate http://localhost:5173
agent-browser click "button:has-text('Meadow')"

# Wait for game to load
sleep 2

# Capture game state
agent-browser screenshot qa-screenshots/game-playing.png --full
agent-browser snapshot > qa-screenshots/game-a11y.txt

# Interact with spelling input
agent-browser fill "input[type=text]" "test"
agent-browser screenshot qa-screenshots/game-input.png --full
```

**Criteria to verify:**
- Word display visible
- Input field focused/accessible
- Speak button functional
- Timer (if Savannah mode) visible
- Lives indicator (if Savannah mode) visible

## 6. Error States

Test error handling UI.

```bash
# Wrong answer state
agent-browser fill "input[type=text]" "wronganswer"
agent-browser click "button:has-text('Submit')"
agent-browser screenshot qa-screenshots/error-wrong-answer.png --full

# Network error (if testable)
# May require mocking network conditions
```

**Criteria to verify:**
- Error message visible and clear
- User can retry or continue
- No broken layouts
- Appropriate color/contrast for error states

## 7. Success States

Test positive feedback UI.

```bash
# Correct answer celebration
# (Requires knowing the actual word being tested)
agent-browser snapshot -i  # Check for the current word
# Then submit correct spelling
agent-browser screenshot qa-screenshots/success-correct.png --full

# Victory screen
agent-browser screenshot qa-screenshots/victory-screen.png --full
```

**Criteria to verify:**
- Celebration/confetti visible (if applicable)
- Score/trophy displayed
- Next action clear (next word, return home)
- Progress updated

## 8. Word Bank Management

Test word bank screens.

```bash
agent-browser navigate http://localhost:5173/wordbank
agent-browser screenshot qa-screenshots/wordbank-list.png --full

# Test filtering/search if available
agent-browser fill "input[placeholder*='search']" "spell"
agent-browser screenshot qa-screenshots/wordbank-filtered.png --full
```

**Criteria to verify:**
- Word list displayed
- Mastery indicators visible
- Search/filter functional
- Add/remove words (if applicable)

## 9. Statistics Screen

Test stats and achievements display.

```bash
agent-browser navigate http://localhost:5173/statistics
agent-browser screenshot qa-screenshots/statistics.png --full
```

**Criteria to verify:**
- Stats numbers match seeded data
- Charts/graphs render correctly
- Achievements displayed
- Empty states handled (for new users)

## 10. Authentication Flows

Test login/signup UI.

```bash
# Login screen
agent-browser navigate http://localhost:5173/login
agent-browser screenshot qa-screenshots/auth-login.png --full

# Signup screen
agent-browser navigate http://localhost:5173/signup
agent-browser screenshot qa-screenshots/auth-signup.png --full

# Invalid credentials error
agent-browser navigate http://localhost:5173/login
agent-browser fill "input[name=email]" "wrong@email.com"
agent-browser fill "input[type=password]" "wrongpass"
agent-browser click "button:has-text('Sign In')"
sleep 1
agent-browser screenshot qa-screenshots/auth-error.png --full
```

**Criteria to verify:**
- Form fields visible and labeled
- Submit button enabled/disabled appropriately
- Error messages clear and visible
- Google OAuth button present (if configured)
- Password visibility toggle (if implemented)

---

## Quick Test Checklist

For rapid verification after changes:

1. [ ] Home screen renders (logged out)
2. [ ] Home screen renders (logged in)
3. [ ] Mobile viewport works
4. [ ] At least one game mode starts
5. [ ] No console errors (check browser devtools)

```bash
# Quick smoke test script
agent-browser navigate http://localhost:5173
agent-browser screenshot qa-screenshots/smoke-home.png --full
agent-browser set viewport 390 844
agent-browser screenshot qa-screenshots/smoke-mobile.png --full
agent-browser set viewport 1280 800
agent-browser close
```
