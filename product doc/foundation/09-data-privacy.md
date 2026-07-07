# Data Privacy & Compliance

> **Project:** Midevela
>
> **Document:** Data Privacy & Compliance
>
> **Version:** 1.0.0
>
> **Status:** Draft 📝
>
> **Owner:** Legal / Platform Team
>
> **Last Updated:** 2026-06-30

---

# Purpose

Midevela acts as a critical intelligence layer between businesses and their customers. Because the platform collects behavioral signals, stores conversation histories, and builds customer profiles, **data privacy is not a feature—it is a foundational requirement.**

This document outlines our compliance framework, data handling principles, and privacy-by-design architecture, ensuring compliance with global and regional data protection laws (including NDPR and GDPR).

---

# Core Privacy Principles

1. **The Business Owns the Data:** Midevela acts as a *Data Processor*. The business using Midevela is the *Data Controller*. We do not sell customer data, nor do we cross-pollinate raw customer PII across different businesses.
2. **Minimal Data Collection:** We collect only the data necessary to provide the "Buying Confidence" and recommendation features.
3. **Transparent Consent:** Visitors must be informed that they are interacting with an AI and that their data is being used to improve their shopping experience.
4. **Right to Forget:** Customers and businesses can request complete deletion of their data at any time.

---

# Regulatory Compliance

## NDPR (Nigerian Data Protection Regulation)
As Midevela will serve African and Nigerian businesses, NDPR compliance is mandatory:
- Lawful processing of data based on explicit consent.
- Data localization considerations (if strictly required for certain enterprise clients).
- Proper documentation of data processing activities.

## GDPR (General Data Protection Regulation)
To support global businesses and EU visitors:
- **Cookie Consent:** The Midevela widget respects the host website's consent management platform (CMP). Tracking (Intent Radar, Mouse movement) only activates upon cookie acceptance.
- **DSR (Data Subject Requests):** Automated API endpoints for handling "Right to Access" and "Right to Erasure" requests.

---

# What Data Do We Collect?

### 1. Behavioral Data (Intent Engine)
- Page views, scroll depth, time on page, products viewed, cart additions.
- *Anonymized until a conversation starts or the user logs in.*

### 2. Conversational Data (Conversation Engine)
- Chat transcripts, questions asked, objections raised, preferences stated.

### 3. Customer PII (Customer Memory)
- Name, email, phone number, shipping address (if collected during checkout assistance).
- External IDs (e.g., Shopify Customer ID, WhatsApp Number).

---

# Security & Data Storage

- **Encryption at Rest:** All databases (PostgreSQL, Vector DB) are encrypted at rest using AES-256.
- **Encryption in Transit:** All data moving between the widget, APIs, and databases uses TLS 1.3.
- **PII Redaction:** Sensitive information (like credit card numbers inadvertently typed in chat) must be redacted *before* being sent to external LLMs (e.g., OpenAI).

---

# LLM Privacy & Third-Party Sharing

Midevela uses external Large Language Models (e.g., OpenAI). To maintain privacy:
1. **Zero Data Retention Agreements:** We only use enterprise API tiers where the LLM provider explicitly guarantees they do **not** use our data to train their models.
2. **Context Window Sanitization:** We do not send unnecessary PII in the prompt context window.

---

# User Consent Flow (Widget)

1. **Passive state:** Widget tracks anonymous session data.
2. **Active state (First Interaction):** A small disclaimer is shown: *"I am an AI assistant. I use our conversation to recommend the best products for you. [Learn More]"*
3. **Lead Capture state:** Before collecting an email or WhatsApp number, explicit opt-in is required.

---

# Related Documents
- 05-customer-memory.md
- ai.md
- system.md

---

**Status:** Draft 📝
