---
name: diagnose
description: Deep diagnosis mode for bugs, errors, and unexpected behavior. Use when the user says "diagnose", "investigate", "debug this", "find root cause", "why is this happening", or provides error logs/symptoms to analyze. Systematically investigates until reaching 95%+ confidence on root cause.
---

# Deep Diagnosis Skill

Systematic investigation workflow that doesn't stop until reaching **95%+ confidence** on the root cause. This skill prioritizes thoroughness over speed.

## Core Principles

1. **Never guess** - Every hypothesis must be validated with evidence
2. **Follow the data** - Let observations guide the investigation, not assumptions
3. **Exhaust alternatives** - Rule out competing hypotheses before concluding
4. **Document confidence** - Explicitly state confidence level and what would increase it

## Diagnosis Workflow

```
/diagnose invoked with problem description
              │
              ▼
┌─────────────────────────┐
│ 1. Gather Symptoms      │ ← Collect all observable evidence
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Reproduce Issue      │ ← Confirm the problem exists and when
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Form Hypotheses      │ ← List ALL plausible causes
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Systematic Testing   │ ← Test each hypothesis with evidence
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. Trace Root Cause     │ ← Follow the chain to the origin
└───────────┬─────────────┘
            │
            ▼
      Confidence ≥ 95%?
            │
      No ───┴─── Yes
       │          │
       ▼          ▼
  Loop back   Report findings
  or ask      with fix proposal
  for more
  context
```

## Step-by-Step Instructions

### Step 1: Gather Symptoms

**Goal:** Collect every piece of observable evidence before forming theories.

Ask or determine:
- **What** exactly is happening? (Error messages, unexpected behavior, symptoms)
- **When** does it happen? (Always, sometimes, after specific actions)
- **Where** in the code/UI does it manifest?
- **What changed** recently? (Check git history if relevant)
- **What's the expected vs actual behavior?

**Actions:**
```bash
# Check recent changes that might be relevant
git log --oneline -20
git diff HEAD~5 --stat

# If there's an error, search for related code
# Use Grep to find error messages, function names, etc.
```

**Output a symptom summary:**
```
SYMPTOMS COLLECTED:
- [Symptom 1]
- [Symptom 2]
- [Symptom 3]
Error messages: [exact text]
Reproduction: [steps or conditions]
```

### Step 2: Reproduce the Issue

**Goal:** Confirm the problem and identify exact conditions.

- If it's a runtime error, trace the execution path
- If it's a build error, run the build and capture output
- If it's intermittent, identify patterns (timing, data conditions, environment)

**Actions:**
```bash
# For build/lint errors
npm run build 2>&1 | head -100
npm run lint 2>&1 | head -50

# For runtime errors, check browser console via dev tools
# or add temporary logging

# For test failures
npm test -- --verbose 2>&1
```

**If you cannot reproduce:** Ask user for more context, specific steps, or environment details.

### Step 3: Form Hypotheses

**Goal:** List ALL plausible causes before investigating any single one.

Generate a hypothesis list with estimated likelihood:

```
HYPOTHESES (pre-investigation):
1. [Hypothesis A] - ~40% likely because [reasoning]
2. [Hypothesis B] - ~25% likely because [reasoning]
3. [Hypothesis C] - ~20% likely because [reasoning]
4. [Hypothesis D] - ~10% likely because [reasoning]
5. [Other/unknown] - ~5%
```

**Important:** Do NOT skip this step. Premature focus on one hypothesis causes tunnel vision.

### Step 4: Systematic Testing

**Goal:** Test each hypothesis with concrete evidence.

For EACH hypothesis:
1. Define what evidence would **confirm** it
2. Define what evidence would **refute** it
3. Gather that evidence
4. Update probability

**Evidence gathering techniques:**

```bash
# Search for patterns in code
# Use Grep tool for content search
# Use Glob tool for file patterns

# Read relevant source files
# Use Read tool to examine code

# Check git blame for recent changes to suspicious code
git blame -L 50,100 src/path/to/file.tsx

# Search for similar patterns/usages
# Use Grep to find all usages of a function/variable
```

**Update hypothesis probabilities after each test:**
```
HYPOTHESIS UPDATE after testing [A]:
- [Hypothesis A]: 40% → 5% (REFUTED: [evidence])
- [Hypothesis B]: 25% → 60% (SUPPORTED: [evidence])
- [Hypothesis C]: 20% → 25% (unchanged, not yet tested)
- [Hypothesis D]: 10% → 10% (unchanged)
```

### Step 5: Trace Root Cause

**Goal:** Follow the causal chain to find the TRUE origin, not just the symptom.

Once you have a leading hypothesis (>60% confidence), trace deeper:

1. **Why** does this condition exist?
2. **What** created this condition?
3. **Where** was the original mistake made?

Keep asking "why" until you reach:
- A code change that introduced the bug
- A design decision that causes the issue
- An environmental/configuration problem
- A misunderstanding of requirements

**Evidence chain:**
```
ROOT CAUSE TRACE:
Symptom: [what user sees]
    ↓ caused by
Proximate cause: [immediate technical cause]
    ↓ caused by
Intermediate: [why proximate cause exists]
    ↓ caused by
ROOT CAUSE: [original mistake/decision]
```

### Step 6: Confidence Assessment

**Before reporting, assess confidence:**

```
CONFIDENCE ASSESSMENT:
- Current confidence: [X]%
- Evidence supporting conclusion: [list]
- Evidence that could refute it: [list]
- Alternative explanations remaining: [list]
- What would increase confidence: [list]
```

**Confidence thresholds:**
- **< 60%**: Continue investigating, need more evidence
- **60-80%**: Likely found it, but verify with one more test
- **80-95%**: High confidence, can propose fix but note remaining uncertainty
- **> 95%**: Very high confidence, propose fix

**If confidence < 95%:**
- Identify what additional information would increase confidence
- Either gather that information or ask the user for it
- Do NOT stop at low confidence

### Step 7: Report Findings

**Final report format:**

```
## Diagnosis Report

### Problem Summary
[One sentence description]

### Root Cause (Confidence: X%)
[Clear explanation of the root cause]

### Evidence
1. [Key evidence point 1]
2. [Key evidence point 2]
3. [Key evidence point 3]

### Causal Chain
[Symptom] ← [Proximate cause] ← [ROOT CAUSE]

### Proposed Fix
[Specific code changes or actions needed]

### Verification
[How to confirm the fix works]

### Alternative Hypotheses Ruled Out
- [Hypothesis]: Ruled out because [reason]
```

## Investigation Techniques

### For Runtime Errors
1. Find the exact line throwing the error
2. Trace the call stack backward
3. Identify what data/state caused the error
4. Find where that data originated

### For Logic Bugs
1. Identify expected vs actual behavior
2. Find the decision point where behavior diverges
3. Trace inputs to that decision
4. Find where inputs become incorrect

### For Build/Type Errors
1. Read the exact error message carefully
2. Go to the file/line mentioned
3. Check types flowing into that location
4. Trace type definitions to find mismatch

### For Intermittent Issues
1. Identify patterns (timing, data, sequence)
2. Look for race conditions, async issues
3. Check for state that persists between runs
4. Look for external dependencies (network, time, randomness)

### For Performance Issues
1. Identify what's slow (measure, don't guess)
2. Profile or add timing logs
3. Find the bottleneck (N+1 queries, large renders, etc.)
4. Trace why bottleneck exists

## Red Flags to Watch For

- **Premature certainty**: Feeling "sure" without testing → Force yourself to list alternatives
- **Confirmation bias**: Only finding evidence that supports your theory → Actively look for refuting evidence
- **Tunnel vision**: Focusing on one area too long → Step back and review all hypotheses
- **Surface-level fix**: Fixing the symptom, not the cause → Keep asking "why"

## When to Ask for Help

If after thorough investigation you're stuck at <80% confidence, ask the user:
- For more context about when the issue occurs
- To run specific commands or tests and share output
- About recent changes they made
- About their environment (versions, config, etc.)

**Never report low-confidence conclusions as certain. Always be explicit about uncertainty.**
