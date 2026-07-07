# Product Import

> **Project:** Midevela
>
> **Document:** Product Import
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

The Product Import system allows businesses to quickly populate Midevela with their catalog from existing commerce platforms, websites, spreadsheets, or manual uploads.

The objective is to reduce onboarding time from days to minutes.

---

# Mission

Make catalog onboarding effortless.

---

# Supported Import Sources

## Website Crawl

Automatically extract:

- Products
- Collections
- Categories
- Pricing
- Images
- Descriptions
- Variants

---

## Ecommerce Platforms

Support integrations with:

- Shopify
- WooCommerce
- Magento
- BigCommerce
- Custom APIs

---

## CSV Import

Supported fields:

- SKU
- Product Name
- Description
- Price
- Inventory
- Brand
- Category
- Images
- Variants

---

## Excel

Supports XLSX uploads.

---

## API Import

Businesses can sync directly from their own backend.

---

## Manual Upload

Products may be created individually.

---

# Import Pipeline

```text
Source
↓
Validate
↓
Normalize
↓
Deduplicate
↓
Enrich
↓
Generate Embeddings
↓
Store
↓
Knowledge Engine
↓
Business Brain
```

---

# Validation

Before import:

✓ Required fields

✓ Duplicate SKUs

✓ Missing images

✓ Invalid prices

✓ Broken URLs

✓ Variant validation

---

# AI Enrichment

After import the AI automatically generates:

- Product summary
- AI search keywords
- Shopping attributes
- Product relationships
- Suggested FAQs
- Buying reasons
- Alternative products

---

# Conflict Resolution

If duplicates exist:

- Merge
- Replace
- Skip
- Manual review

Business chooses the preferred strategy.

---

# Bulk Operations

Supported actions:

- Bulk update
- Bulk delete
- Bulk archive
- Bulk category assignment
- Bulk image replacement

---

# Events

- ImportStarted
- ProductValidated
- ProductImported
- ProductUpdated
- ProductSkipped
- ImportCompleted

---

# Analytics

Track:

- Import duration
- Products imported
- Failed imports
- Duplicate rate
- Catalog completeness

---

# Success Metrics

- Time to first AI-ready catalog
- Import success rate
- Data quality score
- Knowledge coverage
- Business setup time

---

# Future Roadmap

- AI image generation
- Auto attribute extraction
- Manufacturer data lookup
- Duplicate detection across stores
- Multi-store catalog merge

---

# Related Documents

- website-sync.md
- manual-product-manager.md
- 02-ai-engines/01-knowledge-engine.md

---

**Status:** Approved ✅
