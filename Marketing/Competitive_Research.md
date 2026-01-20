# Competitive Research Report: Alice Spelling Run

**Prepared:** January 2026
**Version:** 1.0

---

## Executive Summary

Alice Spelling Run is a React-based spelling application for children ages 9-12, featuring Leitner-based spaced repetition, 9-category error pattern analysis, AI-powered hints, and gamified chase mechanics. This report provides a comprehensive competitive analysis, identifies market positioning opportunities, and recommends prioritized strategies for commercial success.

**Key Findings:**
- The EdTech spelling market is **highly competitive** with entrenched players (VocabularySpellingCity, Spelling Shed, SplashLearn)
- Alice has **genuine pedagogical innovations** (error pattern analysis, calibration system, struggling cap) but these are not yet validated or marketed
- **Critical gaps** exist: no mobile apps, no B2B features, no monetization infrastructure, placeholder graphics
- **AI differentiation is temporary** - competitors are rapidly adding AI features
- The **direct-to-consumer path is harder** than B2B (school sales), but may be more defensible

**Realistic Assessment:** Alice is a well-architected prototype with strong pedagogical foundations but requires significant investment in product completion, mobile development, and go-to-market strategy before commercial viability.

---

## Table of Contents

1. [Our Product Analysis](#1-our-product-analysis)
2. [Competitive Landscape](#2-competitive-landscape)
3. [Feature Comparison Matrix](#3-feature-comparison-matrix)
4. [Market Analysis](#4-market-analysis)
5. [Competitive Positioning](#5-competitive-positioning)
6. [Gap Analysis: Where We Win & Lose](#6-gap-analysis-where-we-win--lose)
7. [Red-Team Critique](#7-red-team-critique)
8. [Strategic Recommendations](#8-strategic-recommendations)
9. [Sources](#9-sources)

---

## 1. Our Product Analysis

### 1.1 Core Learning System

**Leitner-Based Spaced Repetition (Mastery Levels 0-5):**
| Level | Status | Review Frequency |
|-------|--------|------------------|
| 0-1 | Learning | Every session |
| 2-4 | Review | 3, 7, 14 day intervals |
| 5 | Mastered | Weekly spot-checks |

**Session Composition Algorithm (8 words):**
- 1-2 NEW words (if struggling cap not reached)
- 3-4 LEARNING words (high-frequency practice)
- 2-3 REVIEW words (spaced repetition due)
- 0-1 MASTERED word (weekly spot-check)

**Struggling Cap Innovation:**
- Pauses new word introduction when 15+ words are at mastery 0-1
- Prevents overwhelm and enforces optimal learning pace
- Max 10 new words/day, max 2 per session

### 1.2 Error Pattern Analysis (9 Categories)

Our system categorizes spelling errors into actionable types:

| Category | Example | Detection |
|----------|---------|-----------|
| Vowel Swap | "recieve" → "receive" | i/e reversal patterns |
| Double Letter | "begining" → "beginning" | Missing double consonants |
| Silent Letter | "nife" → "knife" | Missing k, w, gh, b |
| Phonetic | "enuff" → "enough" | Sound-correct spelling |
| Suffix Rules | "hapyness" → "happiness" | y→i transformations |
| Prefix Rules | "unessary" → "unnecessary" | Boundary doubling |
| Missing Letter | "diferent" → "different" | Character gaps |
| Extra Letter | "tomorroww" → "tomorrow" | Additions |
| Transposition | "freind" → "friend" | Swapped letters |

**Why This Matters:** Research shows different error types require different interventions. Phonological errors need phonemic awareness work; orthographic errors need pattern instruction. Most competitors treat all errors identically.

### 1.3 Game Modes

| Mode | Timer | Lives | Feedback | Purpose |
|------|-------|-------|----------|---------|
| **Meadow** (Practice) | None | Unlimited | Wordle-style + AI hints | Safe learning |
| **Savannah Run** (Challenge) | 30s | 5 | Correct/Incorrect | Skill application |
| **Wildlands League** (Competitive) | 20s | 3 | Leaderboards | Engagement (planned) |

**Lion Chase Mechanic:**
- Visual lion advances as 30-second timer counts down
- Creates urgency without panic (calibrated duration)
- Position: `lionDistance = (timeRemaining / 30) * 100%`

### 1.4 AI Features

**Multi-Provider Hint System:**
- Providers: OpenAI (gpt-4o-mini), Anthropic (Claude 3 Haiku), Groq
- Triggers after 2 incorrect attempts in Meadow Mode
- TTS-optimized prompts (anchor words, not phonetic notation)
- In-memory cache prevents duplicate API calls

**Example Hint Generation:**
```
"It starts like the beginning of 'under'..."
"It ends like the end of 'fish'..."
```

**Text-to-Speech (3-Tier Fallback):**
1. Supabase Audio (IndexedDB cached, pre-generated)
2. Cartesia TTS (Premium streaming)
3. Browser Web Speech API (Universal fallback)

### 1.5 Additional Systems

**Calibration Test:**
- Assesses spelling level on first run
- Starts at Grade 4, adjusts based on accuracy (3 words per round)
- Requires 2 consecutive stable rounds to confirm grade
- Tracks response times for personalization

**Word Data:**
- 665 grade-level words (Grades 3-6)
- Each word includes: definition, example sentence, category
- Organized by phonetic/pattern focus

**Trophy System:**
| Tier | Lives Remaining |
|------|-----------------|
| Platinum | 5 |
| Gold | 4 |
| Silver | 3 |
| Bronze | 2 |
| Participant | 1 |

---

## 2. Competitive Landscape

### 2.1 Tier 1: Market Leaders

#### VocabularySpellingCity (Vocabulary A-Z)
- **Target:** K-12 (emphasis K-5)
- **Key Features:** 35+ learning activities, auto-generated lesson plans, teacher dashboard, customizable word lists
- **Pricing:** $35/year (parent), $117-125/year (classroom)
- **Strengths:** Most comprehensive activity library, strong classroom tools, curriculum alignment
- **Weaknesses:** Free activities limited, games lack variety, significant price increase during rebrand
- **Market Position:** Dominant in schools, transitioning to enterprise focus

#### Spelling Shed
- **Target:** Ages 5-11
- **Key Features:** "#1 spelling game used by 20M children worldwide," 100% UK National Curriculum coverage, OpenDyslexic font, speed bonuses
- **Pricing:** $27/year (parent, 36 students), $135/year (whole school)
- **Strengths:** Excellent dyslexia support, affordable school pricing, strong UK market
- **Weaknesses:** British English focus, limited game variety, Android stability issues
- **Market Position:** UK market leader, expanding internationally

#### SplashLearn
- **Target:** PreK-Grade 5
- **Key Features:** Reading/writing/grammar/spelling/vocabulary, AI tutors, dynamic problem generation, 40M+ users
- **Pricing:** Free for teachers, $7.50-11.99/month home use
- **Strengths:** Free for educators, AI-powered personalization, massive user base
- **Weaknesses:** Younger focus, unclear pricing, support issues
- **Market Position:** Growing rapidly, expanding to older grades

### 2.2 Tier 2: Strong Competitors

| App | Target | Differentiator | Pricing |
|-----|--------|----------------|---------|
| Word Wizard | 4-10 | Phonics-focused, Montessori-inspired, 4 keyboard options | One-time purchase |
| SpellBoard | All ages | Custom quiz creation, any language, handwriting support | One-time purchase |
| Squeebles | 5-11 | 8,500+ pre-recorded words, 35 collectible characters | $3.99/month |
| Endless Alphabet | 3-11 | Animated definitions, no stress/scores, ad-free | One-time purchase |
| Osmo Words | 6-10 | Physical letter tiles + digital gameplay | $99+ hardware |

### 2.3 Free Alternatives

| App | Target | Key Features |
|-----|--------|--------------|
| Khan Academy Kids | 2-8 | 100% free, 20+ sight word videos, offline access |
| Word Club (Scripps) | Competition-age | 4,000 official words, official Spelling Bee prep |

### 2.4 School/Enterprise Solutions

| Platform | AI Features | Spelling Coverage | School Adoption |
|----------|-------------|-------------------|-----------------|
| IXL Language Arts | Yes (2024) | 200+ activities K-12 | Widespread |
| Reading Eggs | Limited | Integrated in literacy | Growing |
| Prodigy | Strong | Math-focused | Very high |

---

## 3. Feature Comparison Matrix

| Feature | Alice | Spelling Shed | VocabCity | SplashLearn | IXL |
|---------|-------|---------------|-----------|-------------|-----|
| **Age Range** | 9-12 | 5-11 | K-12 | PreK-5 | K-12 |
| **AI Hints** | Yes (multi-provider) | No | No | Yes | Yes (2024) |
| **Spaced Repetition** | Leitner (0-5) | Unknown | Unknown | Adaptive | Adaptive |
| **Error Pattern Analysis** | 9 categories | Limited | Unknown | Unknown | Explanations |
| **Calibration Test** | Yes | No | No | Yes | Yes |
| **Game Modes** | 3 | Multiple | 35+ activities | Multiple | Drill-based |
| **Chase/Urgency Mechanic** | Yes (lion) | Speed bonuses | No | Gamified | No |
| **Wordle-Style Feedback** | Yes | No | No | Unknown | No |
| **Trophy System** | 5-tier | Badges | Badges | Rewards | SmartScore |
| **Dyslexia Support** | TTS only | OpenDyslexic | Limited | Limited | Limited |
| **Teacher Dashboard** | No | Yes | Yes | Yes | Yes |
| **LMS Integration** | No | Yes | Yes | Yes | Yes |
| **Mobile Native Apps** | No | Yes | Yes | Yes | Yes |
| **Offline Mode** | Limited | Yes | Yes | Yes | Yes |
| **Word Count** | 665 | 8,500+ | Thousands | 8,000+ activities | Extensive |

---

## 4. Market Analysis

### 4.1 Market Size & Growth

| Metric | Value | Projection |
|--------|-------|------------|
| Global EdTech Market (2024) | $163.49 billion | $348.41B by 2030 (13.3% CAGR) |
| Education Apps Market (2024) | $6.2 billion | $41.6B by 2033 |
| K-12 Segment Share | 39-45% | Dominant segment |
| Mobile Learning Growth | $170.8B increase | 2024-2029 |

### 4.2 Critical Market Realities

**Retention Crisis:**
- Education apps have the **lowest retention** of any category
- Day 30 retention: ~2% (vs. 9%+ for dating/news apps)
- Implications: Must design for habit formation, not just features

**B2B vs. B2C Dynamics:**
| Channel | Pros | Cons |
|---------|------|------|
| **B2B (Schools)** | Larger contracts, lower CAC, built-in distribution | Slow sales cycles, RFP complexity, teacher buy-in required |
| **B2C (Parents)** | Faster iteration, direct feedback, brand building | High CAC, app store competition, price sensitivity |

**Key Trends (2024-2026):**
1. AI-Powered Personalization (60% growth in AI tutoring)
2. Gamification (55% adoption rate)
3. Accessibility Features (growing regulatory requirements)
4. Mobile-First (web-only is increasingly uncompetitive)

### 4.3 Parent/Teacher Pain Points

From market research:
1. **Attention spans declining** due to screen competition
2. **Dependency on spell-check** undermining actual learning
3. **20% of kids** have genuine spelling difficulties
4. **~49% of students** began 2022-23 below grade level
5. **Inconsistent pronunciation** across apps
6. **British vs. American English** conflicts
7. **Pricing confusion** and surprise charges

---

## 5. Competitive Positioning

### 5.1 Market Position Map

```
                    HIGH ENGAGEMENT
                          |
      Prodigy Math       |      Alice Spelling Run
      (Math)             |      (Potential Position)
                         |
    SplashLearn          |
    ─────────────────────┼─────────────────────
    Spelling Shed        |      IXL
                         |
    VocabCity            |
                         |
                    LOW ENGAGEMENT
         GAMES ←─────────────────────→ DRILLS
```

### 5.2 Potential Differentiation Angles

| Angle | Strength | Risk |
|-------|----------|------|
| "Science-backed learning" | Spaced repetition, error analysis are real innovations | Hard to market; parents can't evaluate pedagogy |
| "AI-powered personalization" | Multi-provider hints, adaptive difficulty | Competitors catching up rapidly; temporary advantage |
| "Ages 9-12 focus" | Less crowded than K-5 | VocabCity, IXL already serve this; not truly "underserved" |
| "Lion chase gamification" | Unique mechanic, creates urgency | Requires real graphics to compete; currently placeholders |
| "No subscription fatigue" | Could position as one-time purchase | Conflicts with API cost model |

### 5.3 Honest Positioning Assessment

**What We Actually Have:**
- Solid pedagogical foundations (Leitner, error analysis)
- Interesting game mechanic concept (lion chase)
- Modern tech stack (React, Supabase, multi-AI)
- Calibration system for personalization

**What We Don't Have:**
- Mobile apps (critical gap)
- B2B features (teacher tools, LMS integration)
- Proven efficacy data
- Real game graphics
- User base or brand recognition
- Monetization infrastructure

---

## 6. Gap Analysis: Where We Win & Lose

### 6.1 Where Alice Wins

| Advantage | vs. Competitor | Sustainability |
|-----------|----------------|----------------|
| **Error pattern analysis (9 categories)** | Most competitors use binary right/wrong | HIGH - requires significant investment to replicate well |
| **Leitner spaced repetition with struggling cap** | Many use simpler adaptive systems | MEDIUM - algorithm is public, but implementation matters |
| **AI-powered contextual hints** | Spelling Shed, VocabCity lack AI hints | LOW - all competitors adding AI rapidly |
| **Calibration test with confidence scoring** | Most skip assessment or use simple tests | MEDIUM - good UX differentiator |
| **Wordle-style feedback** | Novel in spelling apps | LOW - easy to copy |
| **Multi-mode progression** | Most have single mode or disconnected activities | MEDIUM - good pedagogical design |
| **Chase mechanic with urgency** | Unique in spelling category | MEDIUM - requires graphics investment to fully realize |

### 6.2 Where Alice Loses

| Gap | Impact | Remediation Cost |
|-----|--------|------------------|
| **No mobile apps** | CRITICAL - losing 90%+ of market | HIGH - 3-6 months development |
| **No teacher/classroom features** | HIGH - excludes B2B market | MEDIUM - 2-3 months |
| **665 words vs. thousands** | MEDIUM - limits content depth | LOW - content creation |
| **Placeholder graphics** | MEDIUM - undermines premium positioning | MEDIUM - design investment |
| **No offline mode** | MEDIUM - limits use cases | MEDIUM - architecture changes |
| **No efficacy validation** | MEDIUM - can't prove value claims | MEDIUM - A/B testing, studies |
| **No monetization** | CRITICAL - no business model | MEDIUM - Stripe integration |
| **No distribution/brand** | CRITICAL - 0 users currently | HIGH - marketing investment |

### 6.3 The Market Gap We Could Address

**Underserved Segment:** Parents of 9-12 year olds frustrated by:
1. "Baby" apps that bore older kids
2. Drill-based apps that kids hate
3. Apps that don't explain WHY spellings are wrong
4. Generic feedback that doesn't help improve

**Our Potential Value Prop:**
> "Alice Spelling Run combines the engagement of a chase game with the intelligence to understand exactly where your child struggles and provide personalized practice that actually works."

---

## 7. Red-Team Critique

A rigorous critical analysis identified these concerns:

### 7.1 Challenged Claims

| Claim | Critique | Verdict |
|-------|----------|---------|
| "Ages 9-12 is underserved" | VocabCity, IXL serve K-12; SplashLearn expanding to older grades | **Partially true** - less crowded, not empty |
| "AI is a differentiator" | SplashLearn has AI tutors; 60% of teachers use AI platforms | **Temporarily true** - eroding advantage |
| "Gamification + rigor is unique" | SplashLearn, Spelling Shed, Prodigy all claim this | **False** - industry standard positioning |
| "Error analysis is innovative" | Technically true, but hard to market to parents | **True but limited marketing value** |

### 7.2 Understated Risks

1. **API Cost Scaling:** AI hints and premium TTS cost money per use. Unit economics unknown.
2. **Wildlands League is Vaporware:** Backend is entirely mock data. Competitive mode doesn't exist.
3. **No Test Coverage:** Core game logic, spaced repetition, error analysis have zero tests.
4. **Browser Limitations:** Web Speech API inconsistent; no native performance benefits.

### 7.3 Bull Case vs. Bear Case

**Bull Case:**
- Error analysis genuinely helps kids learn faster (needs validation)
- Focus on 9-12 resonates with frustrated parents
- Premium TTS provides noticeably better experience
- First-mover on AI hints for spelling
- Mobile apps could launch fast with React Native

**Bear Case:**
- No monetization = no sustainable business
- No mobile app = excluded from primary market
- Competitors well-funded and adding AI fast
- Placeholder graphics undermine premium positioning
- No efficacy data = selling on faith

---

## 8. Strategic Recommendations

### Prioritized by Impact

#### CRITICAL (Must Do for Viability)

**1. Build Mobile Apps (iOS + Android)**
- **Impact:** Opens 90%+ of market
- **Approach:** React Native from existing React codebase; 3-4 months
- **Reasoning:** Without mobile, Alice cannot compete. Period. EdTech is mobile-first.

**2. Implement Monetization**
- **Impact:** Enables sustainable business
- **Approach:** Stripe integration, freemium model (5 words free/day, premium unlocks all)
- **Reasoning:** Need to prove business model before further investment

**3. Complete Core Product**
- Replace placeholder graphics with real lion/player sprites
- Implement working Wildlands League (or remove from marketing)
- Add offline capability for mobile
- **Reasoning:** Current product is a prototype, not shippable

#### HIGH PRIORITY (Significant Competitive Advantage)

**4. Validate Efficacy**
- **Impact:** Enables premium positioning and school sales
- **Approach:** A/B test spaced repetition vs. random selection; measure retention
- **Reasoning:** "Science-backed" claims need evidence

**5. Build Teacher/Classroom Features**
- Teacher dashboard with class progress
- Bulk student account management
- Curriculum alignment documentation (Common Core)
- **Reasoning:** B2B market has better unit economics than B2C

**6. Expand Word Content**
- Add 2,000+ words (target 3,000 minimum)
- Include etymology, morpheme breakdowns
- Add Grades 1-2 and 7-8
- **Reasoning:** 665 words is too limited vs. competitors

#### MEDIUM PRIORITY (Differentiation)

**7. Enhance Error Pattern System**
- Add personalized learning paths based on dominant error type
- Generate pattern-specific practice sessions
- Create parent-friendly reports explaining error patterns
- **Reasoning:** This is genuine innovation; needs better surfacing

**8. Optimize AI Hint Quality**
- A/B test hint styles for learning effectiveness
- Add hint caching for cost management
- Consider on-device models for cost reduction
- **Reasoning:** AI costs scale with users; need efficiency

**9. Dyslexia/Accessibility Features**
- Add OpenDyslexic font option
- Colored overlay options
- Customizable timing (extend beyond 30s)
- **Reasoning:** Underserved segment with high willingness to pay

#### LOWER PRIORITY (Nice to Have)

**10. Collaborative/Multiplayer Features**
- Research shows collaborative spelling games have highest outcomes
- Parent-child spelling sessions
- Classroom competitions

**11. Progress Sharing**
- Export progress reports for teachers/tutors
- Integration with common LMS platforms

**12. Community Features**
- Word list sharing
- Parent forums/tips

### Implementation Roadmap

| Phase | Duration | Focus | Milestone |
|-------|----------|-------|-----------|
| **Phase 1: Foundation** | 3 months | Mobile apps, monetization, polish graphics | Shippable MVP |
| **Phase 2: Validation** | 2 months | A/B testing, efficacy study, early adopter feedback | Proof of concept |
| **Phase 3: Growth** | 3 months | Content expansion, teacher features, marketing | Product-market fit |
| **Phase 4: Scale** | Ongoing | B2B sales, partnerships, international | Sustainable business |

### Recommended Go-to-Market Strategy

**Phase 1: Direct-to-Consumer Launch**
1. App Store optimization (screenshots, keywords, ASO)
2. Parent education blog/content marketing
3. Homeschool community partnerships
4. Micro-influencer campaign (education YouTubers)

**Phase 2: B2B Expansion**
1. Pilot program with 5-10 schools
2. Teacher ambassador program
3. Education conference presence
4. Case studies from pilot schools

**Pricing Strategy Recommendation:**
| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 words/day, Meadow mode only, Web Speech TTS |
| Premium | $6.99/month or $49/year | Unlimited words, all modes, Cartesia TTS, AI hints |
| Family | $9.99/month or $79/year | Premium + 4 child profiles |
| Classroom | $199/year | 30 students, teacher dashboard, progress reports |

---

## 9. Sources

### Market Research
- Grand View Research - EdTech Market Analysis 2024
- IMARC Group - Education Apps Market Report
- Precedence Research - K-12 EdTech Segment Analysis
- Business of Apps - Education App Benchmarks 2025
- Straits Research - Education Apps Market 2024

### Competitor Analysis
- VocabularySpellingCity/Vocabulary A-Z official pricing and features
- Spelling Shed official site and EdTech Impact reviews
- SplashLearn EdTech Impact profile and Capterra reviews
- Common Sense Media app reviews
- Educational App Store reviews
- App Store and Google Play store listings

### Learning Science
- Cepeda et al. - Spaced repetition meta-analysis
- Caravolas et al. - Phoneme awareness and spelling development
- SAGE Journals - Fine-grained spelling error analysis (POMAS)
- Springer - Morphology instruction meta-analysis 2024
- Nature Scientific Reports - Neural development of spelling sensitivity
- Frontiers in Psychology - Feedback timing in learning
- Self-Determination Theory - Intrinsic motivation research

### EdTech Industry
- Technavio EdTech Market Report
- AppsFlyer Retention Benchmarks
- StriveCloud - Duolingo Gamification Case Study
- OnGraph - Why EdTech Startups Fail

---

## Appendix A: Detailed Competitor Profiles

*(Detailed profiles available in separate document)*

## Appendix B: Feature Implementation Estimates

*(Technical estimates available upon request)*

## Appendix C: Financial Model

*(Requires monetization decisions before modeling)*

---

**Report prepared by:** Competitive Analysis Team
**Review date:** January 2026
**Next update:** After Phase 1 completion
