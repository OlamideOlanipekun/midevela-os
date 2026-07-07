# Database Architecture

> **Project:** Midevela
>
> **Document:** Database Architecture
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Platform Engineering
>
> **Last Updated:** 2026-06-29

---

# Purpose

This document defines the persistence strategy for Midevela.

The platform uses a polyglot persistence model, selecting the most appropriate database for each workload instead of relying on a single database.

---

# Mission

Store data securely, efficiently, and at scale while supporting real-time AI experiences.

---

# Database Strategy

| Database | Purpose |
|----------|---------|
| PostgreSQL | Primary transactional database |
| Redis | Cache, sessions, queues |
| Vector Database | Semantic search & RAG |
| Meilisearch | Full-text search |
| S3 Object Storage | Files and media |

---

# PostgreSQL Domains

Core tables

- Workspaces
- Users
- Customers
- Products
- Orders
- Conversations
- Messages
- Knowledge
- Automations
- Billing
- Integrations
- Notifications
- Analytics Snapshots

---

# Multi-Tenant Model

Every table includes

```text
workspace_id
```

Tenant isolation is enforced at:

- Application layer
- Database queries
- Authorization policies

Future support

- Row-Level Security (RLS)

---

# Relationships

```text
Workspace

├── Users
├── Products
├── Customers
├── Conversations
├── Automations
├── Integrations
├── Analytics
└── Billing
```

---

# Redis

Stores

- Sessions
- API cache
- Rate limiting
- Real-time presence
- Queue state
- Temporary AI context

TTL is used for ephemeral data.

---

# Vector Database

Stores

- Product embeddings
- FAQ embeddings
- Policy embeddings
- Website embeddings
- Conversation embeddings

Used by the RAG pipeline.

---

# Search Index

Meilisearch indexes

- Products
- Customers
- Conversations
- Knowledge
- Orders

Supports typo tolerance and instant search.

---

# Object Storage

Stores

- Images
- Videos
- Documents
- Reports
- Exports
- AI uploads

---

# Backup Strategy

PostgreSQL

- Daily full backup
- Continuous WAL archiving

Redis

- Periodic snapshots

Object Storage

- Versioning enabled

---

# Disaster Recovery

Recovery Objectives

RPO

<15 minutes

RTO

<1 hour

---

# Data Lifecycle

Active

↓

Archived

↓

Cold Storage

↓

Deletion

Retention policies are configurable.

---

# Encryption

Data at Rest

AES-256

Data in Transit

TLS 1.3

Secrets

Managed through a dedicated secrets manager.

---

# Performance Targets

Read Query

<50ms

Write Query

<100ms

Vector Search

<150ms

Search Query

<100ms

---

# Future Roadmap

- Read replicas
- Partitioning
- Multi-region replication
- Automatic sharding
- Data warehouse integration

---

# Related Documents

- backend.md
- caching.md
- rag.md
- scaling.md

---

**Status:** Approved ✅
