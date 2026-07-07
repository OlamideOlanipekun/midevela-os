# 02 - Intent Engine

> **Project:** Midevela
>
> **Document:** Intent Engine
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

The Intent Engine acts as the "ears and eyes" of the AI. Before the Conversation Engine decides *what* to say, the Intent Engine determines *why* the customer is here and *how* close they are to buying.

It is responsible for calculating the **Buying Confidence Score** and identifying the **Next Best Action**.

---

# Core Responsibilities

1. **Behavioral Analysis:** Interpret clicks, page views, and scroll depth.
2. **Conversational Intent Detection:** Classify the user's latest message into a specific intent category.
3. **Confidence Scoring:** Maintain the dynamic 0-100 Buying Confidence Score.

---

# Intent Classification

Every message or significant user action is classified into an intent. This is handled by a fast, lightweight classification model (not a slow, expensive LLM).

### Common Intents:
- `product_discovery`: "I'm looking for a laptop."
- `product_comparison`: "Which of these two is better?"
- `objection_price`: "This seems too expensive."
- `objection_trust`: "How do I know this is legit?"
- `policy_question`: "How long does shipping take?"
- `support_request`: "My order hasn't arrived."
- `checkout_assistance`: "My card is being declined."

---

# Buying Confidence Score (0-100)

The Intent Engine continuously updates this score based on a weighted algorithm:

**Positive Adjustments (+):**
- Asking specific product questions
- Viewing the shipping/returns policy page
- Adding to cart (+ High value)
- Providing contact info

**Negative Adjustments (-):**
- Idle on checkout page for > 2 minutes
- Asking repetitive questions (indicates confusion)
- Rapidly switching between radically different products (indicates lack of direction)

---

# Next Best Action (NBA)

Based on the Intent and the Confidence Score, the Intent Engine recommends a "Mode" to the Conversation Engine:
- If Confidence is < 30 and Intent is `product_discovery` -> **Mode: Ask Clarifying Questions**
- If Confidence is > 70 and Intent is `objection_price` -> **Mode: Offer Promo Code or Emphasize Value**

---

# Related Documents
- buying-confidence.md
- 04-conversation-engine.md

---

**Status:** Approved ✅
