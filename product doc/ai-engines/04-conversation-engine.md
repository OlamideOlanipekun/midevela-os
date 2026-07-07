# 04 - Conversation Engine

> **Project:** Midevela
>
> **Document:** Conversation Engine
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

The Conversation Engine is the "voice" of the AI. It takes inputs from all other engines (Knowledge, Intent, Recommendation, Memory) and generates the actual natural-language response sent to the customer.

It guarantees that responses are safe, on-brand, accurate, and aimed at increasing Buying Confidence.

---

# Core Responsibilities

1. **Prompt Orchestration:** Dynamically assemble the prompt sent to the core LLM.
2. **Tone & Persona Enforcement:** Ensure the AI sounds like the specific business (e.g., friendly vs. professional).
3. **Safety & Guardrails:** Prevent hallucinations, off-topic conversations, and competitor mentions.

---

# Prompt Assembly

The Conversation Engine does not use static prompts. It builds them dynamically for every message:

```text
[SYSTEM: Business Brand Voice & Rules]
+
[MEMORY: Customer Profile & Past Purchases]
+
[CONTEXT: Current Conversation History]
+
[INTENT: The Next Best Action (e.g., "Answer Price Objection")]
+
[KNOWLEDGE: Retrieved Facts / Recommended Products]
= 
Final Prompt sent to LLM
```

---

# Anti-Hallucination Guardrails

To prevent the AI from inventing information, the Conversation Engine enforces strict rules:

1. **The "Admit Ignorance" Rule:** If the required information is not returned by the Knowledge Engine, the LLM is explicitly instructed to say: *"I don't have that exact information right now, but I can connect you with a human agent to confirm."*
2. **Price & Policy Lock:** The LLM is strictly prohibited from offering discounts or quoting prices that do not exactly match the Knowledge Engine payload.

---

# Related Documents
- ai.md
- 02-intent-engine.md

---

**Status:** Approved ✅
