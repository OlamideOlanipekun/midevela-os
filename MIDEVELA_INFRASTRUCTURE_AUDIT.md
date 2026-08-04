# Midevela Infrastructure Audit Report

> **Date:** July 29, 2026
> **Auditor:** Staff Software Engineer
> **Scope:** Full-stack monorepo (web + admin-app), infrastructure, security, AI pipeline

---

## Executive Summary

Midevela is architecturally sound at the feature level — the widget AI engine, conversation state machine, multi-tenant session handling, and recovery/escalation flows are well-engineered for a v1 product. The core sales loop (discover → qualify → recommend → compare → checkout) is genuinely differentiated.

However, the codebase has **four critical structural problems** that block production readiness:

1. **Two divergent Prisma schemas pointing at the same database** — will cause irreversible table drift
2. **Admin app API routes have zero authentication** — any attacker can access all merchant data
3. **No vector index on embeddings** — AI search will fail at ~10K vectors
4. **No deployment automation** — no Docker, no CI/CD, no health probes

Additionally, the **widget client is a 5,150-line unminified monolith** with XSS surface, skincare-specific hardcoding (limits TAM), and no build pipeline.

---

## Production Readiness Scores

| Category | Score | Rationale |
|----------|-------|-----------|
| **Architecture** | 6/10 | Good feature isolation but dual Prisma schemas and no shared packages |
| **Security** | 4/10 | Admin API has zero auth, widget has XSS surface, CSRF gaps |
| **Performance** | 5/10 | No vector index, no caching, no streaming, no code splitting |
| **Scalability** | 4/10 | No indexes on FKs, no pagination on lists, single LLM provider |
| **Multi-tenancy** | 7/10 | Well-implemented org scoping, but widget origin verification has gaps |
| **AI Infrastructure** | 4/10 | Single model provider, no cost tracking, no hallucination detection |
| **Database** | 3/10 | Dual schemas, missing FKs/indexes/constraints, no pooled client |
| **API Design** | 5/10 | No standard envelope, no validation library, admin API unprotected |
| **Observability** | 3/10 | No structured logging, no tracing, no error tracking, stub metrics |
| **Code Quality** | 6/10 | Good patterns overall but dead code, large files, magic numbers |

**Overall Production Readiness Score: 4.7/10**

---

## Critical Issues

### C1. Admin app API routes have zero authentication
**Files:** All `apps/admin-app/src/app/api/admin/*/route.ts`
**Risk:** Any attacker who discovers the admin API URLs can read all merchant data, conversations, billing info, and perform destructive operations.
**Fix:** Add `withAdminGuard` to every admin route. None currently use it.

### C2. Two divergent Prisma schemas on the same database
**Files:** `apps/web/prisma/schema.prisma` ↔ `apps/admin-app/prisma/schema.prisma`
**Risk:** 20+ models duplicated with different field types (e.g., `ChannelIntegration.channel` is an enum in web but a String in admin). Running `prisma db push` from either schema will corrupt the other's data. UsageRecord has structurally incompatible schemas.
**Fix:** Consolidate to a single Prisma schema in `packages/database/`. Both apps import from it.

### C3. No vector index on embeddings — full table scan on every search
**File:** `apps/web/src/server/retrieval/search.ts`
**Risk:** Every semantic search does a sequential scan of all embeddings. At ~10K vectors, query time degrades to seconds. At ~100K, it becomes unusable.
**Fix:** Create an IVFFlat or HNSW index on the `embedding` column.

### C4. Admin app health endpoints are publicly accessible
**Files:** `apps/admin-app/src/app/api/admin/catalog/health/route.ts`, `apps/admin-app/src/app/api/admin/knowledge/health/route.ts`
**Risk:** Exposes internal system health data (database stats, knowledge engine metrics) without authentication.
**Fix:** Add `withAdminGuard` to these routes.

### C5. No Docker, CI/CD, or deployment automation
**Risk:** Zero infrastructure-as-code. No reproducible builds. No automated deployment. Manual Vercel pushes only.
**Fix:** Add Dockerfile, docker-compose.yml, and CI pipeline.

---

## High Priority

### H1. No validation library used anywhere
**Files:** All route files (web + admin)
**Risk:** Malformed input propagates to Prisma/service layers, causing 500s instead of 400s. No schema enforcement on any endpoint.
**Fix:** Add `zod` and validate all request bodies and query parameters.

### H2. No standard API response envelope
**Files:** Multiple web routes use different shapes — bare objects, `{ success, data }`, `{ error }`
**Risk:** Clients cannot reliably parse responses across endpoints.
**Fix:** Adopt a standard envelope: `{ success, data?, error?, pagination? }`.

### H3. Health readiness endpoint requires authentication
**File:** `apps/web/src/app/api/health/readiness/route.ts`
**Risk:** Load balancers and monitoring systems cannot check service health (401 on every probe).
**Fix:** Split into `/api/health/liveness` (unauthenticated, checks DB+Redis connectivity) and `/api/health/readiness` (authenticated, business-level).

### H4. No retry/DLQ on BullMQ jobs
**File:** `apps/web/src/server/queues/queue.ts`
**Risk:** Every job failure is permanent. No recovery path, no dead letter queue.
**Fix:** Add `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }`.

### H5. Queue health metric reports all zeros
**File:** `apps/web/src/server/queues/workers.ts`
**Risk:** `publishQueueHealth(name, 0, 0, 0)` renders queue monitoring useless.
**Fix:** Use `bullmq`'s `getJobs()` or `getMetrics()` to report real counts.

### H6. Event bus is in-memory only — events lost on restart
**File:** `apps/web/src/server/events/bus.ts`
**Risk:** Critical events (billing, auth, merchant actions) are lost on process restart. No replay capability.
**Fix:** Add a persistent event store (DB-backed) for important event types, or use a message broker.

### H7. No pagination on customer/knowledge/product list endpoints
**Files:** `apps/web/src/app/api/customers/route.ts`, `apps/web/src/app/api/knowledge/route.ts`, `apps/web/src/app/api/products/route.ts`
**Risk:** At 10K+ records, these endpoints will timeout or OOM.
**Fix:** Add page/limit pagination to all list endpoints.

### H8. Widget is a 5,150-line monolith (192KB unminified)
**File:** `apps/web/public/widget/midevela-widget.js`
**Risk:** No tree-shaking, no TypeScript, no tests, no source maps. CSS engine (~2,400 lines) is inline template literals.
**Fix:** Extract into a proper build pipeline (Vite/Rollup). Separate CSS, state, API client, UI components.

### H9. Widget has skincare-specific hardcoding
**File:** `apps/web/public/widget/midevela-widget.js`
**Risk:** Qualification flow asks "What's your skin type?" for non-beauty merchants. Limits TAM to ~5% of e-commerce.
**Fix:** Make qualification 100% server-driven. Client should only render what the server sends.

### H10. No rate limiting on authenticated merchant API routes
**Files:** All non-widget web API routes
**Risk:** Compromised session can abuse analytics, products, knowledge endpoints without limit.
**Fix:** Add rate limiting by user/org ID to all authenticated endpoints.

### H11. Missing foreign key indexes (18 identified)
**Files:** Both schema files
**Risk:** JOINs on unindexed FKs (especially `planId`, `subscriptionId`, `orgId` across 10+ tables) degrade at scale.
**Fix:** Add `@@index` on all foreign key columns.

### H12. No caching anywhere (Redis, in-memory, or CDN)
**Risk:** Every API call, LLM query, and vector search incurs full compute cost. Identical queries on repeat visits pay the same price.
**Fix:** Cache AI responses by query hash (short TTL), cache dashboard/analytics data (medium TTL), add CDN caching for public widget assets.

### H13. No streaming for AI responses
**File:** `apps/web/src/server/conversation/llm.ts`
**Risk:** Users wait 2-8 seconds for full 70B model generation before seeing any response. Poor UX.
**Fix:** Enable `stream: true` on Groq calls. Return a ReadableStream to the widget client.

### H14. No cost tracking for AI usage
**Risk:** Impossible to measure or cap per-org LLM spend. No visibility into which merchants drive cost.
**Fix:** Convert token counts to cost per model. Track per-org daily/monthly spend. Enforce caps.

### H15. Missing `onDelete` cascade on 10+ relations
**Files:** Both schemas
**Risk:** Deleting a Plan, Product, or Subscription with dependent records will crash (FK violation).
**Fix:** Add `onDelete: Cascade` or `onDelete: SetNull` to all child relations.

---

## Medium Priority

### M1. CSRF protection missing on logout, forgot-password, reset-password routes
**Files:** Multiple web auth routes skip `assertOrigin(req)`
**Fix:** Pass `req` to `withErrorHandling` so `assertOrigin` is invoked.

### M2. Admin hardening DELETE endpoint uses JSON body for resource ID (non-standard)
**File:** `apps/admin-app/src/app/api/admin/hardening/route.ts`
**Fix:** Use URL path parameter `/:id` for resource identification.

### M3. `workspace/settings` uses POST for idempotent updates (should be PUT)
**File:** `apps/web/src/app/api/workspace/settings/route.ts`
**Fix:** Change to PUT/PATCH for updates.

### M4. `setup-db/route.ts` uses GET for mutation (should be POST)
**File:** `apps/web/src/app/api/setup-db/route.ts`
**Fix:** Change to POST.

### M5. No idempotency on products PUT / knowledge POST
**Files:** `products/route.ts`, `knowledge/route.ts`
**Risk:** Network retries cause duplicate products or knowledge entries.
**Fix:** Accept optional `Idempotency-Key` header, deduplicate via DB.

### M6. Widget `customerId` is trivially forgeable (localStorage only)
**File:** `apps/web/public/widget/midevela-widget.js`
**Risk:** User can read another user's conversation history by spoofing `customerId`.
**Fix:** Server-issued session tokens bound to HttpOnly cookie.

### M7. Widget origin verification allows `*.vercel.app` globally
**File:** `apps/web/src/server/conversation/widgetAuth.ts`
**Risk:** Any Vercel deployment can access any merchant's widget API.
**Fix:** Only allow `*.vercel.app` for the merchant's own Vercel deployments, or require explicit domain registration.

### M8. Event pipeline never starts — `events/register.ts` is never imported
**File:** `apps/web/src/server/events/register.ts` (dead code)
**Fix:** Import in app initialization, or remove.

### M9. `conversationModes.ts` and `conversationState.ts` define the same type divergently
**Files:** `apps/web/src/server/widget/conversationModes.ts` (dead code), `conversationState.ts`
**Fix:** Consolidate to a single definition.

### M10. Embedding writes are synchronous (inline on request thread)
**File:** `apps/web/src/server/knowledge/sync.ts`
**Risk:** Every product save and knowledge entry write waits for Voyage API latency (~200-500ms).
**Fix:** Move embedding generation to background BullMQ job.

### M11. No monitoring for anything beyond business metrics
**Risk:** No CPU/memory tracking, no error rate monitoring, no DB query performance tracking.
**Fix:** Add basic infrastructure metrics (request latency, error rate, DB pool usage).

### M12. Feature flags are DB-backed with no caching
**File:** `apps/web/src/server/admin/features.ts`
**Risk:** Every flag check is a DB query. At high traffic, this adds unnecessary load.
**Fix:** Cache flags in Redis with short TTL.

### M13. Widget FAB defaults to bottom-left (conflicts with industry standard)
**File:** `apps/web/public/widget/midevela-widget.js`
**Fix:** Default to bottom-right, configurable via `data-position`.

### M14. Hardcoded popular questions in widget don't match merchant
**File:** `apps/web/public/widget/midevela-widget.js`
**Fix:** Return `suggestedQuestions[]` from `/api/widget/init` response.

---

## Low Priority

### L1. No API versioning strategy
**Fix:** Acceptable for v1. Add before first breaking change.

### L2. No SRI hashes on widget embed
**Fix:** Generate at build time once build pipeline exists.

### L3. No mobile keyboard handling for widget
**Fix:** Listen to `visualViewport.resize` on iOS Safari.

### L4. "Powered by Midevela AI" footer not linked
**Fix:** Make it a clickable referral link.

### L5. Token usage tracked but never capped
**Fix:** Add per-turn token budget enforcement.

### L6. No configuration validation at startup (missing env vars)
**Fix:** Add zod schema validation for all required env vars at process start.

### L7. `admin/app/src/lib/dashboard/cache.ts` — empty file
**Risk:** Imported but provides nothing. Dead import chain.

### L8. HSL color interpolation in widget for theme support — good but complex
**Fix:** Document or simplify.

---

## Security Findings

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| S1 | Admin API routes have zero auth | **Critical** | All `apps/admin-app/src/app/api/admin/` routes |
| S2 | Widget uses `innerHTML` extensively (XSS surface) | **High** | `midevela-widget.js` (2,400+ lines of template styles) |
| S3 | Widget `customerId` forgeable via localStorage | **High** | `midevela-widget.js` |
| S4 | Widget origin verification allows all Vercel deployments | **High** | `widgetAuth.ts` |
| S5 | Forgot-password reset token logged to console | **Critical (if unresolved)** | `forgot-password/route.ts` |
| S6 | CSRF missing on logout, forgot-password, reset-password | **Medium** | Multiple auth routes |
| S7 | Health check requires auth (no unauthenticated liveness) | **Medium** | `health/readiness/route.ts` |
| S8 | Public health endpoints in admin app | **Critical** | `admin/catalog/health`, `admin/knowledge/health` |
| S9 | Cookie Secure flag only in production (not preview deploys) | **Medium** | `session.ts` |
| S10 | CSP missing `script-src` directive | **Medium** | `next.config.ts` |
| S11 | No rate limiting on authenticated web routes | **High** | All non-widget web routes |
| S12 | Widget key exposed in client — no domain-origin enforcement | **High** | `widgetAuth.ts` (permissive fallback when no domains configured) |
| S13 | No subscriber integrity (SRI) on widget script tag | **Medium** | Widget embed snippet |

---

## Performance Findings

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| P1 | No vector index on embeddings | Full table scan on every search | `retrieval/search.ts` |
| P2 | No caching (AI, API, or CDN) | Full cost on every request | Everywhere |
| P3 | No streaming for AI responses | 2-8s latency before any UX | `conversation/llm.ts` |
| P4 | Widget 192KB unminified monolith | Slow load for merchant sites | `public/widget/midevela-widget.js` |
| P5 | Embedding writes are synchronous | 200-500ms added to writes | `knowledge/sync.ts` |
| P6 | No pagination on 3+ list endpoints | OOM at 10K+ records | `customers`, `knowledge`, `products` |
| P7 | 18+ unindexed foreign keys | Slow JOINs at scale | Both schema files |
| P8 | No bundle optimization | No code splitting, no tree-shaking | Widget build |
| P9 | Single LLM provider (no failover) | Full outage if Groq is down | `conversation/llm.ts` |
| P10 | No token budget enforcement | Long conversations may exceed context window | `conversation/engine.ts` |

---

## Scalability Findings

| ID | Finding | Bottleneck At | Location |
|----|---------|---------------|----------|
| SC1 | Dual Prisma clients same DB | 2 connections | 10 merchants |
| SC2 | No vector index | 10K embeddings | `retrieval/search.ts` |
| SC3 | No pagination on list endpoints | 1K records | `customers`, `knowledge`, `products` |
| SC4 | Unindexed FKs | 10K records | Both schemas |
| SC5 | In-memory event bus (at-most-once) | Process restart | `events/bus.ts` |
| SC6 | Inline embedding computation | 100 concurrent writes | `knowledge/sync.ts` |
| SC7 | Rate limiter local fallback (no Redis) | 2+ instances | `ratelimit/limiter.ts` |
| SC8 | No connection pool limits configured | 20+ concurrent queries | Both datasource blocks |
| SC9 | BullMQ has no retry/DLQ | First job failure | `queues/queue.ts` |
| SC10 | No message broker for inter-service events | Single process | `events/bus.ts` |

**Scalability targets:**
- **10 merchants:** Current architecture handles this easily
- **100 merchants:** Need pagination + vector index + FK indexes
- **1,000 merchants:** Need caching + background embedding + streaming + cost tracking
- **10,000 merchants:** Need connection pooling + message broker + CDN + multi-region DB
- **100,000 merchants:** Need microservice decomposition + event sourcing + read replicas

---

## Database Findings

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| DB1 | Two divergent schemas for same DB | **Critical** | `web/prisma/` vs `admin-app/prisma/` |
| DB2 | 20+ models duplicated with drift | **Critical** | Both schemas |
| DB3 | UsageRecord has incompatible schemas | **Critical** | Both schemas (different columns) |
| DB4 | 18 unindexed foreign keys | **High** | Both schemas |
| DB5 | 10+ relations missing `onDelete` | **High** | Both schemas |
| DB6 | `ChannelIntegration.channel` is enum in web, String in admin | **High** | Both schemas |
| DB7 | 8+ String fields should be enums (SupportTicket, SystemEvent, etc.) | **Medium** | Web schema |
| DB8 | Missing unique constraints (Product.sku, Document.checksum) | **Medium** | Admin schema |
| DB9 | No `connection_limit` in datasource | **Medium** | Both datasource blocks |
| DB10 | 10+ implicit FKs without `@relation` in admin schema | **Medium** | Admin schema |

---

## Infrastructure Findings

| ID | Finding | Severity | Location |
|----|---------|----------|----------|
| I1 | No Docker/deployment manifests | **Critical** | Project root |
| I2 | No CI/CD pipeline | **Critical** | Project root |
| I3 | No health probes suitable for k8s | **High** | `health/readiness/route.ts` |
| I4 | Queue health reports all zeros | **High** | `queues/workers.ts` |
| I5 | No structured logging | **High** | Everywhere (`console.log`) |
| I6 | No tracing (OpenTelemetry, Sentry) | **High** | Everywhere |
| I7 | No error tracking (Sentry) | **High** | Everywhere |
| I8 | No graceful shutdown | **Medium** | `queues/workers.ts` |
| I9 | `REDIS_URL` missing from .env.example | **Medium** | `.env.example` |
| I10 | BullMQ has no retry/DLQ configuration | **High** | `queues/queue.ts` |
| I11 | Event bus is in-memory only | **High** | `events/bus.ts` |
| I12 | Stub workers that accept jobs silently | **High** | `queues/workers.ts` (analytics, cleanup) |
| I13 | Metrics keys without TTL grow unbounded | **Medium** | `metrics/redis.ts` |

---

## Recommended Refactoring

### 1. Consolidate Prisma schemas (Weeks 1-2)
Move ALL models to `packages/database/prisma/schema.prisma`. Both apps import from this single source of truth. Run one migration to reconcile drift. This is the single highest-impact change.

### 2. Add authentication to all admin routes (Week 1)
Wrap every admin API route with `withAdminGuard`. This takes ~2 hours but is critical for security.

### 3. Build widget build pipeline (Weeks 2-3)
Extract the 5,150-line widget monolith into a Vite/Rollup project with TypeScript. Separate:
- `packages/widget-core/` — state machine, API client, intent parser
- `packages/widget-ui/` — DOM rendering, Shadow DOM, CSS, animations
- `apps/web/public/widget/` — built output

### 4. Add AI infrastructure (Weeks 3-4)
- Create vector index (HNSW) on embeddings
- Add streaming to LLM calls
- Add response caching (Redis, by query hash)
- Add cost tracking and per-org budget enforcement

### 5. Fix API consistency (Week 2)
- Add `zod` validation to all routes
- Standardize response envelope
- Add pagination to all list endpoints
- Add rate limiting to authenticated routes

### 6. Add deployment infrastructure (Weeks 4-5)
- Dockerfile for each app
- docker-compose.yml for local development
- CI pipeline (GitHub Actions)
- Health endpoints: `/api/health/liveness` (unauthenticated), `/api/health/readiness` (authenticated)

### 7. Add observability (Ongoing)
- Structured logging (pino or similar)
- Error tracking (Sentry)
- Basic request metrics (latency, error rate, throughput)
- Fix queue health reporting

---

## Remediation Plan (Ordered by Impact)

| Phase | Weeks | Focus | Items |
|-------|-------|-------|-------|
| **1** | 0-1 | **Security & Auth** | C1, C4, S1-S6, H3 |
| **2** | 1-2 | **Database** | C2, H11, H15, DB1-DB8 |
| **3** | 2-3 | **AI & Performance** | C3, H13, H14, P1-P5 |
| **4** | 3-4 | **API & Validation** | H1, H2, H7, H10, M1-M5 |
| **5** | 4-6 | **Deployment & Infra** | C5, H4-H6, I1-I6 |
| **6** | 6-8 | **Widget Revamp** | H8, H9, M6, M13-M14 |
| **7** | 8-12 | **Observability & Polish** | I5-I7, M11-M12, L1-L7 |

---

_End of audit report_
