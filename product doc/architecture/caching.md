# Caching Architecture

> **Project:** Midevela
>
> **Document:** Caching Architecture
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

Caching reduces latency, minimizes infrastructure costs, and protects backend services from unnecessary load.

Midevela uses multi-layer caching to accelerate dashboard requests, AI workflows, product retrieval, analytics, and customer conversations.

---

# Mission

Deliver sub-second experiences while maintaining data consistency.

---

# Cache Layers

```text
Browser Cache

↓

CDN Cache

↓

API Cache

↓

Redis Cache

↓

Database
```

Each layer serves a different purpose.

---

# Technology

Primary Cache

- Redis

Edge Cache

- CDN

Application Cache

- In-memory

Future

- Distributed regional cache

---

# Cache Categories

## Session Cache

Stores

- Login sessions
- Access tokens
- Refresh tokens
- Workspace context

TTL

15–60 minutes

---

## API Cache

Caches

- Dashboard metrics
- Products
- Categories
- Business settings

TTL

30 seconds–10 minutes

---

## AI Cache

Stores

- Frequently requested prompts
- Recommendation results
- Embeddings metadata
- Conversation summaries

Avoids repeated LLM requests.

---

## Search Cache

Stores

- Popular searches
- Filter combinations
- Search suggestions

---

## Analytics Cache

Caches

- KPIs
- Revenue totals
- Funnel metrics
- Conversion charts

Reduces expensive aggregations.

---

## Integration Cache

Stores

- OAuth tokens
- Integration metadata
- Remote configuration

---

# Cache Keys

Examples

```text
workspace:{id}

customer:{id}

product:{id}

dashboard:{workspace}

analytics:{workspace}:{date}

conversation:{id}
```

Keys are namespaced by workspace.

---

# Cache Invalidation

Triggered by

- Product updates
- Customer updates
- Knowledge changes
- New orders
- Configuration changes
- AI learning events

Stale data should never persist after business-critical updates.

---

# Cache Policies

Read

Cache-first

Write

Database-first → Cache update

Delete

Database → Cache eviction

---

# Performance Targets

Cache Hit Rate

>95%

Redis Response

<5ms

Dashboard Cache Refresh

<1 second

---

# Monitoring

Track

- Hit rate
- Miss rate
- Evictions
- Memory usage
- Expired keys
- Latency

---

# Failure Strategy

If Redis becomes unavailable

↓

Read directly from database

↓

Continue serving traffic

↓

Rebuild cache automatically

---

# Future Roadmap

- Intelligent cache warming
- Predictive prefetching
- Regional edge caching
- AI-driven cache optimization

---

# Related Documents

- database.md
- deployment.md
- scaling.md

---

**Status:** Approved ✅
