# Midevela — Controlled Beta Launch Checklist

## Pre-Launch Smoke Test

### Core Widget Journey
- [ ] **Widget loads** on real merchant website (mobile + desktop)
- [ ] **Business name** matches the merchant
- [ ] **Greeting** is correct (not fallback/empty)
- [ ] **Currency** matches merchant settings (₦, $, etc.)
- [ ] **Accent color** and branding render correctly
- [ ] **Category images** load without broken-image icons
- [ ] **Category selection** advances to qualification flow
- [ ] **Qualification questions** display correctly (text + chip options)
- [ ] **Budget options** show the correct currency symbol
- [ ] **Recommendations** are real products from the catalog (not hallucinated)
- [ ] **Product links** open the correct product page
- [ ] **Comparison** shows only verified database fields (no fabricated specs)
- [ ] **Comparison recommendation** is LLM-generated text only
- [ ] **Free-form chat** ("Ask anything") works and returns sensible replies

### Reliability
- [ ] **Page refresh** during a conversation: transcript restores correctly
- [ ] **Page refresh** mid-funnel: category/budget/brand context is preserved
- [ ] **Disallowed domain** receives 403 and widget does not function
- [ ] **Allowed domain** (different from merchant's own) can load the widget
- [ ] **Slow connection**: widget degrades gracefully, timeout messages are user-friendly

### Security Hardening (verify manually or via curl)
- [ ] Widget origin blocked on unknown domain → `curl -H "Origin: https://evil.com"` returns 403
- [ ] Rate limiter active → rapid requests return 429
- [ ] Visitor ID is `crypto.randomUUID()` format (not timestamp-based)

### Backend & Data
- [ ] **Dashboard** receives customers after widget interaction
- [ ] **Conversations** appear in dashboard with correct messages
- [ ] **Events** tracked: widget_opened, category_selected, etc.
- [ ] **Usage counters** increment correctly (daily, monthly)
- [ ] **Subscription gate** works: expired org sees "unavailable" reply

### Deployment Verification
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm test -- --run` — 103+ tests passing
- [ ] `npm run build` — production build succeeds

---

## Tester Onboarding

### Tester Instruction Template

> **Use Midevela like a real customer. Don't try to be nice to it. If something feels confusing, slow, wrong, or broken, report it.**

### Feedback Categories

| Label | Meaning | Example |
|-------|---------|---------|
| 🐛 **Broken** | Something doesn't work | "Clicking a category does nothing" |
| 🤔 **Confusing** | Don't understand what to do | "I don't know what to type here" |
| 🎯 **Wrong** | Recommendation or answer is incorrect | "It recommended a face cream for my dry skin question" |
| 🐌 **Slow** | Response or loading takes too long | "Chat reply took 15 seconds" |
| ✨ **Idea** | Improvement suggestion | "Wish I could filter by price range" |

### Tester Setup

For each tester:
1. Give them the merchant URL with the widget installed
2. Provide the one-line instruction above
3. Ask them to use their own device (phone + laptop)
4. Ask them to share their screen for the first session if possible
5. Collect feedback via a simple form or shared document using the categories above

---

## Beta Success Criteria

The core question to answer:

> **Can a visitor arrive on the merchant's website, describe what they want naturally, and get directed to a real, relevant product?**

| Metric | Target |
|--------|--------|
| Widget loads without error | 100% |
| Qualification flow completes | >80% of sessions |
| Recommendations are real products | 100% |
| Chat reply is coherent + relevant | >90% of replies |
| No fabricated product specs | 0 incidents |
| Page refresh restores conversation | 100% |
| Wrong domain blocked | 100% |
