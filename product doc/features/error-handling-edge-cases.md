# Error Handling & Edge Cases

> **Project:** Midevela
>
> **Document:** Error Handling & Edge Cases
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform / Product Team

---

# Purpose

The AI Shopping Assistant will inevitably encounter unexpected inputs, system outages, or situations where it lacks the knowledge to assist the customer. 

Because Midevela acts as a sales associate representing the business's brand, failure must be graceful, transparent, and guided toward recovery.

---

# Core Principles of Failure

1. **Admit Ignorance:** The AI must never guess product specs or business policies. If it doesn't know, it must say so.
2. **Never Break Character:** Error messages should sound conversational, not like system errors (avoid: *"Error 500: Failed to fetch embeddings"*).
3. **Always Offer an Exit:** When the AI fails, it must offer a pathway to a human agent or a support email.

---

# Specific Edge Cases & Recovery

## 1. Out-of-Scope Queries
**Scenario:** The customer asks about something entirely unrelated to the business (e.g., asking a fashion store about fixing a car, or attempting a prompt injection attack).
**Recovery:** The AI must politely decline and redirect the conversation back to the store. 
*Response:* "I'm specialized in helping you find the perfect [Category] here at [Business Name]. Is there a specific product I can help you look for today?"

## 2. Missing Knowledge
**Scenario:** Customer asks a valid question (e.g., "Do you ship to Kano?") but the Knowledge Engine has no shipping policy data.
**Recovery:** Admit ignorance, offer human escalation, and flag the knowledge gap for the business.
*Response:* "I actually don't have our shipping details for Kano on hand right now. Let me connect you with a team member who can confirm that for you, or I can take your email and they'll reach out."
*System Action:* Alert logged in Dashboard -> "Knowledge Gap: Shipping Policy".

## 3. Empty Inventory / No Recommendations
**Scenario:** Customer asks for a product that is entirely out of stock, or has a budget that doesn't match anything in the catalog.
**Recovery:** Explain the limitation and offer the closest available alternative.
*Response:* "We don't currently have any running shoes under ₦10,000 in stock. However, our entry-level models start at ₦15,000 and are highly rated. Would you like to see those?"

## 4. LLM API Outage (e.g., OpenAI is down)
**Scenario:** The core language model API is unreachable, meaning conversational generation fails.
**Recovery:** The widget enters "Offline/Asynchronous Mode". 
*Response (Pre-programmed UI):* "Our AI assistant is currently taking a coffee break ☕. Please leave your message and email below, and our human team will reply as soon as possible."

## 5. Hostile / Toxic Users
**Scenario:** Customer uses profanity or abusive language.
**Recovery:** The conversation is terminated locally by the safety filter. 
*Response:* "I am unable to continue this conversation. Please contact support via email if you need further assistance."

---

# System Monitoring & Alerts

Businesses are alerted in the dashboard when:
- Human escalation rate exceeds 15% in a single day.
- A specific product is frequently requested but out of stock.
- A specific knowledge gap is encountered more than 3 times.

---

**Status:** Approved ✅
