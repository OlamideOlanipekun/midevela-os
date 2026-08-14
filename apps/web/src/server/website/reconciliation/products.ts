import prisma from "@/lib/prisma";
import type { ExtractedProduct } from "@/server/website/extraction/product";
import { normalizeCurrencyCode } from "@/server/catalog/money";
import { syncProductEmbedding, deleteEmbedding } from "@/server/knowledge/sync";
import { getPlanCaps, remainingBudget } from "@/server/billing/caps";
import { getOrCreateCategoryByName } from "@/server/catalog/categories";
import { createHash } from "crypto";
import type { InventoryStatus } from "@prisma/client";

export interface ProductReconcileResult {
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

function mapAvailability(avail?: string): InventoryStatus {
  if (!avail) return "IN_STOCK";
  if (/outofstock|soldout|discontinued/i.test(avail)) return "OUT_OF_STOCK";
  if (/limited|lowstock|fewleft/i.test(avail)) return "LOW_STOCK";
  return "IN_STOCK";
}

function hashProduct(p: ExtractedProduct): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        name: p.name,
        description: p.description,
        price: Number.isFinite(p.price ?? NaN) ? p.price : null,
        compareAtPrice: p.compareAtPrice ?? null,
        currency: p.currency,
        brand: p.brand ?? null,
        sku: p.sku ?? null,
        images: p.images,
        availability: p.availability ?? null,
        variants: p.variants ?? [],
      })
    )
    .digest("hex");
}

function hashStored(cur: {
  name: string;
  description: string | null;
  price: { toString(): string };
  brand: string | null;
  images: unknown;
  attributes: unknown;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        name: cur.name,
        description: cur.description ?? "",
        price: Number(cur.price),
        brand: cur.brand ?? null,
        images: cur.images,
        attributes: cur.attributes,
      })
    )
    .digest("hex");
}

export async function reconcileProducts(
  orgId: string,
  products: ExtractedProduct[]
): Promise<ProductReconcileResult> {
  const result: ProductReconcileResult = { created: 0, updated: 0, unchanged: 0, total: products.length };
  if (products.length === 0) return result;

  const { productCap } = await getPlanCaps(orgId);
  const existingCount = await prisma.product.count({ where: { orgId } });
  let budget = remainingBudget(existingCount, productCap);
  const unlimited = budget === Infinity;

  const seen = new Set<string>();
  for (const p of products) {
    const sourceUrl = p.sourceUrl || p.canonicalUrl;
    const key = sourceUrl || p.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const existing = sourceUrl
      ? await prisma.product.findFirst({ where: { orgId, sourceUrl }, select: { id: true } })
      : null;

    const images: string[] = p.images.slice(0, 8);
    const price = Number.isFinite(p.price ?? NaN) && (p.price ?? 0) > 0 ? p.price! : 0;
    const description = p.description?.trim() || null;
    const name = p.name.trim().slice(0, 500);
    const brand = p.brand?.trim() || null;
    const inventoryStatus = mapAvailability(p.availability);

    const attributes = {
      sku: p.sku || p.externalId || null,
      compareAtPrice: Number.isFinite(p.compareAtPrice ?? NaN) ? p.compareAtPrice : null,
      availability: p.availability || "InStock",
      size: p.size || [],
      color: p.color || [],
      variants: p.variants || [],
      category: p.category || null,
      sourceUrl: sourceUrl || null,
    };

    const category = p.category ? await getOrCreateCategoryByName(orgId, p.category) : null;

    if (existing) {
      const cur = await prisma.product.findUnique({
        where: { id: existing.id },
        select: { name: true, description: true, price: true, brand: true, images: true, attributes: true },
      });
      const currentHash = cur ? hashStored(cur) : "";
      const newHash = hashStored({
        name,
        description,
        price: price.toFixed(2),
        brand,
        images,
        attributes,
      });

      if (cur && currentHash === newHash) {
        result.unchanged++;
        continue;
      }

      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          description,
          price,
          brand,
          images: images as unknown as string[],
          attributes: attributes as unknown as object,
          inventoryStatus,
          sourceUrl: sourceUrl || null,
          ...(category ? { categoryId: category.id } : {}),
        },
        include: { category: true },
      });

      try {
        await syncProductEmbedding(orgId, updated);
      } catch (err) {
        console.error("[reconcile] re-embed failed for updated product", updated.id, err);
      }

      result.updated++;
      continue;
    }

    if (!unlimited) {
      if (budget <= 0) continue;
      budget--;
    }

    const created = await prisma.product.create({
      data: {
        orgId,
        name,
        description,
        price,
        currency: normalizeCurrencyCode(p.currency) ?? "NGN",
        brand,
        categoryId: category?.id ?? null,
        images: images as unknown as string[],
        attributes: attributes as unknown as object,
        source: "CRAWL",
        inventoryStatus,
        sourceUrl: sourceUrl || null,
      },
      include: { category: true },
    });

    try {
      await syncProductEmbedding(orgId, created);
    } catch (err) {
      console.error("[reconcile] embedding failed for", created.id, err);
    }

    result.created++;
  }

  return result;
}

/**
 * Handle stale/deleted products — products previously crawled for this org
 * that were NOT observed in the latest completed crawl.
 * Updates inventoryStatus to OUT_OF_STOCK and purges vector embeddings so
 * RAG never recommends unlisted or removed items.
 */
export async function reconcileStaleProducts(
  orgId: string,
  activeSourceUrls: string[]
): Promise<number> {
  if (activeSourceUrls.length === 0) return 0;

  const staleProducts = await prisma.product.findMany({
    where: {
      orgId,
      source: "CRAWL",
      sourceUrl: { notIn: activeSourceUrls },
      inventoryStatus: { not: "OUT_OF_STOCK" },
    },
    select: { id: true },
  });

  if (staleProducts.length === 0) return 0;

  const staleIds = staleProducts.map((p) => p.id);

  await prisma.product.updateMany({
    where: { id: { in: staleIds } },
    data: { inventoryStatus: "OUT_OF_STOCK" },
  });

  for (const id of staleIds) {
    try {
      await deleteEmbedding("PRODUCT", id);
    } catch (err) {
      console.error("[staleCleanup] failed to purge embedding for product", id, err);
    }
  }

  return staleProducts.length;
}