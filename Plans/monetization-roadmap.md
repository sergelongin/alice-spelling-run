# Alice Spelling Run - Monetization Roadmap

**Created:** January 2026
**Goal:** $2,000 USD/month recurring revenue with minimal ongoing support

---

## Executive Summary

This document captures the strategic thinking behind commercializing Alice Spelling Run. The key insight: with Claude Code development velocity, the traditional EdTech economics (months of development, $200K+ investment) don't apply. We can ship in days, iterate based on real feedback, and find product-market fit faster than competitors can hold a planning meeting.

---

## The Goal

**Target:** $2,000/month = $24,000/year
**Constraint:** Minimal ongoing support (2-4 hours/month once stable)

---

## Why This Might Work

### Our Unfair Advantages

| Advantage | Why It Matters |
|-----------|----------------|
| **Development velocity** | Ship features in days vs. months |
| **Low burn rate** | Can experiment without investor pressure |
| **Direct customer contact** | Iterate based on real feedback, not market research |
| **No legacy codebase** | Modern stack, can pivot easily |
| **Pedagogical foundation** | Genuine innovations (error analysis, spaced rep with struggling cap) |

### Market Realities We're Accepting

| Reality | Our Response |
|---------|--------------|
| Competitors have millions of users | We don't need millions, we need 400-600 paying customers |
| AI differentiation is temporary | Move fast, build relationships before others catch up |
| Mobile is mandatory | Build React Native apps (2-3 days from existing React code) |
| Education app retention is 2% | Design for habit formation, not feature lists |

---

## Revenue Models Analyzed

### Path A: Consumer Subscriptions (Medium Difficulty)

| Metric | Target |
|--------|--------|
| Monthly price | $6.99 |
| Annual price | $49/year (15% discount) |
| Subscribers needed | 286 monthly OR 490 annual |
| Conversion rate (industry) | 2-5% of free users |
| Free users needed | ~10,000-15,000 |

**Pros:** Recurring, predictable, scales with product quality
**Cons:** App store competition, high CAC, need mobile apps

### Path B: Lifetime Deals (Easiest to Start)

| Metric | Target |
|--------|--------|
| Price | $79 one-time |
| Sales needed | 304 total |
| Timeline | Can launch in 2 weeks |

**Pros:** Upfront cash, validates demand, creates evangelists
**Cons:** Not recurring, need continuous new customer acquisition

**Platforms:**
- AppSumo (40% revenue share, massive audience)
- StackSocial
- Self-hosted (keep 100%, smaller audience)

### Path C: B2B Tutoring Centers (Most Sustainable)

| Metric | Target |
|--------|--------|
| Monthly price | $39/month per center |
| Customers needed | 52 centers |
| CAC | Lower (direct outreach) |

**Pros:** Lower churn, word-of-mouth in tutor networks, clear value prop
**Cons:** Sales effort required, need teacher features

**What tutoring centers need (buildable in days):**
1. Student progress reports (PDF export)
2. Multi-student dashboard
3. Custom word lists
4. Session summaries for parents

### Path D: Homeschool Families (Underserved Niche)

| Metric | Target |
|--------|--------|
| Annual price | $40/year |
| Families needed | 600 |
| Channels | Homeschool co-ops, Facebook groups, curricula partnerships |

**Pros:** Tight-knit communities, strong word-of-mouth, underserved
**Cons:** Price-sensitive, need to understand their curriculum needs

---

## Recommended Strategy

### Phase 1: Validate Demand (1 week)

**Before writing any code:**

1. **Create landing page** with pricing and email capture
2. **Goal:** 100 email signups in 7 days
3. **Channels to test:**
   - Reddit: r/homeschool, r/teachers, r/parenting
   - Facebook homeschool groups
   - Direct outreach to 20 tutoring centers

**If we hit 100 signups:** Continue to Phase 2
**If we don't:** Re-evaluate positioning before investing more

### Phase 2: Minimum Viable Product (1 week)

| Day | Task | Hours |
|-----|------|-------|
| 1-2 | React Native mobile shell (iOS + Android) | 8-12 |
| 3 | Stripe integration + paywall | 4-6 |
| 4 | Replace placeholder graphics with polished simple art | 4-6 |
| 5 | Landing page + demo video | 4-6 |
| 6-7 | App store submissions + TestFlight | 4-6 |

**Output:** Shippable app with payment flow

### Phase 3: Launch (1 week)

| Day | Action |
|-----|--------|
| 8 | Product Hunt launch |
| 9 | Reddit posts (value-first, not spammy) |
| 10 | Homeschool Facebook group posts |
| 11-14 | Direct outreach to tutoring centers |

**Goal:** First 10 paying customers

### Phase 4: Iterate to $2K/month (2-3 months)

- Ship features customers actually request
- Add teacher/tutor dashboard if B2B traction
- Expand to homeschool co-op partnerships
- Build case studies from early customers

---

## Pricing Strategy

### Consumer (App Store)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 words/day, Meadow mode only, browser TTS |
| Premium | $6.99/mo or $49/yr | Unlimited words, all modes, Cartesia TTS, AI hints |
| Family | $9.99/mo or $79/yr | Premium + 4 child profiles |

### B2B (Direct Sales)

| Tier | Price | Features |
|------|-------|----------|
| Tutor Basic | $39/month | 10 students, progress reports |
| Tutor Pro | $79/month | 30 students, custom word lists, parent sharing |
| School | $199/year | 30 students, LMS integration (future) |

---

## Minimal Support Architecture

### Automate Everything

```
Payment/Billing:     Stripe (handles receipts, refunds, dunning)
Authentication:      Supabase Auth (handles password resets, OAuth)
Database:            Supabase (managed, auto-backups)
AI Hints:            OpenAI/Anthropic/Groq (API, no infrastructure)
TTS:                 Cartesia (API) + Web Speech (fallback)
Error Tracking:      Sentry (alerts on issues)
App Distribution:    App stores (handle updates, reviews)
Support:             Simple FAQ page + email (hello@...)
```

### Expected Support Load (Once Stable)

| Task | Frequency | Time |
|------|-----------|------|
| Customer emails | 2-3/week | 30 min |
| Bug fixes | 1-2/month | 2-4 hrs |
| Feature requests triage | Weekly | 30 min |
| Cost monitoring | Monthly | 15 min |

**Total:** 2-4 hours/month

---

## Unit Economics

### Cost Structure (Per 1,000 Monthly Active Users)

| Cost | Amount | Notes |
|------|--------|-------|
| Supabase | $25/mo | Free tier covers early growth |
| AI Hints (OpenAI) | ~$15/mo | ~$0.015/hint, ~1000 hints/mo |
| Cartesia TTS | ~$50/mo | ~$0.05/1000 chars, cached heavily |
| Sentry | $0 | Free tier |
| App Stores | 15-30% of revenue | Apple/Google commission |

**Estimated cost per 1K MAU:** ~$90/month (excluding app store fees)

### Break-Even Analysis

| Model | Revenue/Customer | Customers to Break Even |
|-------|------------------|------------------------|
| $49/yr subscription | $49 | 22 (covers costs) |
| $79 lifetime | $79 | 14 (covers costs) |
| $39/mo B2B | $468/yr | 3 (covers costs) |

---

## Risk Assessment

### High Risk

| Risk | Mitigation |
|------|------------|
| **No one pays** | Validate with landing page first; pivot positioning |
| **App store rejection** | Follow guidelines, have web fallback |
| **AI costs spike** | Implement caching, consider on-device models |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| **Competitors copy features** | Move fast, build relationships, iterate on feedback |
| **Low retention** | Design for habit formation (streaks, daily goals) |
| **Support overwhelming** | Build comprehensive FAQ, automate common issues |

### Low Risk

| Risk | Mitigation |
|------|------------|
| **Technical issues** | Modern stack, good error handling, Sentry monitoring |
| **Content issues** | 665 words is enough to start; expand based on demand |

---

## Success Metrics

### Phase 1 (Validation)
- [ ] 100 email signups in 7 days
- [ ] 10+ conversations with potential customers
- [ ] Clear understanding of what they'd pay for

### Phase 2 (MVP Launch)
- [ ] Mobile apps in TestFlight/Play Store
- [ ] First 10 paying customers
- [ ] <5 critical bugs reported

### Phase 3 (Growth to $2K/month)
- [ ] 50+ paying customers
- [ ] <2% monthly churn
- [ ] Customer acquisition cost < lifetime value
- [ ] Support load < 4 hrs/month

---

## Decision Log

### Why Not Pure B2B (Schools)?

Schools have:
- Long sales cycles (6-12 months)
- RFP/procurement complexity
- IT approval requirements
- Budget cycles (buy in spring for fall)

**Verdict:** Too slow for our goals. Tutoring centers are faster.

### Why Not Freemium-Only?

- 2-5% conversion means needing 10,000+ free users for $2K/month
- User acquisition is expensive
- App store discovery is poor for new apps

**Verdict:** Combine freemium with lifetime deals and B2B for faster path.

### Why Mobile is Non-Negotiable

- 90%+ of educational app usage is mobile
- Parents want kids on tablets, not computers
- App store discovery (even if poor) is better than nothing
- React Native from existing React code is ~2-3 days work

**Verdict:** Ship mobile apps before major marketing push.

---

## Next Actions

### Immediate (This Week)

1. [ ] Create simple landing page with email capture
2. [ ] Post in 3 homeschool communities to gauge interest
3. [ ] Email 10 local tutoring centers with value prop

### If Validation Passes

1. [ ] Build React Native apps (2-3 days)
2. [ ] Add Stripe integration (half day)
3. [ ] Polish graphics (1 day)
4. [ ] Submit to app stores
5. [ ] Launch on Product Hunt

### If Validation Fails

1. [ ] Interview people who didn't sign up - why not?
2. [ ] Consider pivot to different audience (dyslexia focus? ESL?)
3. [ ] Consider licensing error analysis engine to other apps
4. [ ] Keep as portfolio piece / personal project

---

## Appendix: Competitive Positioning

See `/Marketing/Competitive_Research.md` for full analysis.

**TL;DR:**
- We can't out-feature VocabularySpellingCity or SplashLearn
- We CAN out-iterate them (ship in days vs. quarters)
- We CAN serve niches they ignore (tutoring centers, homeschool)
- Our pedagogical innovations (error pattern analysis, struggling cap) are real but hard to market
- Speed + customer relationships + niche focus = our path to $2K/month

---

## Appendix: The Honest Assessment

**Will this make us rich?** No.

**Will this replace a full-time income?** Unlikely without significant growth.

**Can this generate $2K/month passive income?** Yes, with 2-4 weeks of focused effort and ongoing iteration.

**Is the market opportunity larger?** Potentially, but requires:
- Mobile apps (mandatory)
- B2B features (for school sales)
- Efficacy validation (for premium positioning)
- Marketing budget (for consumer scale)

**The real question:** Is $24K/year worth a few weeks of effort? For most indie developers with a working prototype and Claude Code velocity, the answer is yes.

---

*Document will be updated as we learn from customer feedback.*
