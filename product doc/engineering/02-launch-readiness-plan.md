# Launch Readiness — Implementation Plan

> **Project:** Midevela
>
> **Document:** Production Launch Readiness — Implementation Plan
>
> **Version:** 1.0.0
>
> **Status:** Draft — for founder review
>
> **Owner:** Engineering
>
> **Last Updated:** 2026-07-10

---

# Purpose

This plan turns the launch-readiness audit into a sequenced, shippable set of changes. Every prototype path is now real (auth, conversation engine, dashboard data, billing), so the remaining work is not "build features" — it is **the enforcement and abuse layer that makes the product safe to charge for and safe to expose to the internet.**

The audit found the codebase is well-built (clean multi-tenancy via `requireOrg()`, correct crypto, honest data, no committed secrets) but **not launch-ready as a paid product** for two reasons:

1. **Billing is honor-system** — subscription lockout is enforced only in the React layout, and a paid subscription reads as active forever.
2. **No abuse protection** — the endpoints that cost real money (widget LLM calls, login, signup) have no rate limiting.

This document is the fix.

---

# Sequencing philosophy

- **Ship in vertical, independently-deployable slices.** Each PR below is a standalone deploy that leaves `main` releasable. No long-lived branches.
- **Server-side enforcement first, polish second.** The things that make the product *sellable and safe* precede the things that make it *nice*.
- **Every change verified against live data**, same discipline used through the whole build: exercise the real path, confirm the DB state, clean up. No "typechecks, therefore done."
- **Blast-radius awareness.** Enforcement changes (gating, expiry) can lock real users out. Each such PR ships behind a verified backfill/migration and a manual smoke test against the founder's own org before it's considered done.

Effort estimates assume one engineer, and are calendar-honest (include verification), not just typing time.

---

# Current gap summary (from audit)

| # | Gap | Tier | Fixed in |
|---|---|---|---|
| 1 | Subscription lockout is client-side only | 🔴 Blocker | PR-1 |
| 2 | `ACTIVE` never checked against `currentPeriodEnd` → pay once, active forever | 🔴 Blocker | PR-1 |
| 3 | Recurring billing not closed-loop (only `charge.success` handled) | 🔴 Blocker | PR-3 |
| 4 | No rate limiting on widget / login / signup | 🔴 Blocker | PR-2 |
| 5 | SSRF in the crawler | 🟠 Should-fix | PR-4 |
| 6 | Paystack still on test keys | 🟠 Should-fix | PR-7 |
| 7 | No security headers | 🟠 Should-fix | PR-5 |
| 8 | Webhook failures are silent | 🟠 Should-fix | PR-6 |
| 9 | Plan caps unenforced | 🟡 Post-launch | PR-8 |
| 10 | No email verification | 🟡 Post-launch | PR-9 |
| 11 | No tests / CI gate | 🟡 Post-launch | PR-10 |

---

# PR-1 — Server-side subscription enforcement

**Closes:** #1, #2. **Effort:** ~1.5 days. **Risk:** High (can lock real orgs out — mitigated below).

### Problem

`isLocked` lives in [`dashboard/layout.tsx`](../../apps/web/src/app/dashboard/layout.tsx) as a `useEffect` redirect. No API route consults subscription state, so an expired org can drive every API directly and — worst — its **widget keeps making paid LLM calls forever**. Separately, `getSubscriptionForOrg` only expires `TRIALING`; an `ACTIVE` row with a lapsed `currentPeriodEnd` still returns `"active"`.

### Approach

**(a) Make status computation the single source of truth.** Fix the effective-status logic in [`server/billing/subscription.ts`](../../apps/web/src/server/billing/subscription.ts) so *both* trial and paid periods expire:

```ts
// getSubscriptionForOrg — compute effectiveStatus honestly
let effectiveStatus = sub.status;
const now = Date.now();

if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt.getTime() < now) {
  effectiveStatus = "EXPIRED";
}
// NEW: a paid period that has lapsed with no renewal is past_due, then expired
if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now) {
  const graceEnd = sub.currentPeriodEnd.getTime() + GRACE_PERIOD_DAYS * 86400000;
  effectiveStatus = now < graceEnd ? "PAST_DUE" : "EXPIRED";
}
```

Expose a small predicate so callers never re-implement the rule:

```ts
export type AccessLevel = "full" | "read_only" | "locked";

export function accessLevelFor(status: string): AccessLevel {
  if (status === "past_due") return "read_only";
  if (["expired", "cancelled"].includes(status)) return "locked";
  return "full"; // trialing | active
}
```

**(b) Add a server-side gate** in [`server/auth/context.ts`](../../apps/web/src/server/auth/context.ts):

```ts
/** requireOrg + subscription must allow writes. Throws 402 when locked. */
export async function requireActiveOrg(): Promise<OrgContext> {
  const ctx = await requireOrg();
  const sub = await getSubscriptionForOrg(ctx.org.id);
  const level = accessLevelFor(sub.status);
  if (level === "locked") throw new ApiError(402, "Subscription inactive.");
  if (level === "read_only") throw new ApiError(402, "Read-only: payment past due.");
  return ctx;
}
```

**(c) Apply the gate by verb, not blanket.** GET (read) routes keep `requireOrg`. Mutating routes and the AI path switch to `requireActiveOrg`:

- `POST/PUT/DELETE` on `/api/products`, `/api/knowledge`
- `POST /api/workspace/crawl`
- `POST /api/widget/message` — **the important one**: no active subscription → widget returns a polite "assistant unavailable" reply instead of calling Groq/Voyage. (Resolve subscription from the widget key's org; skip the LLM, don't 402 a shopper.)

**(d) Keep the client check** as UX (fast redirect) — it stays, it's just no longer the boundary.

### Files

- `server/billing/subscription.ts` (status logic + `accessLevelFor`)
- `server/auth/context.ts` (`requireActiveOrg`)
- `app/api/products/route.ts`, `app/api/knowledge/route.ts`, `app/api/workspace/crawl/route.ts`
- `app/api/widget/message/route.ts` (subscription-aware short-circuit)

### Verification

1. Founder's own org (active trial) — every dashboard action still works. **Do this first, before anything else.**
2. Seed a throwaway org, force `currentPeriodEnd` into the past → confirm APIs 402, widget returns the unavailable reply and makes **zero** Groq/Voyage calls (check logs + no new token rows).
3. Force `past_due` inside grace → reads work, writes 402.
4. Re-activate → everything restored. Clean up the test org.

### Rollback

Pure code (no schema change). Revert the commit. Because `requireActiveOrg` is additive and reads-stay-open, worst case is over-blocking, not data loss.

---

# PR-2 — Rate limiting

**Closes:** #4. **Effort:** ~1 day. **Risk:** Medium (over-throttling real users — start lenient).

### Problem

Zero throttling. The widget key is public (embedded in every merchant's page source), so `POST /api/widget/message` is an open door to unlimited paid LLM calls — a direct cost-amplification DoS. Login has no brute-force protection; signup has none and burns `scrypt` CPU per attempt. `.env.example` already reserves `UPSTASH_REDIS_*` for exactly this.

### Approach

Use **Upstash Redis REST** (serverless-native, no connection pool, works on Vercel functions) via raw `fetch` — same "no-SDK" pattern as Groq/Voyage/Paystack. A single helper:

```ts
// server/ratelimit/limiter.ts
// Fixed-window counter in Redis via REST. Fails OPEN (allow) if Redis is
// unreachable — availability over strictness for a v1 limiter.
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number }>;
```

Apply per surface:

| Surface | Key | Limit (starting point) |
|---|---|---|
| Widget message | `wl:{widgetKeyId}:{minute}` + `wl:{ip}:{minute}` | 20 / min per key, 60 / min per IP |
| Login | `login:{ip}` + `login:{email}` | 10 / 15 min |
| Signup | `signup:{ip}` | 5 / hour |

Return `429` with `Retry-After` on trip. Widget returns a friendly "please slow down" reply, not a raw 429, so a shopper never sees an error.

> **Also add a hard per-org monthly LLM ceiling here** as the backstop even before per-plan caps (PR-8) exist: a Redis counter `usage:{orgId}:{yyyymm}` checked in the widget path. Protects the API bill regardless of plan logic.

### Files

- `server/ratelimit/limiter.ts` (new)
- `app/api/widget/message/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts`
- `.env.local` + Vercel env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Verification

Script N rapid calls against each endpoint; confirm the (N+1)th returns 429 with `Retry-After`, and that it resets after the window. Confirm fail-open by pointing at a bad Redis URL → requests still succeed (logged).

### Rollback

Feature-flag via env presence: if `UPSTASH_REDIS_REST_URL` is unset, `rateLimit` returns `{ ok: true }`. Removing the env var disables limiting without a redeploy.

---

# PR-3 — Recurring billing: close the loop

**Closes:** #3. **Effort:** ~2–3 days (or ~0.5 day for the "conscious manual-renewal v1" path). **Risk:** Medium. **Needs founder decision — see Open Decisions.**

### Problem

Checkout does a one-time `transaction/initialize`; the webhook only handles `charge.success`. There is no renewal charge, no `charge.failed → past_due`, no cancellation. With PR-1's expiry fix in place, a paying customer silently lapses to `past_due`/`locked` after 30 days because nothing re-bills them.

### Approach — two options, founder picks

**Option A — True recurring (Paystack Plans/Subscriptions).** Migrate checkout to create a Paystack Plan-backed subscription; Paystack auto-charges monthly and emits `subscription.create`, `charge.success` (recurring), `invoice.payment_failed`, `subscription.disable`. Handle each in the webhook to move our `SubscriptionStatus` accordingly. This is the real answer and removes the dunning problem entirely.

**Option B — Conscious manual-renewal v1.** Keep one-time charges. PR-1 already downgrades lapsed orgs to `past_due` (grace) then `locked`, and the billing page's "Renew now" button already re-initializes checkout. Ship this *on purpose*, documented, and upgrade to Option A post-launch. Cheapest path to a defensible launch.

Either way, extend the webhook to handle the failure/cancel events it receives so status transitions aren't one-directional:

```ts
switch (event.event) {
  case "charge.success":            // activate / extend (exists)
  case "invoice.payment_failed":    // → PAST_DUE
  case "subscription.disable":      // → CANCELLED
  case "subscription.not_renew":    // → CANCELLED at period end
}
```

Add **idempotency**: persist processed Paystack event/transaction references (a `WebhookEvent` table, or a `paystackReference` unique column) so a replayed delivery is a no-op beyond the existing `paidAt`-derived period trick.

### Files

- `server/billing/subscription.ts` (status-transition helpers)
- `app/api/webhooks/paystack/route.ts` (event switch + idempotency store)
- `server/billing/paystack.ts` (Plan/subscription calls if Option A)
- `prisma/schema.prisma` + migration (idempotency table; Plan `paystackPlanCode` wiring if Option A)

### Verification

Independently-signed webhook fixtures (the non-tautological signing approach already used) for each event type → assert the resulting `SubscriptionStatus`. Replay the same event twice → assert no double-extend. For Option A, run one real test-mode recurring cycle end-to-end.

---

# PR-4 — SSRF guard on the crawler

**Closes:** #5. **Effort:** ~0.5 day. **Risk:** Low.

### Problem

[`crawl/route.ts`](../../apps/web/src/app/api/workspace/crawl/route.ts) fetches arbitrary user-supplied URLs server-side with no host validation. Any signed-up user can target `http://169.254.169.254/` (cloud metadata), `localhost`, or internal RFC-1918 ranges.

### Approach

A guard resolving the host and rejecting private/link-local/loopback space **before** every fetch (initial URL *and* discovered internal links — the crawler follows links, so re-check each hop):

```ts
// server/net/ssrfGuard.ts
export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new ApiError(400, "Unsupported URL scheme.");
  const { address } = await dns.promises.lookup(u.hostname);
  if (isPrivateOrReserved(address)) throw new ApiError(400, "URL resolves to a non-public address.");
  return u;
}
```

Block `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`, and `0.0.0.0`. Keep the existing per-fetch timeout and `MAX_PAGES` cap. (Note the residual TOCTOU on DNS rebinding is acceptable for v1; a fetch-through-pinned-IP agent is the post-launch hardening.)

### Files

- `server/net/ssrfGuard.ts` (new), `app/api/workspace/crawl/route.ts` (call before each fetch).

### Verification

Attempt crawl of `http://169.254.169.254/`, `http://localhost`, a `192.168.x` host → all 400. A normal public store URL → still works.

---

# PR-5 — Security headers

**Closes:** #7. **Effort:** ~0.5 day. **Risk:** Low (CSP can break inline assets — validate).

### Approach

Add `headers()` in [`next.config.ts`](../../apps/web/next.config.ts): `Strict-Transport-Security`, `X-Frame-Options: DENY` (dashboard is clickjackable today), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a starter CSP. **The widget route needs `frame-ancestors`/CORS that still allows embedding on merchant sites** — scope headers so the dashboard is locked down but the public widget API stays cross-origin-callable (it already sets its own CORS).

### Verification

`curl -I` the dashboard and confirm headers; load the dashboard and confirm no CSP console violations; confirm the widget still posts cross-origin from a test page.

---

# PR-6 — Webhook alerting & observability

**Closes:** #8. **Effort:** ~0.5–1 day. **Risk:** Low.

### Problem

A failed `activateSubscriptionFromPayment` returns 500 (Paystack retries — good) but if it keeps failing, **a customer paid and never got activated and nobody knows.** Today the only signal is `console.error`.

### Approach

Add lightweight error tracking (Sentry free tier, or a Slack/email webhook from the catch block as a zero-dependency stopgap). Minimum viable: alert on any 500 from `/api/webhooks/paystack` and on `rateLimit` fail-open events. Add structured context (orgId, reference) to those logs. Full observability (tracing, dashboards) is post-launch.

### Files

- `server/observability/notify.ts` (new — thin alert wrapper)
- `app/api/webhooks/paystack/route.ts` (alert in catch), `server/ratelimit/limiter.ts` (alert on fail-open).

---

# PR-7 — Production cutover

**Closes:** #6. **Effort:** ~0.5 day (mostly checklist). **Risk:** Medium (real money — do carefully).

Not code so much as a gated checklist:

- [ ] Swap Paystack **test → live** keys in Vercel env (never in the repo).
- [ ] Re-register the webhook URL in the Paystack dashboard against the production domain; confirm one live signed delivery is accepted.
- [ ] Set all prod env in Vercel: `DATABASE_URL`, `GROQ_API_KEY`, `VOYAGE_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Decide custom domain vs `midevela-os.vercel.app`; update checkout `callback_url` and widget origin allowlists accordingly.
- [ ] Confirm `prisma migrate deploy` runs in the build/release step against the prod DB (consider a `directUrl` for migrations vs the pooled runtime URL).
- [ ] Run the PR-1 lock/unlock smoke test once against production with a throwaway org, then delete it.

---

# Post-launch (tracked, not blocking)

- **PR-8 — Plan caps.** Enforce `monthlyMessageCap` / `productCap` / `channelCap` (schema fields exist, unused). The PR-2 usage counter is the hook; wire per-plan limits and upgrade prompts.
- **PR-9 — Email verification.** Add a verification token + gate onboarding/first-widget on verified email. Closes the impersonation/spam-account hole.
- **PR-10 — CI + tests.** GitHub Actions: `typecheck` + `build` gate on every push (nothing today). Then unit tests on the highest-risk pure logic first: `verifyWebhookSignature`, `accessLevelFor`, `isPrivateOrReserved`, `isOriginAllowed`.

---

# Open decisions (need founder input)

1. **Recurring billing model (PR-3):** true Paystack subscriptions (Option A) now, or conscious manual-renewal v1 (Option B) with the upgrade deferred? Drives whether PR-3 is ~0.5 or ~3 days and whether month-2 revenue is automatic.
2. **Trial plan default:** new orgs currently trial on **Growth**. Keep, or trial on Starter? (Product/pricing call, flagged in `subscription.ts`.)
3. **Grace period:** `GRACE_PERIOD_DAYS = 7` for `past_due` before lockout — is a week the right dunning window?
4. **Launch domain:** custom domain before launch, or ship on the Vercel subdomain and migrate later?

---

# Definition of "launch ready"

A paying customer cannot be served without an active subscription; a lapsed subscription actually restricts access server-side; the money-spending endpoints are rate-limited; the crawler can't be pointed at internal infrastructure; security headers are set; a failed payment webhook pages a human; and Paystack is on live keys with a re-registered production webhook.

**Concretely: PR-1 through PR-7 merged, deployed, and each verified against live data.** PR-8+ may trail into the weeks after launch *because* enforcement is server-side by then.

## Recommended order

`PR-1 → PR-2 → PR-4 → PR-5 → PR-6 → PR-3 → PR-7`

Rationale: PR-1 makes the product sellable, PR-2 stops the bill from being attackable — those two are the spine. PR-4/5/6 are small, independent hardening that can land in any order or in parallel. PR-3 (the billing-model decision) is sequenced late so it doesn't block the security-critical work while the founder decides Option A vs B. PR-7 is the final gate.

**Critical path to a defensible launch: PR-1, PR-2, and PR-3-Option-B — roughly 3–4 focused days.** Everything else hardens around that spine.
