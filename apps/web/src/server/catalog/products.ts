import type { Prisma, Product, Category, InventoryStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";

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

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
};

export function formatMoney(amount: Prisma.Decimal | number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Number(amount).toLocaleString()}`;
}

function completenessScore(description: string | null | undefined): number {
  if (!description) return 40;
  if (description.length > 120) return 95;
  if (description.length > 50) return 90;
  return 50;
}

function iconFor(categoryName: string): string {
  const c = categoryName.toLowerCase();
  if (c.includes("fashion") || c.includes("apparel")) return "🛍️";
  if (c.includes("beauty") || c.includes("cosmetic")) return "🧴";
  if (c.includes("electronic")) return "💻";
  return "📦";
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

async function resolveCategory(orgId: string, name?: string) {
  if (!name?.trim()) return null;
  return prisma.category.upsert({
    where: { orgId_name: { orgId, name: name.trim() } },
    update: {},
    create: { orgId, name: name.trim() },
  });
}

export interface ProductInput {
  name: string;
  price: unknown;
  category?: string;
  stockStatus?: string;
  description?: string;
}

export async function createProduct(orgId: string, input: ProductInput) {
  if (!input.name || input.price === undefined || input.price === "") {
    throw new ApiError(400, "Product name and price are required.");
  }
  const category = await resolveCategory(orgId, input.category);
  const product = await prisma.product.create({
    data: {
      orgId,
      name: input.name,
      price: parsePrice(input.price),
      categoryId: category?.id ?? null,
      inventoryStatus: LABEL_TO_STATUS[input.stockStatus ?? ""] ?? "IN_STOCK",
      description: input.description || null,
      source: "MANUAL",
    },
    include: { category: true },
  });
  return toProductResponse(product);
}

export async function updateProduct(
  orgId: string,
  id: string,
  input: ProductInput
) {
  const existing = await prisma.product.findFirst({ where: { id, orgId } });
  if (!existing) throw new ApiError(404, "Product not found.");

  const category = await resolveCategory(orgId, input.category);
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      price: parsePrice(input.price),
      ...(category ? { categoryId: category.id } : {}),
      ...(input.stockStatus && LABEL_TO_STATUS[input.stockStatus]
        ? { inventoryStatus: LABEL_TO_STATUS[input.stockStatus] }
        : {}),
      description: input.description || null,
    },
    include: { category: true },
  });
  return toProductResponse(product);
}

export async function deleteProduct(orgId: string, id: string) {
  const existing = await prisma.product.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Product not found.");
  await prisma.product.delete({ where: { id } });
}
