# ADR-0004: Persistent Customer Memory

Status: Accepted

Date: 2026-06-29

---

# Context

Most AI assistants treat every conversation as a new interaction.

Customers repeatedly answer the same questions, re-explain their preferences, and lose continuity between shopping sessions.

This creates poor buying experiences and lower conversion rates.

---

# Decision

Implement a persistent Customer Memory layer shared across every AI engine.

Memory stores long-term business knowledge about each customer while keeping temporary session context separate.

---

# Memory Categories

## Persistent

- Name
- Preferred products
- Purchase history
- Shopping preferences
- Communication style
- Favorite brands
- Frequently asked questions

---

## Session Memory

- Current conversation
- Active cart
- Current recommendations
- Recent searches
- Recent objections

Session memory expires automatically.

---

# Benefits

- Personalized conversations
- Faster recommendations
- Better conversion rates
- Reduced customer repetition
- Higher customer satisfaction

---

# Privacy

Memory belongs to the business workspace.

Customers can request deletion.

Memory follows applicable privacy regulations.

---

# Trade-offs

Additional storage requirements.

More complex AI orchestration.

---

# Alternatives

Session-only conversations.

Rejected because personalization disappears after every interaction.

---

# Outcome

Customer Memory becomes a shared service used by every AI engine.

---

**Status:** Accepted
