# 01 - Knowledge Engine

> **Project:** Midevela
>
> **Document:** Knowledge Engine
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** AI Platform Team

---

# Purpose

The Knowledge Engine is the foundation of the Business Brain. It is responsible for ingesting, structuring, updating, and retrieving the specific facts, products, and policies of a business. 

Without the Knowledge Engine, the AI is just a generic language model. With it, the AI becomes a company expert.

---

# Core Responsibilities

1. **Data Ingestion:** Connect to data sources (E-commerce platforms, URLs, PDFs, Manual text) and extract text.
2. **Chunking & Processing:** Break down large texts into semantically meaningful chunks.
3. **Embedding Generation:** Convert text chunks into vector embeddings.
4. **Vector Storage:** Store embeddings in the Vector Database (e.g., `pgvector`) alongside metadata.
5. **Semantic Retrieval (RAG):** Find the most relevant chunks based on a customer's query.

---

# The Knowledge Graph

The Engine structures knowledge into specific domains to aid retrieval accuracy:

### 1. Product Catalog
- **Metadata:** SKU, Name, Price, Inventory, Category, Tags.
- **Embeddings:** Generated from product descriptions, specs, and features.
- *Rule:* Products out of stock must be flagged to prevent the AI from recommending them.

### 2. Business Policies
- Shipping rules, return windows, warranties, business hours.
- *Rule:* High-priority retrieval. If a customer asks about returns, this must override generic AI knowledge.

### 3. Sales Playbook / Brand Voice
- Instructions on how to speak (e.g., "Use emojis," "Be formal," "Never mention competitors").

---

# Retrieval Strategy

When a customer asks a question, the Knowledge Engine performs a Hybrid Search:

1. **Semantic Search (Vector):** Finds concepts related to the intent (e.g., query "safe for kids" matches product feature "non-toxic").
2. **Keyword Search (BM25):** Ensures exact matches for SKUs or specific brand names aren't missed by the vector search.
3. **Metadata Filtering:** Hard filters (e.g., `inventory > 0` or `price < 50000`) applied *before* vector search to ensure only valid products are returned.

---

# Auto-Syncing

The Knowledge Engine must stay perfectly in sync with the business's actual catalog.
- Listens to webhooks from e-commerce platforms (e.g., Shopify "Product Updated" event).
- Re-embeds only the changed text.
- Invalidates stale vectors immediately.

---

# Related Documents
- rag.md
- 03-recommendation-engine.md
- website-sync.md

---

**Status:** Approved ✅
