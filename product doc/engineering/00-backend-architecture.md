# Backend Architecture & Plan

> **Project:** Midevela
>
> **Document:** Backend Architecture & Build Plan
>
> **Version:** 1.0.0
>
> **Status:** Draft — for founder review
>
> **Owner:** Engineering
>
> **Last Updated:** 2026-07-07

---

# Purpose

This document defines the backend architecture for Midevela v1: the system shape, technology decisions, data model, API surface, AI pipeline, security model, and a phased build plan.

It is grounded in the current state of the repo (`apps/web`) and the product scope defined in `00-product-overview.md`.

---

# Current State (honest assessment)

What exists today in `apps/web`:

| Area | State |
|---|---|
| Prisma schema (`prisma/schema.prisma`) | ✅ Good first draft — Postgres + pgvector, multi-tenant models |
| Database wiring | ❌ Not connected — code reads from a JSON file (`lib/db.ts` / `readDb()`) |
| AI conversation (`lib/ai/*`) | ❌ Simulated — hardcoded replies, keyword-match "RAG", no LLM calls |
| Auth | ❌ Mock cookie (`midevela_mock_auth`); Clerk is installed but unused |
| Widget API (`/api/widget/message`) | ⚠️ Shape is right, but `Access-Control-Allow-Origin: *` with no key, no rate limit, no persistence |
| Dashboard APIs (`/api/products`, `/api/knowledge`, `/api/workspace/*`) | ⚠️ Stubs against the JSON file |
| Background work (crawl, import, embeddings) | ❌ None |
| Billing | ❌ None |

The v1 backend job is therefore: **replace every simulation with the real system, without changing the API shapes the frontend already consumes.**

---

# Architecture Decision: Modular Monolith

**Decision:** Keep one deployable — the Next.js app (`apps/web`) — as a modular monolith, plus a background job runner. Do not build microservices for v1.

**Why:**

- One founder-led team; operational surface must stay tiny.
- Next.js route handlers already serve both the dashboard and the public widget API.
- The workloads that genuinely don't fit a request/response cycle (crawling, imports, embedding generation) go to a **job queue**, not a separate service.

**Extraction path (later, only when needed):** the widget/conversation API is the first candidate to split out (it has different scaling, latency, and availability needs than the dashboard). Guard this future by keeping all domain logic in `src/server/` modules that route handlers merely call — never business logic inside route files.

## Proposed module layout

```text
apps/web/src/server/
  auth/          # Clerk session → { userId, orgId } resolution, role checks
  tenancy/       # org context, plan limits, usage metering
  catalog/       # products, categories, import pipeline
  knowledge/     # knowledge entries, chunking, embedding sync
  conversation/  # turn orchestration, LLM calls, streaming
  retrieval/     # pgvector search (RAG)
  customers/     # identity resolution, events, buying stage
  channels/      # website widget now; whatsapp/instagram adapters later
  billing/       # Paystack plans, subscriptions, webhooks
  analytics/     # aggregation queries for the dashboard
  jobs/          # queue definitions + handlers (crawl, import, embed)
lib/             # thin cross-cutting utils only (prisma client, logger)
```

---

# Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime / API | Next.js 15 route handlers (already in place) | One deployable; SSR dashboard + API together |
| Database | PostgreSQL + `pgvector` (Neon or Supabase) | Already in the schema; serverless-friendly; one store for relational + vector data |
| ORM | Prisma (already installed) | Keep; raw SQL via `$queryRaw` for vector search |
| Auth | Clerk with Organizations (already installed) | Multi-tenant orgs, invitations, roles out of the box |
| LLM (MVP) | **Groq** — Llama-class model (e.g. `llama-3.3-70b-versatile`), streaming, tool use / JSON mode | Decision: MVP runs on Groq for speed + cost + free dev tier. All LLM calls go through a provider interface (`server/conversation/llm.ts`) so the model is a config value — Claude (`claude-opus-4-8`) is the documented upgrade path for paid tiers once unit economics are measured |
| Embeddings | Voyage AI (`voyage-3-large`) | Provider-independent embeddings with a free tier; adjust `vector(N)` dimension in schema to the chosen model's output |
| Job queue | Inngest (or Trigger.dev) | Durable, serverless-native background jobs + cron without running Redis/worker infra |
| Rate limiting / cache | Upstash Redis | Serverless Redis; token-bucket per widget key and per org |
| Payments | Paystack | Nigeria-first market (NGN default in schema); subscriptions + webhooks |
| File storage | S3-compatible (Cloudflare R2) | Product images, logos, import files |
| Observability | Sentry + structured logs; per-message token usage stored in DB | Debugging conversations is a core product need, not just ops |

---

# Data Model Changes

The existing schema is a solid base. Required additions and fixes, in priority order:

## 1. Wire tenancy to Clerk

- `Organization.clerkOrgId String @unique` and `User.clerkUserId String @unique`.
- A Clerk webhook (`user.created`, `organizationMembership.*`) syncs Clerk state into these tables. The local `users`/`organizations` rows remain the FK anchors for all domain data.

## 2. Widget identity — new `WidgetKey` model

The widget currently trusts a client-supplied `orgId`. That is the single biggest security hole to close.

```prisma
model WidgetKey {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId          String   @map("org_id") @db.Uuid
  publicKey      String   @unique @map("public_key")   // "mdv_pk_..."
  allowedDomains String[] @map("allowed_domains")       // Origin allowlist
  active         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz
}
```

The embed snippet ships the public key, never the org id. The server resolves key → org and validates the `Origin` header against `allowedDomains` (echoing that origin back instead of `*`).

## 3. Billing models

`Plan` (name, price, limits: messages/month, products, channels), `Subscription` (orgId, planId, status, Paystack customer + subscription codes, period dates), `UsageRecord` (orgId, metric, quantity, period) for metering AI messages against plan limits.

## 4. Channel integrations (Phase 4, add schema early)

`ChannelIntegration` (orgId, type: whatsapp/instagram/facebook, credentials JSON encrypted, status). `Conversation.channel` already exists and stays.

## 5. Indexes & integrity fixes

- Composite indexes on every tenant-scoped table: `@@index([orgId, createdAt])` on products, conversations, customers, customer_events, messages (`[conversationId, createdAt]`).
- `Embedding`: HNSW index on the vector column (raw SQL migration: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`), plus `@@index([orgId, sourceType])` and a uniqueness constraint on `(sourceType, sourceId, chunkIndex)` — add a `chunkIndex Int` column so re-embedding is idempotent.
- `updatedAt` fields should use Prisma's `@updatedAt`, not `@default(now())`.
- Enums instead of free strings where values are closed sets: `Conversation.status/outcome`, `Message.role`, `Customer.buyingStage`, `Product.inventoryStatus`. (Free-string `intent` is fine — it's model-generated.)
- `Customer` needs an anonymous-visitor handle: `@@unique([orgId, externalId])` where `externalId` is the widget's device id; merge on email/phone capture.

---

# API Surface

Three distinct API classes with different trust models. Version the public one from day one.

## 1. Public Widget API — `/api/v1/widget/*` (untrusted browsers on merchant sites)

| Endpoint | Purpose |
|---|---|
| `POST /session` | Widget boots: public key + origin check → returns short-lived session JWT (orgId, customerId), org branding/config |
| `POST /message` | Send customer message → **SSE stream** of AI response tokens + a final structured event (recommendations, intent) |
| `POST /events` | Behavioral events (page_view, product_view, add_to_cart) — batched, fire-and-forget |
| `GET /conversation` | Resume history for returning visitor |

Rules: CORS echoes validated origin only; per-key and per-IP rate limits (Upstash); session JWT required on everything after `/session`; message length caps; usage metered against the org's plan before each LLM call.

## 2. Dashboard API — `/api/dashboard/*` (Clerk-authenticated business users)

CRUD for products, categories, knowledge; conversation/customer browsing; analytics queries; AI configuration (brand voice, greeting rules); widget key management; import triggers. Every handler starts with one shared guard: resolve Clerk session → org membership + role → scoped Prisma queries (`where: { orgId }` always — enforce via a per-request repository helper so a missing scope is a compile-time smell, not a runtime hope).

## 3. Webhooks — `/api/webhooks/*` (signed machine traffic)

`/clerk` (user/org sync), `/paystack` (subscription lifecycle — verify signature, idempotent by event id), later `/whatsapp` (Meta Cloud API). All webhook handlers: verify signature → enqueue job → return 200 fast.

---

# AI Pipeline (the core of the product)

Replace `lib/ai/*` simulations with a real pipeline in `server/conversation/`:

## Conversation turn flow

```text
widget message
  ↓ auth: session JWT → { orgId, customerId }
  ↓ metering: plan limit check (Redis counter, reconciled to UsageRecord)
  ↓ load context: last N messages, customer profile (preferences, stage), org config
  ↓ RAG retrieval: embed query (Voyage) → pgvector cosine search scoped to orgId
  ↓ LLM call: via provider interface (MVP: Groq/Llama), streaming, tool use
  ↓ SSE stream to widget (text deltas)
  ↓ persist: Message rows (incl. tokensUsed from usage), intent, recommendations
  ↓ post-turn (async job): update customer preferences/buying stage, conversation summary
```

## LLM design decisions

- **Provider abstraction is mandatory.** All model calls go through `server/conversation/llm.ts` exposing `streamTurn({system, messages, tools}) → {textStream, toolCalls, structuredOutput, usage}`. MVP implementation: Groq SDK (OpenAI-compatible) with a Llama-class model. A Claude implementation is the paid-tier/quality upgrade path — swapping providers must never touch conversation logic.
- **One streaming call per turn with tools**, not a chain of separate intent/recommendation calls. Tools exposed to the model:
  - `search_products(query, filters)` → runs pgvector + attribute filtering, returns top products
  - `get_policy(topic)` → knowledge entry lookup
  - `create_checkout_link(productIds)` → Phase 3+, merchant-configured
  - Intent is captured as a required field of the model's final structured output, not a separate classifier call.
- **System prompt assembly:** static platform instructions first, then org profile (brand voice, policies digest), then customer profile. Per-turn context (retrieved chunks, recent behavior) goes in the user turn. Keep the ordering stable and timestamp-free — Groq has no prompt caching today, but the Claude upgrade path relies on cacheable prefix ordering, so build it correctly now.
- **Structured final output** (JSON schema): `{ intent, recommendations: [{productId, reason}], buyingStageSignal, handoffRequested }` — parsed and persisted, drives the widget UI (product cards) and analytics. **Groq reality check:** open models are less reliable at strict JSON + tool use than frontier models — the provider layer must validate structured output against the schema (zod), retry once on parse failure, and fall back to a text-only response rather than erroring the turn.
- **Guardrails:** prompt states the assistant only discusses this store's products/policies; retrieved context is the only source of factual claims about products; refusal/off-topic redirect language configurable per org. Expect to invest more prompt iteration here than a frontier model would need — budget eval-harness time accordingly.

## Knowledge & embedding sync

- On product/knowledge create/update/delete → enqueue `embed.sync` job: chunk (products: name + description + attributes as one chunk; knowledge: ~500-token chunks), embed via Voyage, upsert `Embedding` rows keyed by `(sourceType, sourceId, chunkIndex)`.
- Website crawl (`/api/workspace/crawl` today) becomes a job chain: fetch sitemap/pages → extract products & FAQs (LLM-assisted extraction) → create draft products/knowledge → embed. Progress persisted so the dashboard can poll status.

## Retrieval

```sql
SELECT source_type, source_id, chunk_text,
       1 - (embedding <=> $query::vector) AS similarity
FROM embeddings
WHERE org_id = $orgId
ORDER BY embedding <=> $query::vector
LIMIT 8;
```

Via `prisma.$queryRaw`. Add a similarity floor (~0.5) and merge product hits with live product rows (price, stock) before handing to the model — never let the model quote stale chunk text for price/stock.

---

# Security & Multi-Tenancy

1. **Org scoping is the invariant.** Every query on tenant data includes `orgId` from the authenticated context — never from request bodies. Central `forOrg(orgId)` repository wrapper; code review rule: raw `prisma.<model>` calls outside `server/` are rejected.
2. **Widget hardening:** public key + domain allowlist + short-lived JWT + rate limits + max message length + metering (details above).
3. **Secrets:** channel credentials and Paystack keys encrypted at rest (libsodium sealed box or KMS); never in `settings` JSON plaintext.
4. **PII:** customers table holds name/email/phone — plan for org-level data export & delete (NDPR compliance in Nigeria mirrors GDPR obligations).
5. **Prompt injection:** retrieved chunks and customer messages are wrapped as untrusted data in the prompt; tool set for the widget conversation contains no write-capable tools against merchant data.
6. **Dev auth:** delete the mock-cookie path once Clerk is wired; it must never ship.

---

# Observability & Quality

- Store `tokensUsed` (already in schema) split into input/output + cache reads per message; roll up to `UsageRecord` for margin visibility per org.
- Log every turn: latency breakdown (retrieval / LLM TTFT / total), intent, similarity scores, refusals.
- **Eval harness before launch:** a fixture store (products + policies) and ~50 scripted customer questions with expected behavior (right product recommended, right policy quoted, no hallucinated discounts). Run on every prompt/model change.

---

# Phased Build Plan

Each phase ends with something demonstrable. Estimates assume one engineer.

## Phase 0 — Foundations (Week 1–2)

- Provision Neon/Supabase Postgres with pgvector; run Prisma migrations (with schema fixes above: indexes, enums, `@updatedAt`, `chunkIndex`).
- Wire Clerk fully (orgs, middleware, webhook sync); delete mock auth.
- Onboarding flow writes real `Organization` rows; `WidgetKey` issued at onboarding.
- Shared request guards (`requireUser`, `requireOrg`, `forOrg`).
- CI: typecheck, lint, migration check.

**Exit:** sign up → create org → dashboard reads/writes real DB.

## Phase 1 — Real Conversation Loop (Week 3–4)

- Products + knowledge CRUD on Postgres; embedding sync jobs (Inngest + Voyage).
- pgvector retrieval module.
- Conversation engine: provider interface + Groq implementation — streaming call with tools, validated structured output, persistence of conversations/messages/customers.
- Widget API v1: `/session`, `/message` (SSE), `/events` with key auth, CORS, rate limits.
- Update `public/widget/midevela-widget.js` for session boot + SSE rendering.

**Exit:** a real store's widget answers product & policy questions from its own data, streams responses, and recommendations render as cards. **This is the demo that sells the product.**

## Phase 2 — Ingestion & Customer Intelligence (Week 5–6)

- Website crawl job chain (fetch → LLM extraction → draft products/knowledge → embed) with progress UI.
- CSV import for products.
- Customer identity: anonymous device id → merge on email/phone; behavioral events feed buying-stage updates (post-turn async job).
- Conversation summaries + customer timeline endpoints for the dashboard.

**Exit:** business connects its site, imports its catalog in minutes; dashboard shows live customers and conversations.

## Phase 3 — Billing & Limits (Week 7–8)

- Plans, Paystack subscription checkout + webhooks, usage metering enforcement (soft warning at 80%, block at 100% with upgrade CTA).
- Trial logic; dunning basics (webhook-driven status).

**Exit:** an org can pay, and free-tier abuse is bounded.

## Phase 4 — Analytics & Omnichannel start (Week 9+)

- Analytics aggregates (conversion, AI resolution rate, recommendation acceptance, revenue-influenced) — nightly rollup tables, not live scans.
- WhatsApp channel adapter: Meta Cloud API webhook → same conversation engine, channel-aware formatting (no SSE; message-based).
- Eval harness expansion; prompt iteration from real transcripts.

**Exit:** dashboard tells the ROI story; first non-website channel live.

---

# Deferred (explicitly not v1)

- Microservices / separate widget service — extract only when scale demands.
- Fine-tuning or custom models — prompt + RAG first.
- Instagram/Facebook/email channels — after WhatsApp proves the adapter pattern.
- Autonomous cart recovery campaigns — needs billing + channels first.
- Self-serve Shopify/WooCommerce apps — crawl + CSV cover v1 acquisition.

---

# Open Questions (founder decisions)

1. **Hosting:** Vercel (fastest) vs a VPS/Fly.io (cheaper at scale, allows BullMQ instead of Inngest). Recommendation: Vercel + Inngest until revenue justifies re-platforming.
2. **Model economics:** ~~open~~ **Decided: MVP runs on Groq (Llama-class).** Revisit at Phase 3 with real transcripts + unit economics: either stay on Groq across tiers, or tier the model by plan (Groq on free/starter, Claude on paid) via the provider interface.
3. **Checkout:** does v1 link out to the merchant's existing checkout (recommended), or do we host Paystack checkout for merchants' customers too?

---

# Related Documents

- `../product/00-product-overview.md`
- `../product/08-omnichannel.md`
- `../product/09-dashboard-overview.md`
- `../foundation/03-north-star.md`

---

**Status:** Draft — for review

**Version:** 1.0.0
