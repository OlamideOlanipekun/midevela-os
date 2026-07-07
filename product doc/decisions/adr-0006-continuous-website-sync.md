# ADR-0006: Continuous Website Synchronization

Status: Accepted

Date: 2026-06-29

---

# Context

Many commerce platforms rely on scheduled imports.

Businesses update products or policies, but AI continues using outdated information until the next synchronization.

This creates incorrect answers and lost customer trust.

---

# Decision

Use continuous website synchronization instead of periodic imports.

Whenever supported, changes are detected automatically and the Business Brain is updated immediately.

---

# Synchronization Sources

- Website pages
- Product catalog
- Blog articles
- FAQs
- Policies
- Landing pages

---

# Synchronization Pipeline

```text
Website Change

↓

Change Detection

↓

Content Extraction

↓

Document Processing

↓

Embedding Generation

↓

Vector Database

↓

Business Brain Updated
```

---

# Benefits

- Fresh AI knowledge
- Reduced manual work
- Accurate recommendations
- Faster business updates
- Better customer experience

---

# Trade-offs

More background processing.

Higher synchronization complexity.

---

# Alternatives

Daily synchronization.

Manual uploads only.

Rejected because stale information directly impacts AI quality.

---

# Outcome

Knowledge freshness becomes a core platform capability rather than an operational task.

---

**Status:** Accepted
