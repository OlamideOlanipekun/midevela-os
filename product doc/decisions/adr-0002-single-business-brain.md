# ADR-0002: Single Business Brain

Status: Accepted

Date: 2026-06-29

---

# Context

Many AI products create independent assistants for different features.

Examples

- Sales AI
- Support AI
- Marketing AI

Each develops its own understanding of customers.

---

# Decision

Create one shared **Business Brain** that powers every AI capability.

Every AI engine reads from and contributes to the same business knowledge.

---

# Architecture

```text
Knowledge

↓

Business Brain

↓

Intent Engine

↓

Recommendation Engine

↓

Conversation Engine

↓

Analytics

↓

Learning Engine
```

---

# Benefits

- Shared context
- Better recommendations
- Consistent responses
- Continuous learning
- Lower inference cost

---

# Trade-offs

- Higher orchestration complexity
- More sophisticated memory management

---

# Alternatives

Independent AI assistants.

Rejected because they duplicate context and reduce intelligence.

---

**Status:** Accepted
