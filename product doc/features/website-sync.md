# Website Sync

> **Project:** Midevela
>
> **Document:** Website Sync
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Platform Team
>
> **Last Updated:** 2026-06-29

---

# Purpose

Website Sync continuously synchronizes a business website with Midevela to ensure AI recommendations always reflect the latest business information.

Synchronization happens automatically without requiring manual re-imports.

---

# Mission

Keep the Business Brain synchronized with the business.

---

# Synchronization Scope

The sync engine monitors:

- Products
- Prices
- Inventory
- Categories
- Images
- Collections
- Policies
- FAQs
- Blog posts
- Landing pages

---

# Sync Triggers

Synchronization occurs when:

- Product updated
- Product created
- Product deleted
- Price changes
- Inventory changes
- Policy updated
- Website crawl scheduled

---

# Synchronization Flow

```text
Detect Change
↓
Fetch Updated Data
↓
Validate
↓
Compare Previous Version
↓
Update Knowledge
↓
Refresh Embeddings
↓
Notify Business Brain
↓
Update AI
```

No retraining is required.

---

# Sync Methods

Supported methods:

- Webhooks
- Scheduled Crawls
- REST API
- GraphQL
- Manual Sync
- Incremental Sync

---

# Change Detection

The system detects:

- New products
- Deleted products
- Price changes
- Inventory changes
- Metadata changes
- Image updates

Only changed data is synchronized.

---

# AI Refresh

Whenever knowledge changes:

- Recommendations update
- Search updates
- FAQs refresh
- Conversation knowledge refreshes
- Product rankings recalculate

Customers always receive current information.

---

# Failure Recovery

If synchronization fails:

- Retry automatically
- Log failure
- Notify business
- Preserve previous version
- Resume from checkpoint

---

# Version History

Each sync stores:

- Timestamp
- Changed fields
- Previous values
- Source
- Status

Businesses can review or roll back changes.

---

# Events

- SyncStarted
- SyncCompleted
- ProductChanged
- InventoryChanged
- PriceChanged
- SyncFailed

---

# Analytics

Businesses can monitor:

- Last successful sync
- Sync duration
- Changed products
- Failed updates
- AI refresh time

---

# Success Metrics

- Sync accuracy
- Sync latency
- AI freshness score
- Update success rate
- Recovery success rate

---

# Future Roadmap

- Near real-time synchronization
- Multi-store synchronization
- Marketplace synchronization
- ERP integration
- PIM integration

---

# Related Documents

- product-import.md
- integrations.md
- 02-ai-engines/01-knowledge-engine.md

---

**Status:** Approved ✅
