# MVP Definition

> **Project:** Midevela
>
> **Document:** MVP Definition
>
> **Version:** 1.1.0 (Revised)
>
> **Status:** Approved ✅
>
> **Owner:** Founder
>
> **Last Updated:** 2026-06-30

---

# Purpose

This document defines the exact scope of **Midevela v1.0**.

The MVP is intentionally stripped down to its bare essentials. Its goal is to validate the single most critical hypothesis:

> **Businesses will pay for an AI that increases conversion by guiding customers better than a traditional website.**

If a feature does not directly support this validation, it is deferred to Phase 2.

---

# MVP Goals

The MVP must allow a business to:

1. Sign up and authenticate.
2. Connect their website (import product catalog via crawl/sync).
3. Install the website widget via JS snippet.
4. Allow visitors to chat with the AI for product recommendations and Q&A.
5. Provide the business with a basic log of those conversations.

If these workflows work reliably, the MVP is successful.

---

# In Scope

## Business Platform & Dashboard
- User authentication (Email/Password & Google)
- Workspace creation
- Simple dashboard home (Total Conversations, Total Recommendations)
- Conversation Log viewer

## Product Management
- Website product sync (URL-based crawling of product pages)
- Basic product catalog view (read-only for MVP)

## Knowledge Engine
- Standard RAG over the imported product catalog and a single manual FAQ text input.

## Website AI (The Widget)
- Floating launcher & chat window
- Context-aware conversations
- Product recommendations (with images and links to checkout)
- Objection handling based on catalog data

---

# Out of Scope (Deferred to Phase 2+)

These features are intentionally deferred to guarantee a 90-day launch window:

- Omnichannel (WhatsApp, Instagram, Facebook, Email)
- Cross-session Customer Memory & Identity Resolution
- Advanced Analytics & Revenue Tracking
- Real-time Intent Radar & Buying Confidence visualization
- Manual product upload/editing UI
- Complex team management and roles
- Advanced workflows and automations
- Predictive inventory

---

# Success Criteria

The MVP is successful if businesses can demonstrate:
- Increased conversion rate for visitors who engage with the widget
- Faster buying decisions
- High AI recommendation accuracy

## Technical Success Criteria
- < 3 second AI response time
- Reliable product synchronization
- < 100kb widget payload impact on client websites

---

# Launch Metrics

Within the first 90 days, target:
- 10 active design partner businesses
- 5,000 AI conversations
- 1,000 recommendations
- Positive qualitative feedback and 3 case studies

---

# Guiding Principle

Every feature added after MVP must answer one question:

> **Will this help businesses understand customers better and increase buying confidence?**

---

# Related Documents

- roadmap.md
- sprint-01.md
- ai-architecture.md

---

**Status:** Approved ✅
