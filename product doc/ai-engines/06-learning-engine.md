# 06 - Learning Engine

> **Project:** Midevela
>
> **Document:** Learning Engine
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

The Learning Engine ensures the Business Brain becomes smarter with every interaction. It does not blindly retrain LLMs; rather, it analyzes outcomes to adjust prompt strategies, retrieval weights, and recommendations for future conversations.

---

# Core Responsibilities

1. **Feedback Loop Analysis:** Track which AI recommendations lead to purchases and which lead to drop-offs.
2. **Knowledge Gap Detection:** Identify questions the AI repeatedly fails to answer.
3. **Recommendation Weighting:** Adjust the internal ranking of products based on conversion success.

---

# How It Works (Without Retraining)

Training custom foundation models is expensive and slow. Midevela learns through **Context Optimization**.

1. **The Positive Loop:** 
   - AI recommends Product A for query "dry skin." 
   - Customer buys Product A. 
   - The Learning Engine adds a semantic link between "dry skin" and Product A in the Knowledge Engine metadata. Next time, Product A ranks higher for this query.

2. **The Negative Loop:** 
   - Customer asks: "Does this ship to Kano?" 
   - AI doesn't know. 
   - Learning Engine flags this as a **Knowledge Gap** and alerts the business owner in the Dashboard to update their shipping policy. Once updated, the AI knows the answer forever.

---

# Related Documents
- ai-sales-coach.md
- 01-knowledge-engine.md

---

**Status:** Approved ✅
