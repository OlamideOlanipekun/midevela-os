# ADR-0007: Omnichannel Commerce Architecture

Status: Accepted

Date: 2026-06-29

---

# Context

Customers no longer purchase through a single channel.

A buyer may

- Discover a product on Instagram
- Continue on the website
- Ask questions on WhatsApp
- Complete checkout later

Traditional systems create separate conversations for each channel.

This fragments customer understanding.

---

# Decision

Adopt an omnichannel architecture where every interaction belongs to one customer timeline.

Channels become communication interfaces—not separate customer records.

---

# Supported Channels

- Website
- WhatsApp
- Instagram
- Facebook
- Email

Future

- TikTok
- Telegram
- Discord
- Voice

---

# Architecture

Customer

↓

Identity Resolution

↓

Customer Profile

↓

Conversation Timeline

↓

Business Brain

↓

AI Engines

↓

Response

---

# Benefits

- Unified customer history
- Better recommendations
- Shared customer memory
- Consistent AI responses
- Accurate analytics

---

# Trade-offs

- More complex synchronization
- Identity resolution challenges
- Channel API dependencies

---

# Alternatives

Separate channel conversations.

Rejected because it duplicates customer records and weakens AI intelligence.

---

# Outcome

Every conversation contributes to one Business Brain and one Customer Memory.

---

**Status:** Accepted
