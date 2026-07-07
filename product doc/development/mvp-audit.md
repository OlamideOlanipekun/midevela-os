# MVP Audit

> Project: Midevela
>
> Document: MVP Implementation Audit
>
> Version: 1.0
>
> Status: Living Document
>
> Last Updated: 2026-07-05
>
> Scope: Code-level audit of `apps/web` against `product/10-mvp-definition.md`

---

# Purpose

`10-mvp-definition.md` defines 5 required workflows for Midevela v1.0. This document records what the current codebase actually does against each workflow, as of 2026-07-05, based on direct code inspection (not documentation claims).

**Verdict:** The individual pieces exist as UI/demo scaffolding, but the critical path is not wired end-to-end. In its current state, the product does not validate the MVP's core hypothesis, because the shipped widget never talks to the backend AI pipeline.

---

# Critical Findings

## 1. The widget and the backend AI are disconnected systems

`apps/web/public/widget/midevela-widget.js` (the script merchants would embed) never calls the backend. There is no `fetch` call anywhere in the file. `handleAIResponse()` (lines 576-612) is a local, hardcoded keyword-matcher with canned replies referencing a fictional "Ankara Co-ord Set," baked directly into the JS. The `data-org-id` attribute is read (line 7) but never used again anywhere else in the file.

Separately, a real pipeline exists server-side: `POST /api/widget/message` (`apps/web/src/app/api/widget/message/route.ts`) → `processConversationTurn` (`apps/web/src/lib/ai/conversation.ts`) → intent/RAG/recommendation modules that read a merchant's actual synced catalog from `db.json`. **This pipeline is never invoked by the widget.**

Impact: a design partner can sync their full catalog and add FAQs, and visitors will still get generic hardcoded Ankara-dress answers regardless of what the business sells.

## 2. Even if wired up, the widget API would reject real visitors

`middleware.ts` (lines 11-15) treats `/api/widget/message` as a protected route requiring the `midevela_mock_auth` cookie. Anonymous shoppers on a merchant's site will never carry that cookie (different origin), and there is no CORS handling anywhere in `src/`. Today, a real cross-origin call to this endpoint would receive a redirect to `/login` instead of a JSON response — a second, independent way the core chat flow breaks.

## 3. Conversations are not persisted anywhere real

MVP goal #5 ("basic log of conversations"): `apps/web/src/app/dashboard/conversations/page.tsx` (line 34) renders a hardcoded `mockConversations` array. Nothing in `processConversationTurn` or the widget route writes to the `Conversation`/`Message` Prisma models defined in `prisma/schema.prisma` — those models are unused by any route. `db.json` has no conversation-related fields at all. Even a conversation that runs through the real backend pipeline leaves no record a business could review.

---

# High-Priority Findings

## 4. Auth is fully mocked despite partially configured real infra

- `.env.local` contains live Clerk keys (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, etc.), but `middleware.ts` does not use Clerk — it string-matches a `midevela_mock_auth=true` cookie.
- `AuthShell.tsx` (`handleSubmit`, lines 25-27) never validates the password field — any email signs in as any user.
- The "Google" button (`AuthShell.tsx` line 221) has no `onClick` handler — decorative only, no OAuth flow.

MVP goal #1 (auth) is not implemented; Clerk being already configured makes this likely the fastest gap to close.

## 5. Product catalog sync fabricates data silently on failure

`apps/web/src/app/api/workspace/crawl/route.ts` (lines 185-255): when the real crawler finds no `Product` JSON-LD (true for most sites without clean structured data), the code injects fabricated products/policies chosen by keyword-matching the target URL string (`"beauty"`, `"shoe"`, else a generic tee), and still reports `success: true`. A design partner connecting their real store gets fake products with no signal that anything failed — directly undermining the "reliable product synchronization" success criterion in the MVP definition.

---

# Minor Findings

- `apps/web/src/app/api/products/route.ts` (line 93) and `apps/web/src/app/api/knowledge/route.ts` (line 100) return HTTP status `444` for "not found." `444` is a non-standard Nginx-only code; should be `404`.
- Two parallel data stores exist: `db.json` (actually used by every API route) and the Prisma/Postgres schema with `pgvector` (fully modeled, entirely unused). Anyone reading `schema.prisma` would reasonably assume it's live.

---

# What's Solid

- Dashboard UI shell, onboarding flow, and settings/knowledge/product CRUD against `db.json` — functional as a single-tenant demo.
- The RAG/intent/recommendation logic in `lib/ai/*` (keyword-based, explicitly commented as a stand-in for a real LLM/embedding call) has a reasonable interface shape to swap in real embeddings later.
- JSON-LD product crawling works correctly for sites with well-structured data.

---

# Recommended Priority Order

1. Wire the shipped widget to actually call `/api/widget/message`; fix the middleware/CORS block on that route so anonymous cross-origin visitors can reach it.
2. Persist conversations/messages to a real store — likely Prisma/Postgres, since it's already modeled with `pgvector` for the eventual real RAG implementation.
3. Replace mock auth with the Clerk integration that's already configured via env vars.
4. Remove or clearly flag the crawl fallback fabrication before any real design partner connects a live site.

---

# Related Documents

- 10-mvp-definition.md
- roadmap.md
- sprint-01.md
