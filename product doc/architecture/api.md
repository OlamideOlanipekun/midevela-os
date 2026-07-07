# API Architecture

> **Project:** Midevela
>
> **Document:** API Architecture
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Platform API Team
>
> **Last Updated:** 2026-06-29

---

# Purpose

The API is the single entry point into Midevela.

Every dashboard request, widget interaction, AI conversation, automation, and third-party integration communicates through standardized APIs.

The API must remain stable, versioned, secure, and developer-friendly.

---

# API Principles

- API First
- Resource Oriented
- Versioned
- Predictable
- Idempotent
- Stateless
- Secure by Default
- Consistent Response Format

---

# Protocols

Supported

- REST
- WebSocket
- Webhooks

Future

- GraphQL
- gRPC

---

# Base URL

```text
https://api.midevela.com/v1
```

---

# Authentication

Supported

- JWT
- OAuth2
- API Keys
- Personal Access Tokens

Enterprise

- SAML
- SCIM

---

# Headers

Required

```text
Authorization: Bearer <token>

X-Workspace-ID

X-Request-ID

Content-Type: application/json
```

---

# API Versioning

```text
/v1

/v2

/v3
```

Older versions remain supported during migration windows.

---

# Response Format

Success

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": ""
}
```

Failure

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product does not exist"
  },
  "requestId": ""
}
```

---

# API Domains

Authentication

```text
/auth/*
```

Workspace

```text
/workspaces/*
```

Products

```text
/products/*
```

Customers

```text
/customers/*
```

Conversations

```text
/conversations/*
```

Knowledge

```text
/knowledge/*
```

Automations

```text
/automations/*
```

Analytics

```text
/analytics/*
```

Revenue

```text
/revenue/*
```

Notifications

```text
/notifications/*
```

Billing

```text
/billing/*
```

Integrations

```text
/integrations/*
```

---

# Pagination

Cursor-based pagination

```text
nextCursor

previousCursor

limit
```

---

# Filtering

Support

- Search
- Sort
- Filters
- Date Ranges
- Status
- Tags

---

# Rate Limiting

Default

100 requests/minute

Enterprise

Configurable

Headers returned

```text
X-RateLimit-Limit

X-RateLimit-Remaining

Retry-After
```

---

# Webhooks

Businesses subscribe to events.

Examples

- customer.created
- order.completed
- payment.failed
- conversation.started
- automation.executed

Webhook delivery includes

- Retries
- Signatures
- Idempotency Keys

---

# SDKs

Official SDKs

- JavaScript
- TypeScript
- Python
- PHP

Future

- Go
- Java
- C#

---

# API Documentation

Generated automatically from OpenAPI.

Provides

- Interactive Playground
- Authentication Guide
- Examples
- SDK Generation

---

# Performance Targets

P95 latency

<250ms

Availability

99.9%

---

# Future Roadmap

- GraphQL API
- Streaming APIs
- AI Function Calling API
- Public Marketplace APIs

---

# Related Documents

- backend.md
- integrations.md
- security.md

---

**Status:** Approved ✅
