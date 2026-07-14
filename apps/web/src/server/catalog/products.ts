import type { Product, Category, InventoryStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { syncProductEmbedding, deleteEmbedding } from "@/server/knowledge/sync";
import { formatMoney } from "@/server/catalog/money";
import { iconFor } from "@/server/catalog/icons";
import { getOrCreateCategoryByName } from "@/server/catalog/categories";

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
}

export async function createProduct(orgId: string, input: ProductInput) {
  if (!input.name || input.price === undefined || input.price === "") {
    throw new ApiError(400, "Product name and price are required.");
  }
  const category = await getOrCreateCategoryByName(orgId, input.category);
  const product = await prisma.product.create({
    data: {
      orgId,
      name: input.name,
      price: parsePrice(input.price),
      categoryId: category?.id ?? null,
      brand: input.brand?.trim() || null,
      inventoryStatus: LABEL_TO_STATUS[input.stockStatus ?? ""] ?? "IN_STOCK",
      description: input.description || null,
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
