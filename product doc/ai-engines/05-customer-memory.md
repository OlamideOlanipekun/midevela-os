# 05 - Customer Memory

> **Project:** Midevela
>
> **Document:** Customer Memory
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

Customer Memory is the system responsible for ensuring that a customer is never treated like a stranger twice. It tracks identity, preferences, and conversational context across all touchpoints (Website, WhatsApp, Instagram, etc.).

This is the technical foundation of Midevela's Omnichannel strategy.

---

# Core Responsibilities

1. **Identity Resolution:** Merge anonymous sessions with known profiles when a user authenticates or provides identifying info (e.g., an email address).
2. **Context Persistence:** Store the state of ongoing conversations so they can be resumed later or on a different device.
3. **Preference Extraction:** Identify and save stated preferences (e.g., "I have sensitive skin") without the customer explicitly filling out a form.

---

# Identity Resolution Strategy

Because customers use multiple channels, the system must carefully link profiles:

- **Primary Keys:** Email Address, Phone Number (WhatsApp).
- **Secondary Keys:** Browser Cookies / Session IDs.

*Algorithm:*
1. Anonymous user browses the website (Session ID: A).
2. User provides their phone number to get a discount code.
3. System checks if Phone Number exists.
4. If yes, Session A is merged into the existing Customer Profile.
5. If the user later texts the business on WhatsApp using that same phone number, the AI instantly loads the context from Session A.

---

# Extracted Preferences

The Conversation Engine passes messages to the Memory system. If the user states a hard preference, it is extracted and saved as a structured tag.

*Conversation:* "Do you have this in blue? I only wear blue."
*Extracted Memory:* `preference_color: blue`

Future recommendations will automatically bias toward this preference.

---

# Related Documents
- 08-omnichannel.md
- 07-social-commerce.md

---

**Status:** Approved ✅
