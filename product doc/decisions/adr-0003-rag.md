# ADR-0003: Retrieval-Augmented Generation (RAG)

Status: Accepted

Date: 2026-06-29

---

# Context

Foundation language models cannot reliably answer business-specific questions without access to company knowledge.

Fine-tuning for every customer is expensive, slow, and difficult to maintain.

---

# Decision

Adopt Retrieval-Augmented Generation (RAG) as the primary knowledge strategy.

Business information will be retrieved dynamically during every AI interaction.

---

# Architecture

```text
Knowledge

↓

Embeddings

↓

Vector Database

↓

Retrieval

↓

Prompt Assembly

↓

LLM

↓

Grounded Response
```

---

# Benefits

- Always uses current information
- No customer-specific model training
- Lower operational cost
- Faster updates
- Reduced hallucinations

---

# Trade-offs

- Additional retrieval latency
- More infrastructure components

---

# Alternatives

- Fine-tuning
- Prompt-only context
- Static FAQs

Rejected because they either scale poorly or produce outdated responses.

---

# Outcome

RAG becomes the default mechanism for all AI knowledge retrieval across Midevela.

---

**Status:** Accepted
