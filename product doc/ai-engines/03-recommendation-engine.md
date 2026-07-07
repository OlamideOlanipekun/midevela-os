# 03 - Recommendation Engine

> **Project:** Midevela
>
> **Document:** Recommendation Engine
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

The Recommendation Engine determines exactly which products to suggest to a customer based on their constraints, preferences, and the business's current inventory.

It is deterministic where necessary (filtering out-of-stock items) and probabilistic where helpful (finding semantically similar products).

---

# Core Responsibilities

1. **Filtering:** Eliminate products that do not match the customer's hard constraints (e.g., budget, size, availability).
2. **Scoring & Ranking:** Rank the remaining products based on how well they solve the customer's stated problem.
3. **Reasoning:** Generate the "Why" behind the recommendation so the Conversation Engine can explain it transparently.

---

# Recommendation Workflow

```text
Customer Need Detected (from Intent Engine)
↓
Apply Hard Filters (Metadata filter on Vector DB)
(e.g., in_stock = true, price < 50000)
↓
Semantic Search
(Find products that solve the specific problem)
↓
Rank Top 3 Candidates
↓
Generate Reasoning
(Why Product A over Product B?)
↓
Pass to Conversation Engine
```

---

# The "Reasoning" Requirement

A core principle of Midevela is **Confidence before Conversion**. 
The Recommendation Engine must never just return a list of links. It must generate an internal explanation.

*Example internal output payload:*
```json
{
  "recommended_product_id": "SKU-123",
  "reasoning": "Fits the customer's budget, has the required battery life they asked for, and is currently in stock.",
  "alternatives": ["SKU-124"]
}
```

---

# Related Documents
- 05-shopping-experience.md
- 01-knowledge-engine.md

---

**Status:** Approved ✅
