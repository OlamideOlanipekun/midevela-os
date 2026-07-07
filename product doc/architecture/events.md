# Event Architecture

> **Project:** Midevela
>
> **Document:** Event Architecture
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

Midevela is built on an event-driven architecture.

Every meaningful action inside the platform produces an immutable event that other services can consume asynchronously.

Events eliminate tight coupling between services and enable scalability.

---

# Event Principles

- Immutable
- Ordered
- Idempotent
- Traceable
- Replayable
- Versioned

---

# Event Flow

```text
User Action

↓

Business Service

↓

Database Commit

↓

Publish Event

↓

Kafka

↓

Subscribers

↓

Workers

↓

Analytics

↓

Notifications

↓

AI Learning
```

---

# Event Structure

```json
{
  "id": "",
  "type": "",
  "version": 1,
  "workspaceId": "",
  "timestamp": "",
  "payload": {},
  "metadata": {}
}
```

---

# Event Categories

Customer

- CustomerCreated
- CustomerUpdated
- CustomerDeleted

---

Conversation

- ConversationStarted
- MessageSent
- ConversationResolved
- HumanTakeoverRequested

---

Product

- ProductCreated
- ProductUpdated
- ProductPublished
- InventoryChanged

---

Knowledge

- KnowledgeUploaded
- KnowledgeIndexed
- KnowledgeUpdated

---

AI

- IntentDetected
- RecommendationGenerated
- ConfidenceCalculated
- MemoryUpdated
- LearningCompleted

---

Automation

- WorkflowCreated
- WorkflowExecuted
- WorkflowFailed

---

Revenue

- CheckoutStarted
- PurchaseCompleted
- RefundIssued

---

Billing

- SubscriptionCreated
- PaymentSucceeded
- PaymentFailed

---

Integration

- IntegrationConnected
- SyncStarted
- SyncCompleted
- SyncFailed

---

Notifications

- NotificationCreated
- NotificationDelivered
- NotificationRead

---

# Event Naming

Pattern

```text
<Resource><Action>

CustomerCreated

OrderCompleted

WorkflowExecuted
```

---

# Delivery

Broker

Kafka

Guarantees

- At Least Once Delivery

Consumers must be idempotent.

---

# Retry Policy

Retry

- 1 minute
- 5 minutes
- 30 minutes

After repeated failures

↓

Dead Letter Queue

---

# Event Replay

Replay supported for

- Analytics rebuilding
- AI retraining
- Bug recovery
- Disaster recovery

---

# Event Versioning

Breaking changes create

```text
v2
```

Old consumers continue processing older versions.

---

# Monitoring

Track

- Event throughput
- Consumer lag
- Retry count
- Dead letters
- Processing latency

---

# Performance Targets

Publish latency

<20ms

Consumer latency

<500ms

Delivery Success

99.99%

---

# Future Roadmap

- Event sourcing
- Cross-region replication
- Event catalog UI
- Schema Registry
- Stream processing

---

# Related Documents

- queues.md
- workers.md
- monitoring.md
- backend.md

---

**Status:** Approved ✅
