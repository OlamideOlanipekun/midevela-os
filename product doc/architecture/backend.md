# Backend Architecture

> **Project:** Midevela
>
> **Document:** Backend Architecture
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Backend Engineering
>
> **Last Updated:** 2026-06-29

---

# Purpose

This document defines the backend architecture of Midevela.

The backend is responsible for orchestrating business logic, AI workflows, integrations, automation, customer interactions, analytics, and event processing.

The backend is API-first, event-driven, and horizontally scalable.

---

# Technology Stack

Language

- TypeScript

Runtime

- Node.js

Framework

- NestJS

API

- REST
- GraphQL (Future)

Validation

- Zod
- class-validator

Authentication

- JWT
- OAuth2

ORM

- Prisma

Scheduler

- BullMQ Scheduler

Message Broker

- Kafka

Cache

- Redis

Storage

- S3 Compatible Object Storage

Search

- Meilisearch

---

# Service Architecture

Backend is organized into modular domains.

```text
Apps

├── API Gateway
├── AI Service
├── Conversation Service
├── Recommendation Service
├── Automation Service
├── Analytics Service
├── Customer Service
├── Product Service
├── Billing Service
├── Notification Service
├── Integration Service
├── Knowledge Service
├── Search Service
└── Identity Service
```

Every service owns its own business logic.

---

# Core Principles

- Domain Driven Design
- Event Driven Communication
- Stateless APIs
- Horizontal Scaling
- Multi-tenancy
- CQRS where appropriate
- Idempotent operations

---

# Request Lifecycle

```text
Client

↓

API Gateway

↓

Authentication

↓

Workspace Resolution

↓

Validation

↓

Business Service

↓

Database

↓

Event Published

↓

Response Returned

↓

Async Workers Execute
```

---

# Authentication

Support

- Email & Password
- Google OAuth
- GitHub OAuth
- Magic Links
- Enterprise SSO

Future

- SAML
- SCIM

---

# Authorization

RBAC (Role-Based Access Control)

Roles include

- Owner
- Admin
- Sales
- Support
- Marketing
- Developer
- Read Only

Policies are enforced at the service layer.

---

# Business Domains

Core domains

- Workspace
- Customer
- Conversation
- Product
- Knowledge
- AI
- Analytics
- Revenue
- Billing
- Automation
- Integration

Each domain owns:

- APIs
- Database models
- Events
- Validation
- Background jobs

---

# File Storage

Used for

- Product images
- PDFs
- Knowledge files
- AI uploads
- User avatars
- Reports

---

# Error Handling

Standard error model

- Validation Error
- Authentication Error
- Authorization Error
- Business Rule Error
- Integration Error
- AI Error
- Infrastructure Error

All errors include

- Code
- Message
- Trace ID
- Timestamp

---

# Observability

Every request includes

- Correlation ID
- Workspace ID
- User ID
- Request ID

Logs are structured.

---

# Performance Targets

API Response

<250ms

Database Query

<50ms

Authentication

<100ms

Webhook Processing

<5 seconds

---

# Future Roadmap

- gRPC internal communication
- Service mesh
- Multi-region deployment
- Event sourcing
- Distributed workflows

---

# Related Documents

- system.md
- api.md
- events.md
- queues.md
- workers.md

---

**Status:** Approved ✅
