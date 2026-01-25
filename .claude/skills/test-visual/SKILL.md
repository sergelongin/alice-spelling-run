---
name: test-visual
description: This skill should be used when the user asks to "test visual", "verify UI", "check the screen", "validate changes", "take QA screenshots", or says "test my changes". Orchestrates visual testing with agent-browser.
---

# Visual Testing Skill

Automated visual testing workflow using `agent-browser` to capture screenshots, evaluate UI against acceptance criteria, and auto-fix issues.

## Workflow Overview

```
/test-visual invoked
        │
        ▼
┌─────────────────┐
│ Read Plan File  │ ← Extract acceptance criteria
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Start Dev Server│ ← npm run dev if not running
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Setup Browser   │ ← Navigate, login, seed data if needed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Capture State   │ ← Screenshots + accessibility tree
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Evaluate        │ ← Compare screenshots to criteria
└────────┬────────┘
         │
    Pass?├── Yes → Report success, cleanup
         │
         ▼ No
┌─────────────────┐
│ Auto-Fix Loop   │ ← Edit source, re-test (max 3 iterations)
└─────────────────┘
```

## Step-by-Step Instructions

### Step 1: Read Acceptance Criteria

Look for acceptance criteria in these locations (in order):
1. `Plans/*.md` - Feature plans with UI requirements
2. `.claude/plans/*.md` - Claude-generated implementation plans
3. Ask the user what to verify if no plan file exists

Extract visual criteria such as:
- Expected elements visible/hidden
- Layout requirements (spacing, alignment)
- Responsive breakpoints to test
- User flow steps to validate

### Step 2: Ensure Dev Server Running

Check if the dev server is running on localhost:5173:

```bash
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "running" || echo "not running"
```

If not running, start it in the background:

```bash
npm run dev &
sleep 3  # Wait for server to start
```

### Step 3: Setup Browser Session

Navigate to the app and set up the test state:

```bash
# Navigate to the app
agent-browser navigate http://localhost:5173

# For authenticated flows, login first
agent-browser fill "input[name=email]" "claude-qa-returning@testmail.dev"
agent-browser fill "input[type=password]" "TestSpelling2024x"
agent-browser click "button:has-text('Sign In')"

# For returning user tests, seed the data
agent-browser eval "$(cat scripts/seed-returning-user.js)"
agent-browser reload
```

**Test Account Reference:**
| Account | Email | Password | Purpose |
|---------|-------|----------|---------|
| New Signup | `claude-qa-test@testmail.dev` | `TestSpelling2024x` | Fresh user, no data |
| Returning User | `claude-qa-returning@testmail.dev` | `TestSpelling2024x` | User with history |

### Step 4: Capture Screenshots and Accessibility Tree

Create screenshots directory if needed:

```bash
mkdir -p qa-screenshots
```

Capture the current state:

```bash
# Full page screenshot
agent-browser screenshot qa-screenshots/[feature-name]-desktop.png --full

# Accessibility tree for element verification
agent-browser snapshot > qa-screenshots/[feature-name]-a11y.txt

# Mobile viewport testing
agent-browser set viewport 390 844
agent-browser screenshot qa-screenshots/[feature-name]-mobile.png --full

# Reset to desktop
agent-browser set viewport 1280 800
```

### Step 5: Evaluate Against Criteria

Use the Read tool to view the captured PNG screenshots directly. Claude can analyze:
- Element presence and visibility
- Layout and spacing issues
- Color and contrast problems
- Responsive design breakpoints
- Text content accuracy

Compare each acceptance criterion against the visual evidence.

### Step 6: Auto-Fix Loop

For each failing criterion (max 3 iterations per criterion):

1. Identify the source file causing the issue
2. Make the necessary edit to fix it
3. Wait for hot reload (1-2 seconds)
4. Re-capture screenshot
5. Re-evaluate

If still failing after 3 attempts, report the issue and move to the next criterion.

### Step 7: Cleanup

Always close the browser session when done:

```bash
agent-browser close
```

Report final results:
- List of criteria checked
- Pass/fail status for each
- Screenshots captured (with file paths)
- Any issues that couldn't be auto-fixed

## Common Commands Reference

```bash
# Navigation
agent-browser navigate [url]
agent-browser reload
agent-browser back

# Interaction
agent-browser click "[selector]"
agent-browser fill "[selector]" "[value]"
agent-browser hover "[selector]"

# Capture
agent-browser screenshot [path] --full
agent-browser snapshot          # Accessibility tree
agent-browser snapshot -i       # Interactive elements only

# Viewport
agent-browser set viewport [width] [height]
agent-browser set viewport 1280 800   # Desktop
agent-browser set viewport 390 844    # Mobile (iPhone 14)
agent-browser set viewport 768 1024   # Tablet

# Execute JavaScript
agent-browser eval "[js-code]"
agent-browser eval "$(cat [script-file])"

# Session
agent-browser close
```

## Error Handling

- **Dev server not running**: Start it automatically, wait 3 seconds
- **Login fails**: Check credentials, verify auth system working
- **Element not found**: Use `agent-browser snapshot` to inspect available elements
- **Screenshot fails**: Ensure qa-screenshots directory exists
- **Infinite fix loop**: Cap at 3 iterations, report remaining issues to user
