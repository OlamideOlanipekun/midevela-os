# MIDEVELA MVP — PARTNER AUDIT REPORT

**Audit Date:** August 8, 2026  
**Audited Target:** Midevela MVP Codebase (`apps/web`, `apps/admin-app`, `packages`, `product doc`)  
**Auditor:** AI Systems Architect & Partner Lead  
**Audit Objective:** Evaluate technical completeness, production readiness, merchant friction points, security, and beta launch blockers.

---

## Executive Summary

**Overall MVP Status:** 🟠 **Needs Critical Fixes Before Public User Acquisition**

Midevela is **architecturally impressive in its core AI sales logic**. Unlike generic chatbots, it features an actual **Intent Router (`intentRouter.ts`)**, a **Shopping State Machine (`conversationState.ts`)**, **Adaptive Product Discovery (`adaptiveDiscovery.ts`)**, **Product Comparison (`compare.ts`)**, **RAG Retrieval (`search.ts`)**, and **Paystack Payment Link Generation (`checkoutHandler.ts`)**. Furthermore, dashboard metrics are **100% real and honest** (all hardcoded fake data simulators have been stripped out).

However, **critical security vulnerabilities, onboarding friction points, database indexing gaps, and missing human handoff UI** must be addressed before onboarding real merchants at scale.

---

## Feature Audit

| Feature | Status | Evidence | Severity |
| :--- | :--- | :--- | :--- |
| **Intent Understanding** | ✅ Complete | Intent router (`intentRouter.ts`) classifies intents into discovery, comparison, details, checkout, objection, and support. | 🟢 Low |
| **Product Discovery** | ✅ Complete | `adaptiveDiscovery.ts` extracts shopper constraints (category, budget, preferences) and grounds search. | 🟢 Low |
| **Product Recommendations** | ✅ Complete | Recommendations re-query live database rows to ensure accurate pricing and active product image URLs (`search.ts`). | 🟢 Low |
| **Product Comparison** | ✅ Complete | Structured side-by-side comparison engine (`compare.ts`) contrasts product attributes and prices cleanly. | 🟢 Low |
| **Hallucination Prevention** | ✅ Complete | Prompting strictly constrains recommendations to retrieved database candidates. IDs are matched against live rows before rendering. | 🟢 Low |
| **Human Handoff (Backend)** | 🟡 Partial | Status updates to `HANDED_OFF` and emits event `publishHumanHandoff`, but **no live chat workspace exists for merchants to reply in real-time**. | 🟠 High |
| **Merchant Onboarding** | 🟡 Partial | 4-step wizard works, but manual script installation creates severe friction for non-technical merchants. | 🔴 Blocker |
| **Product Crawler** | 🟡 Partial | Layered strategy (Shopify JSON → WooCommerce JSON → JSON-LD → Groq HTML → Firecrawl). Capped at 250 products; requires Firecrawl API key for JS-heavy stores. | 🟡 Medium |
| **Out-of-Stock Handling** | 🔴 Missing | `InventoryStatus` enum exists in schema (`OUT_OF_STOCK`), but **`search.ts` RAG query does not filter out out-of-stock items**. AI will recommend out-of-stock products. | 🔴 Blocker |
| **Widget Installation** | 🔴 Missing | Merchants receive a raw `<script>` tag. No automated snippet verifier, no 1-click platform plugins (Shopify/WordPress/Bumpa/Selar). | 🔴 Blocker |
| **Admin API Security** | 🔴 Missing | `apps/admin-app/src/app/api/admin/*` routes **have zero authentication checks**, leaving admin endpoints completely exposed if deployed as-is. | 🔴 Blocker |
| **Vector DB Indexing** | 🔴 Missing | `embeddings` table lacks an `HNSW` or `IVFFlat` pgvector index. Every retrieval performs a full table sequential scan. | 🟠 High |
| **Dashboard Metrics** | ✅ Complete | `overview.ts` computes metrics strictly from database rows (conversations, leads, confidence, activity). | 🟢 Low |
| **Rate Limiting** | ✅ Complete | Multi-tiered protection: Redis with memory fallback for IP, Widget Key, Visitor Session, Daily Org Cap, and Monthly Plan Caps. | 🟢 Low |
| **Billing Integration** | ✅ Complete | Paystack recurring subscriptions, automated webhooks with HMAC-SHA512 verification, and plan cap enforcement (`caps.ts`). | 🟢 Low |

---

## Critical Bugs

1. **Out-of-Stock Products Recommended to Shoppers (`search.ts`):**  
   The vector retrieval function in `search.ts` queries `embeddings` and joins `products`, but fails to include `WHERE p.inventory_status != 'OUT_OF_STOCK'`. The AI will confidently recommend sold-out items to active buyers.
2. **Dual Prisma Schemas Causing Database Drift:**  
   `apps/web/prisma/schema.prisma` and `apps/admin-app/prisma/schema.prisma` define separate, slightly divergent schemas for the same PostgreSQL database. Running migrations from one will corrupt or drop models used by the other.
3. **No Live Chat Interface for Human Handoff:**  
   When a conversation transitions to `status = 'HANDED_OFF'`, the AI steps aside, but there is no merchant live-chat UI in the dashboard to respond to the customer. The customer is left hanging.

---

## Security Issues

1. **Unauthenticated Admin API Routes (`apps/admin-app`):**  
   API endpoints inside `apps/admin-app` do not invoke authentication middleware or `requireUser()`. Anyone who guesses or discovers an admin API endpoint can access tenant records.
2. **Missing pgvector Index on `embeddings.embedding`:**  
   No `HNSW` or `IVFFlat` index exists on the 1024-dimension vector column. At >5,000 products across merchants, vector retrieval query latency will skyrocket and degrade database performance.
3. **Unsanitized HTML Rendering Surface in Widget Script (`public/widget/midevela-widget.js`):**  
   The 194KB unminified widget script constructs UI components using `innerHTML` string concatenation. Product descriptions or customer names containing malicious HTML/JS could trigger DOM XSS inside the visitor's browser.

---

## UX Problems

1. **Manual Snippet Installation Required:**  
   Non-technical merchants are instructed to "paste this before `</body>`". Nigerian merchants using Selar, Bumpa, or simple Instagram storefronts do not have code editors or access to HTML source files.
2. **No Installation Verification Diagnostics:**  
   After pasting the script, merchants have no way to verify if the widget is active other than opening their live website in incognito mode.
3. **Unlinked "Powered by Midevela" Branding:**  
   The widget footer contains static text instead of a referral link, missing an organic growth mechanism.

---

## Merchant Onboarding Problems

1. **CSV Catalog Import Strictness:**  
   If a merchant uploads a catalog CSV with non-standard column headers (e.g. `Item Name` instead of `name`, `Amount` instead of `price`), the importer skips the rows without suggesting column mapping.
2. **Domain Restriction Confusion During Setup:**  
   If a merchant leaves `allowedDomains` blank or inputs `http://mybrand.com` with the scheme, requests can get blocked by origin validation without an explicit error in the dashboard.

---

## Performance Problems

1. **Synchronous Embedding Generation on Product Writes:**  
   In `sync.ts`, adding or updating a product synchronously calls Voyage AI's REST API (`voyage-3-large`). This adds 300–600ms latency to catalog saving operations.
2. **Unpaginated List Endpoints:**  
   API routes for listing products (`/api/products`), knowledge entries (`/api/knowledge`), and customers return unpaginated arrays. Accounts with >2,000 products will experience slow payload transfers and dashboard lag.
3. **Unminified Widget Monolith (`194KB`):**  
   `midevela-widget.js` is served as a single unminified JavaScript file without bundle optimization, increasing page load impact on merchant sites.

---

## Missing Features

1. **Real-time Live Chat Workspace for Handed-Off Conversations.**
2. **Native E-commerce Platform Integrations (Shopify App, WooCommerce Plugin, WordPress Plugin).**
3. **Product Variant Matrix (Selecting sizes/colors directly within the widget).**
4. **Order Tracking & Conversational Checkout Webhook Integration.**

---

## Production Risks

1. **If 100 merchants start tomorrow:**  
   The system will function, but vector search will slow down due to the missing vector index, and unauthenticated admin routes expose severe compliance risks.
2. **If 1,000 merchants start tomorrow:**  
   The PostgreSQL connection pool will saturate due to synchronous vector scans, and Groq API token spend will spike without per-org hard token budgets.
3. **If 10,000 merchants start tomorrow:**  
   Database queries will time out without read replicas/caching, and BullMQ worker jobs running on in-process fallback will fail without dedicated Redis cluster infrastructure.

---

## Beta Readiness Classification

### 🟠 **Needs Critical Fixes**

*The core AI engine is exceptionally strong, but security issues, missing vector indexes, out-of-stock retrieval bugs, and installation friction must be resolved prior to aggressive merchant acquisition.*

---

## Top 10 Fixes (Ranked by Impact × Urgency)

| Rank | Fix Description | Location / Action | Impact × Urgency |
| :---: | :--- | :--- | :--- |
| **1** | **Filter Out-Of-Stock Products in RAG Search** | Update `search.ts` query to strictly exclude `inventory_status = 'OUT_OF_STOCK'`. | 🔴 Blocker |
| **2** | **Lock Down Admin API Routes** | Add authentication & role authorization guards to all `apps/admin-app/src/app/api/admin` routes. | 🔴 Blocker |
| **3** | **Add HNSW Vector Index to Postgres** | Run Prisma migration to add `CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);`. | 🔴 Blocker |
| **4** | **Consolidate Prisma Schemas** | Unify `apps/web/prisma/schema.prisma` and `apps/admin-app/prisma/schema.prisma` into a shared package. | 🟠 High |
| **5** | **Build Automated Widget Installation Verifier** | Add a "Check Installation" button in Dashboard → Widget that pings the merchant website for the live snippet. | 🟠 High |
| **6** | **Implement Basic Live-Chat / Handoff Workspace** | Allow merchants to view and reply to `HANDED_OFF` conversations directly from `/dashboard/conversations`. | 🟠 High |
| **7** | **Sanitize Widget DOM Insertion** | Replace raw `innerHTML` string interpolation in `midevela-widget.js` with sanitized DOM nodes to eliminate XSS risks. | 🟠 High |
| **8** | **Async Embedding Generation via Queue** | Move `syncProductEmbedding` calls from synchronous API route execution to background BullMQ queue jobs. | 🟡 Medium |
| **9** | **Add Flexible CSV Column Mapping** | Allow CSV catalog importer to automatically recognize variations like `Item`, `Title`, `Cost`, `Amount`. | 🟡 Medium |
| **10** | **Bundle & Minify Widget Script** | Set up a Vite/Rollup build pipeline for `midevela-widget.js` to reduce bundle size from 194KB to <45KB. | 🟡 Medium |

---

## Final Recommendation

> **If we started onboarding 20 real merchants tomorrow, what would most likely go wrong?**

1. **Merchants will struggle to install the widget snippet:** Non-technical store owners on Selar, Bumpa, or custom sites won't know how to edit HTML source files, leading to onboarding drop-off.
2. **The AI will recommend out-of-stock items:** Because `search.ts` doesn't filter by `inventory_status`, shoppers will ask for products that are sold out, causing customer frustration and merchant complaints.
3. **Handed-off customers will be abandoned:** When a customer asks a complex question that triggers human handoff, the merchant has no live dashboard interface to respond to them.

### Strategic Execution Plan
Focus engineering efforts immediately on **Top Fixes 1–6**. Once out-of-stock items are filtered, admin routes are secured, pgvector is indexed, and installation verification is in place, Midevela will be **100% ready for controlled beta merchant onboarding**.
