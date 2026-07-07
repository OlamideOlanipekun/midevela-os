# Frontend Audit (Pre-Backend)

> **Project:** Midevela
>
> **Document:** Frontend Audit — pre-backend-development
>
> **Version:** 1.0.0
>
> **Status:** Complete ✅
>
> **Owner:** Engineering
>
> **Last Updated:** 2026-07-07

---

# Purpose

Audit of `apps/web` before backend development begins: what the frontend actually does, which API contracts it already depends on, what is mocked, and what must change (and when) as the real backend lands. Companion to `00-backend-architecture.md`.

---

# Overall Verdict

The frontend is a **high-fidelity prototype in good shape for its purpose**. Structure is clean, the visual system is consistent, and the widget is properly isolated (Shadow DOM, correct HTML escaping). It is safe to build the backend under it.

But it is a prototype through and through: every page is a client component, auth is a spoofable cookie, three major dashboard pages render hardcoded arrays, and the API contracts that do exist leak UI concerns (CSS class names, emoji, pre-formatted price strings) into the data layer. None of this blocks backend work — it defines the **frontend migration checklist** that must run alongside each backend phase.

---

# Architecture Snapshot

- **Next.js 15 App Router**, plain CSS files per page (no Tailwind), fonts via `next/font`.
- **Every page is `"use client"`** — data fetching happens in `useEffect` + `fetch`; no server components, no SWR/react-query, no caching or retry logic.
- **No shared API client or shared types.** Each page hand-rolls `fetch` calls and re-declares its own interfaces (e.g. `Customer` defined separately in `customers/page.tsx` and `conversations/page.tsx`).
- **Providers:** `MockAuthProvider` (root layout) and `SubscriptionProvider` (dashboard layout) — both mock-backed.
- **Widget:** `public/widget/midevela-widget.js`, 579 lines of vanilla JS in Shadow DOM. Good isolation, correct `escapeHtml` on all dynamic content, API base derived from script `src` origin.
- **Monorepo note:** `packages/` is declared in workspaces but empty; the repo root also carries prototype artifacts (`app/`, mockup HTMLs, `generate-page.js`, `extract-css.js`) that are not part of the app.

---

# Data Wiring: Three Tiers

## Tier 1 — Wired to the (JSON-file) API

| Page / component | Endpoints used |
|---|---|
| Products page | `GET/POST/PUT/DELETE /api/products` |
| Knowledge page | `GET/POST/DELETE /api/knowledge`, `POST /api/workspace/crawl`, `GET/POST /api/workspace/settings` |
| Settings page | `GET/POST /api/workspace/settings` |
| Onboarding (launch step) | `POST /api/workspace/settings` |
| Sidebar (org name) | `GET /api/workspace/settings` |
| SubscriptionProvider | `GET /api/workspace/subscription` |
| Widget | `POST /api/widget/message` |

These pages will "just work" when the routes are re-implemented on Postgres **if response shapes are preserved** — see contract inventory below.

## Tier 2 — Hardcoded mock arrays inside page components

| Page | Mock |
|---|---|
| Dashboard overview (`dashboard/page.tsx`) | `initialActivities` + all stats; fetches nothing |
| Conversations | `mockConversations` (incl. full message threads) |
| Customers | `mockCustomers` |
| Settings → team | `mockTeam` |
| Analytics / AI Performance / Billing | Static content, no fetches |

These pages need **new endpoints + a fetch layer** (backend Phases 1–2 for conversations/customers, Phase 4 for analytics). Their local interfaces are the de-facto contract drafts.

## Tier 3 — The widget

Sends `{ orgId, customerId, messageText, history }` → expects `{ replyText, intent, recommendations }` as one JSON blob (no streaming). `customerId` is a self-minted localStorage id (`visitor-...`); history lives only in page memory and is lost on reload.

---

# API Contract Inventory (what the backend must reckon with)

| Endpoint | Current contract | Issue |
|---|---|---|
| `GET /api/products` | `{ products: [{ id, name, price: "₦28,500", category: string, stockStatus, stockClass, aiCompleteness, icon, description }] }` | Price is a pre-formatted string (schema uses `Decimal` + currency); `stockClass` is a CSS class; `icon` is a server-chosen emoji; `aiCompleteness` derived from description length. UI concerns baked into the API. |
| `DELETE /api/products?id=` | Delete via query param; returns HTTP **444** for not-found | 444 is not a real HTTP status; migrate to 404 + path param or body |
| `GET /api/knowledge` | `{ faqs, policies, documents }` | **No IDs anywhere**: FAQs deleted by question text, policies upserted by name, `updatedAt` is a human string ("2 weeks ago"). Incompatible with the `KnowledgeEntry` UUID model — frontend must switch to id-based operations |
| `GET/POST /api/workspace/settings` | Single global settings object | No org scoping (single-tenant file); shape is fine as the future `Organization.settings` JSON |
| `GET /api/workspace/subscription` | Hardcoded `{ plan: 'pro', status: 'active', ... }`, exempted from auth in middleware, sets mock cookies | Contract shape (plan/status/grace/trial fields) is actually good — keep it, back it with real Paystack data in Phase 3 |
| `POST /api/workspace/crawl` | Synchronous crawl inside the request (max 3 pages, 3.5s timeouts), JSON-LD extraction, writes drafts | Will not survive real sites or serverless limits — becomes a job + status polling (Phase 2); knowledge page must switch from await-response to poll-progress |
| `POST /api/widget/message` | Request carries client-supplied `orgId`; response is non-streamed JSON | Both change in Phase 1: public-key session auth + SSE. Widget rewrite required (planned) |

**Contract inconsistency found:** the widget renders `recommendations[].whyThis` while the conversations dashboard page types the same field as `why`, and the backend plan specifies `{ productId, reason }`. Pick one shape (recommend the plan's `{ productId, name, price, currency, reason }`) and align all three.

---

# Findings by Severity

## Blockers to fix during Phase 0–1 (backend swap touches these)

1. **Mock auth is everywhere and spoofable.** `middleware.ts` trusts the literal string `midevela_mock_auth=true` in the cookie header; every API route re-checks the same cookie; `MockAuthProvider` hardcodes the user ("Adaeze Okonkwo"). Clerk is installed but has zero call sites. Swapping to Clerk touches: `middleware.ts`, root `layout.tsx` (provider), `AuthShell` (login/signup forms are pure theater — no credential handling at all), `TopBar`/`Sidebar` (user display), and the `checkAuth()` helper in all 5 API route files. The `/api/auth/dev-login` route and all `mock_status`/`mock_plan` query-param plumbing (AuthShell, SubscriptionProvider) must be deleted.
2. **Widget trusts client-supplied `orgId`** — already covered in the architecture doc (`WidgetKey` + session JWT). The embed snippet shown in onboarding is fake (points at `cdn.midevela.com`, hardcoded `workspace_tk_xk92jw`) and must be generated from the real widget key.
3. **Onboarding silently drops data.** The launch step POSTs `{ delaySeconds, exitIntent }` but the settings schema expects `{ engagementDelay, features: { exitIntent } }` — the values are written as unknown keys and never read. Also, most of what onboarding collects (AI name, channels, "never say" list, catalog source) is not persisted at all. Fix when onboarding writes real `Organization` rows in Phase 0.

## High — fix alongside Phase 1–2

4. **Clean the product contract.** Backend should return raw data (`price: number, currency, inventoryStatus, images`); move formatting (₦ strings), status→CSS mapping, and icon selection into a small frontend presenter. The alternative (serializing UI fields server-side) preserves more prototype code but pollutes the API for the widget and future channels — not recommended.
5. **Knowledge needs IDs.** Frontend switches to `KnowledgeEntry` `{ id, type, title, content }` CRUD; delete-by-question-text and upsert-by-name go away.
6. **Introduce one typed API client** (`src/lib/api.ts` or `packages/shared`) with the response types defined once. Right now contract drift between pages is unchecked (the `why`/`whyThis` mismatch is the proof it's already happening).
7. **Widget conversation persistence:** history is client-memory only. Phase 1's `/session` + `GET /conversation` endpoints fix this; the widget needs a session-boot step and SSE rendering (planned).

## Medium — schedule, don't block

8. **All-client-component data fetching** — no caching, duplicate settings fetches (Sidebar + Settings + Knowledge each fetch `/api/workspace/settings` independently), no retry/stale handling. Adopt SWR or server components opportunistically when pages get real endpoints; don't do a big-bang refactor.
9. **Non-standard HTTP details:** status 444, DELETE-with-query-params, no pagination anywhere (products/conversations/customers lists will need it at real data volumes).
10. **Hardcoded ₦/NGN formatting** in multiple components — fine for the Nigeria-first MVP, but route it through one `formatMoney(amount, currency)` helper now that currency lives in the schema.
11. **Repo hygiene:** root-level `app/` dir, mockup HTMLs, and one-off scripts should move to an `archive/` or be deleted; empty `packages/` should either get the shared-types package or be removed from workspaces until needed.

## Positives worth keeping

- Widget: Shadow DOM isolation, consistent `escapeHtml` on every dynamic string (no XSS found), origin-derived API base, duplicate-load guard.
- Dashboard layout already models the full subscription lifecycle (trialing / active / past_due read-only / locked) and `PlanGate` handles tier gating — Phase 3 billing has a ready-made UI target.
- `SubscriptionProvider` contract is well-shaped for the real billing API.
- Consistent design system and per-page CSS; `error.tsx` boundary exists for the dashboard.
- The mock data itself is excellent seed/eval material — `db.json` + `mockConversations` become the Phase 1 eval-harness fixture store.

---

# Frontend Work Mapped to Backend Phases

| Backend phase | Required frontend changes |
|---|---|
| **Phase 0** (DB + Clerk) | Replace MockAuthProvider/middleware/AuthShell with Clerk; delete dev-login + mock query params; onboarding posts real org data + renders real embed snippet |
| **Phase 1** (conversation loop) | Widget: session boot, SSE rendering, key-based embed; products/knowledge pages: id-based CRUD + raw-data presenter; add typed API client |
| **Phase 2** (ingestion + customers) | Crawl UI: await→poll progress; conversations & customers pages: swap mock arrays for real endpoints (their interfaces are the contract draft); dashboard overview: real activity feed |
| **Phase 3** (billing) | Billing page: real Paystack checkout + plan data; team page: Clerk org members instead of `mockTeam` |
| **Phase 4** (analytics) | Analytics + AI-performance pages: wire to rollup endpoints |

---

# Related Documents

- `00-backend-architecture.md`
- `../product/06-website-experience.md`
- `../product/09-dashboard-overview.md`

---

**Status:** Complete ✅

**Version:** 1.0.0
