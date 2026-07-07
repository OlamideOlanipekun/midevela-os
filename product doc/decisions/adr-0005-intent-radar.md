# ADR-0005: Intent Radar

Status: Accepted

Date: 2026-06-29

---

# Context

Traditional chatbots respond only after customers ask questions.

They cannot distinguish between browsing, researching, comparing products, or preparing to purchase.

Businesses therefore miss valuable sales opportunities.

---

# Decision

Introduce the Intent Radar Engine.

Instead of waiting for explicit requests, the platform continuously estimates customer intent from behavioral signals.

---

# Signals

Behavioral

- Page visits
- Scroll depth
- Time on page
- Product views
- Cart activity
- Checkout abandonment

Conversation

- Questions
- Objections
- Product comparisons
- Buying language
- Urgency

Historical

- Previous purchases
- Returning visits
- Previous conversations

---

# Intent Levels

- Exploring
- Comparing
- Interested
- High Purchase Intent
- Ready to Buy
- Returning Customer
- At Risk

Intent is continuously recalculated.

---

# Benefits

- Better recommendations
- Earlier intervention
- Increased conversions
- Improved automation
- Better sales forecasting

---

# Trade-offs

Requires continuous event processing.

Additional AI inference cost.

---

# Alternatives

Rule-based scoring.

Rejected because customer behavior changes dynamically.

---

# Outcome

Intent Radar becomes the primary decision signal for recommendations, automations, notifications, and sales coaching.

---

**Status:** Accepted
