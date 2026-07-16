import type { Product, Category, InventoryStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { syncProductEmbedding, deleteEmbedding } from "@/server/knowledge/sync";
import { formatMoney } from "@/server/catalog/money";
import { iconFor } from "@/server/catalog/icons";
import { getOrCreateCategoryByName } from "@/server/catalog/categories";
import { firstImageUrl } from "@/server/retrieval/search";

export { formatMoney, iconFor };

type ProductWithCategory = Product & { category: Category | null };

const STATUS_LABELS: Record<InventoryStatus, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

const LABEL_TO_STATUS: Record<string, InventoryStatus> = {
  "In Stock": "IN_STOCK",
  "Low Stock": "LOW_STOCK",
  "Out of Stock": "OUT_OF_STOCK",
};

function completenessScore(description: string | null | undefined): number {
  if (!description) return 40;
  if (description.length > 120) return 95;
  if (description.length > 50) return 90;
  return 50;
}

/**
 * Embedding sync is best-effort here — a Voyage hiccup shouldn't block
 * catalog management. Worst case the product is briefly unsearchable by
 * the AI until the next successful write.
 */
async function safeSyncProductEmbedding(orgId: string, product: ProductWithCategory) {
  try {
    await syncProductEmbedding(orgId, product);
  } catch (err) {
    console.error("Product embedding sync failed:", err);
  }
}

async function safeDeleteEmbedding(id: string) {
  try {
    await deleteEmbedding("PRODUCT", id);
  } catch (err) {
    console.error("Product embedding delete failed:", err);
  }
}

/**
 * COMPAT presenter — matches the prototype's response shape so existing
 * pages keep working. Phase 1 replaces this with a raw contract + a
 * frontend presenter (see 01-frontend-audit.md).
 */
export function toProductResponse(p: ProductWithCategory) {
  const categoryName = p.category?.name ?? "General";
  const stockStatus = STATUS_LABELS[p.inventoryStatus];
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? "",
    price: formatMoney(p.price, p.currency),
    category: categoryName,
    stockStatus,
    stockClass:
      p.inventoryStatus === "IN_STOCK"
        ? "status-dot-green"
        : p.inventoryStatus === "LOW_STOCK"
          ? "status-dot-gold"
          : "status-dot-red",
    aiCompleteness: completenessScore(p.description),
    icon: iconFor(categoryName),
    imageUrl: firstImageUrl(p.images),
    description: p.description ?? "",
  };
}

export async function listProducts(orgId: string) {
  const products = await prisma.product.findMany({
    where: { orgId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return products.map(toProductResponse);
}

function parsePrice(price: unknown): number {
  const n = Number(String(price).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(400, "Invalid price.");
  }
  return n;
}

export interface ProductInput {
  name: string;
  price: unknown;
  category?: string;
  brand?: string;
  stockStatus?: string;
  description?: string;
  imageUrl?: string;
}

export async function createProduct(orgId: string, input: ProductInput) {
  if (!input.name || input.price === undefined || input.price === "") {
    throw new ApiError(400, "Product name and price are required.");
  }
  const category = await getOrCreateCategoryByName(orgId, input.category);
  const imageUrl = input.imageUrl?.trim();
  const product = await prisma.product.create({
    data: {
      orgId,
      name: input.name,
      price: parsePrice(input.price),
      categoryId: category?.id ?? null,
      brand: input.brand?.trim() || null,
      inventoryStatus: LABEL_TO_STATUS[input.stockStatus ?? ""] ?? "IN_STOCK",
      description: input.description || null,
      images: imageUrl && isHttpUrl(imageUrl) ? [imageUrl] : [],
      source: "MANUAL",
    },
    include: { category: true },
  });
  await safeSyncProductEmbedding(orgId, product);
  return toProductResponse(product);
}

export async function updateProduct(
  orgId: string,
  id: string,
  input: ProductInput
) {
  const existing = await prisma.product.findFirst({ where: { id, orgId } });
  if (!existing) throw new ApiError(404, "Product not found.");

  const category = await getOrCreateCategoryByName(orgId, input.category);
  const trimmedImage = input.imageUrl?.trim();
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      price: parsePrice(input.price),
      ...(category ? { categoryId: category.id } : {}),
      ...(input.brand !== undefined ? { brand: input.brand?.trim() || null } : {}),
      ...(input.stockStatus && LABEL_TO_STATUS[input.stockStatus]
        ? { inventoryStatus: LABEL_TO_STATUS[input.stockStatus] }
        : {}),
      // Only touch images when an imageUrl field was sent: a valid URL sets
      // it, an explicit empty string clears it, undefined leaves it as-is
      // (so editing other fields never wipes a crawled/imported image).
      ...(input.imageUrl !== undefined
        ? { images: trimmedImage && isHttpUrl(trimmedImage) ? [trimmedImage] : [] }
        : {}),
      description: input.description || null,
    },
    include: { category: true },
  });
  await safeSyncProductEmbedding(orgId, product);
  return toProductResponse(product);
}

export async function deleteProduct(orgId: string, id: string) {
  const existing = await prisma.product.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Product not found.");
  await prisma.product.delete({ where: { id } });
  await safeDeleteEmbedding(id);
}

// ─── Bulk import (CSV → products) ──────────────────────────────────────

const MAX_IMPORT_ROWS = 500;

export interface ImportRow {
  name?: string;
  price?: unknown;
  category?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  stockStatus?: string;
}

export interface ImportResult {
  imported: number;
  skipped: Array<{ row: number; name: string; reason: string }>;
  warnings: Array<{ row: number; name: string; reason: string }>;
}

function isHttpUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Bulk-create products from parsed CSV rows. Three-way outcome per row:
 * skipped (hard error — no name or no valid price), imported-with-warning
 * (created anyway, but something's off), or clean import. Never silently
 * drops a row. Reuses createProduct's building blocks (parsePrice,
 * getOrCreateCategoryByName which auto-seeds the category's qualification
 * flow, embedding sync) so imported products are RAG-ready immediately.
 */
export async function importProducts(orgId: string, rows: ImportRow[]): Promise<ImportResult> {
  if (!Array.isArray(rows)) throw new ApiError(400, "Expected an array of product rows.");
  if (rows.length === 0) throw new ApiError(400, "No rows to import.");
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(400, `Too many rows (${rows.length}). Import up to ${MAX_IMPORT_ROWS} at a time.`);
  }

  const result: ImportResult = { imported: 0, skipped: [], warnings: [] };
  // Dedupe by name — the schema has no SKU. Seed with existing catalog names
  // so a re-import doesn't create duplicates of products already in the DB.
  const existing = await prisma.product.findMany({ where: { orgId }, select: { name: true } });
  const seenNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? {};
    const rowNum = i + 1; // 1-based for human-facing reasons
    const name = String(row.name ?? "").trim();

    if (!name) {
      result.skipped.push({ row: rowNum, name: "", reason: "Missing product name." });
      continue;
    }

    let price: number;
    try {
      if (row.price === undefined || row.price === null || String(row.price).trim() === "") {
        throw new ApiError(400, "empty");
      }
      price = parsePrice(row.price);
    } catch {
      result.skipped.push({ row: rowNum, name, reason: "Missing or invalid price." });
      continue;
    }

    // Non-fatal warnings — the row still imports.
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      result.warnings.push({ row: rowNum, name, reason: "Duplicate name (a product with this name already exists)." });
    }
    seenNames.add(key);

    const imageProvided = row.imageUrl !== undefined && String(row.imageUrl).trim() !== "";
    const validImage = imageProvided && isHttpUrl(row.imageUrl);
    if (imageProvided && !validImage) {
      result.warnings.push({ row: rowNum, name, reason: "Image URL isn't a valid http(s) link — skipped the image." });
    }
    const description = String(row.description ?? "").trim();
    if (description.length > 0 && description.length < 20) {
      result.warnings.push({ row: rowNum, name, reason: "Very short description — the AI recommends better with detail." });
    }
    if (!String(row.category ?? "").trim()) {
      result.warnings.push({ row: rowNum, name, reason: "No category — product won't appear in the widget's category grid." });
    }

    const category = await getOrCreateCategoryByName(orgId, row.category);
    const product = await prisma.product.create({
      data: {
        orgId,
        name,
        price,
        categoryId: category?.id ?? null,
        brand: String(row.brand ?? "").trim() || null,
        description: description || null,
        images: validImage ? [String(row.imageUrl).trim()] : [],
        inventoryStatus: LABEL_TO_STATUS[String(row.stockStatus ?? "")] ?? "IN_STOCK",
        source: "IMPORT",
      },
      include: { category: true },
    });
    await safeSyncProductEmbedding(orgId, product);
    result.imported++;
  }

  return result;
}
