# Website Widget

> **Project:** Midevela
>
> **Document:** Website Widget
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Frontend Team
>
> **Last Updated:** 2026-06-29

---

# Purpose

The Website Widget embeds Midevela into any ecommerce website with a single JavaScript snippet.

It is the entry point for customer conversations and the primary integration surface for businesses.

---

# Mission

Deploy an intelligent sales assistant on any website in under five minutes.

---

# Design Goals

The widget must be:

- Lightweight
- Fast
- Responsive
- Brandable
- Accessible
- Secure

It should have minimal impact on page performance.

---

# Installation

Businesses install the widget by:

1. Creating a workspace.
2. Verifying their domain.
3. Copying a JavaScript snippet.
4. Pasting it before the closing `</body>` tag.

Once installed, the widget automatically connects to the Business Brain.

---

# Widget Components

## Floating Launcher

The entry point displayed on every page.

Configurable:

- Position
- Icon
- Color
- Label

---

## Chat Window

Displays:

- Conversations
- Recommendations
- Product cards
- Images
- Quick replies
- Typing indicators

---

## Product Cards

Each recommendation includes:

- Product image
- Name
- Price
- Description
- CTA button

---

## Conversation Panel

Supports:

- Rich text
- Buttons
- Carousels
- Forms
- Links
- Attachments

---

# Personalization

Businesses can customize:

- Brand colors
- Logo
- Welcome message
- Fonts
- Language
- Widget size
- Theme

No code changes required.

---

# Visitor Detection

The widget automatically detects:

- Current page
- Viewed products
- Cart status
- Session activity
- Referral source

These signals feed the Behavior Engine.

---

# Performance Requirements

- Lazy loading
- Under 100 KB initial payload (excluding AI responses)
- Asynchronous loading
- CDN delivery
- Offline fallback
- Error recovery

---

# Security

The widget should:

- Verify domain ownership
- Encrypt all communication
- Prevent unauthorized embedding
- Support CSP policies
- Rotate authentication tokens

---

# Events

The widget emits:

- WidgetLoaded
- WidgetOpened
- WidgetClosed
- ConversationStarted
- ProductClicked
- CheckoutStarted
- ErrorOccurred

---

# APIs

Primary endpoints:

- Authentication
- Conversation
- Recommendations
- Analytics
- Customer Memory

---

# Analytics

Track:

- Widget open rate
- Engagement rate
- Average response time
- Conversation depth
- Conversion influence

---

# Future Roadmap

- Voice widget
- Full-screen shopping mode
- Embedded checkout
- Live co-browsing
- Screen sharing
- AI video assistant

---

# Related Documents

- website-sync.md
- analytics.md
- integrations.md
- 05-architecture/frontend.md

---

**Status:** Approved ✅
