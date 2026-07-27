import { prisma } from "@/lib/prisma";
import type { ProductItem, ProductDetail, CategoryItem, CatalogAnalytics, CatalogHealthData, SyncJobItem, RankingData } from "./types";

export async function listProducts(params: {
  orgId?: string; search?: string; category?: string; status?: string;
  minPrice?: number; maxPrice?: number; inStock?: string;
  page: number; limit: number;
}): Promise<{ items: ProductItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, search, category, minPrice, maxPrice, inStock, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (orgId) AND.push({ orgId });
  if (category) AND.push({ categoryId: category });
  if (search) AND.push({ name: { contains: search, mode: "insensitive" } });
  if (minPrice !== undefined) AND.push({ price: { gte: minPrice } });
  if (maxPrice !== undefined) AND.push({ price: { lte: maxPrice } });
  if (inStock === "true") AND.push({ inventory: { gt: 0 } });
  if (inStock === "false") AND.push({ inventory: { lte: 0 } });

  const where = AND.length > 0 ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      include: { category: { select: { name: true } } },
    }),
    prisma.product.count({ where: where as any }),
  ]);

  return {
    items: items.map((p) => ({
      ...p,
      categoryName: p.category?.name || null,
      price: Number(p.price),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      costPrice: p.costPrice ? Number(p.costPrice) : null,
      weight: p.weight ? Number(p.weight) : null,
      tags: p.tags as string[],
      attributes: p.attributes as Record<string, unknown>,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      variants: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      recommendationLogs: { select: { score: true, clicked: true, purchased: true } },
    },
  });
  if (!product) return null;

  const logs = product.recommendationLogs;
  const totalRankings = logs.length;
  const avgScore = totalRankings > 0 ? logs.reduce((s, l) => s + Number(l.score), 0) / totalRankings : 0;
  const clickRate = totalRankings > 0 ? (logs.filter((l) => l.clicked).length / totalRankings) * 100 : 0;
  const purchaseRate = totalRankings > 0 ? (logs.filter((l) => l.purchased).length / totalRankings) * 100 : 0;

  return {
    ...product,
    categoryName: product.category?.name || null,
    price: Number(product.price),
    comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
    costPrice: product.costPrice ? Number(product.costPrice) : null,
    weight: product.weight ? Number(product.weight) : null,
    tags: product.tags as string[],
    attributes: product.attributes as Record<string, unknown>,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((v) => ({ ...v, price: v.price ? Number(v.price) : null, comparePrice: v.comparePrice ? Number(v.comparePrice) : null, weight: v.weight ? Number(v.weight) : null, attributes: v.attributes as Record<string, unknown> })),
    images: product.images,
    recommendationStats: { totalRankings, avgScore, clickRate, purchaseRate },
  } as any;
}

export async function listCategories(orgId: string): Promise<CategoryItem[]> {
  const cats = await prisma.productCategory.findMany({
    where: { orgId },
    orderBy: { sortOrder: "asc" },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
  return cats.filter((c) => !c.parentId).map((c) => ({
    ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
    children: c.children.map((ch) => ({ ...ch, createdAt: ch.createdAt.toISOString(), updatedAt: ch.updatedAt.toISOString(), children: [] })),
  })) as any;
}

export async function getCategory(id: string) {
  const cat = await prisma.productCategory.findUnique({
    where: { id },
    include: { parent: true, children: { orderBy: { sortOrder: "asc" } } },
  });
  if (!cat) return null;
  return { ...cat, createdAt: cat.createdAt.toISOString(), updatedAt: cat.updatedAt.toISOString(), children: cat.children.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), children: [] })) };
}

export async function getCatalogAnalytics(orgId?: string): Promise<CatalogAnalytics> {
  const where = orgId ? { orgId } : {};
  const [totalProducts, activeProducts, totalCategories, totalImages, totalVariants, outOfStock, duplicateCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, active: true } as any }),
    prisma.productCategory.count({ where }),
    prisma.productImage.count({ where: { product: orgId ? { orgId } : {} } as any }),
    prisma.productVariant.count({ where: { product: orgId ? { orgId } : {} } as any }),
    prisma.product.count({ where: { ...where, inventory: 0 } as any }),
    0,
  ]);

  return { totalProducts, activeProducts, totalCategories, totalImages, totalVariants, outOfStock, syncQueueStatus: "Healthy", duplicateCount };
}

export async function getCatalogHealth(orgId?: string): Promise<CatalogHealthData> {
  const where = orgId ? { orgId } : {};
  const [totalProducts, activeProducts, missingImages, missingPrices, outOfStock, catalogHealth] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, active: true } as any }),
    prisma.product.count({ where: { ...where, imageCount: 0 } as any }),
    prisma.product.count({ where: { ...where, price: 0 } as any }),
    prisma.product.count({ where: { ...where, inventory: 0 } as any }),
    orgId ? prisma.catalogHealth.findUnique({ where: { orgId } }) : null,
  ]);

  return {
    totalProducts, activeProducts, missingImages, missingPrices,
    missingCategories: 0, duplicateCount: 0, brokenUrls: 0, outOfStock: outOfStock,
    lastChecked: catalogHealth?.lastChecked.toISOString() || new Date().toISOString(),
  };
}

export async function listSyncJobs(params: {
  orgId?: string; status?: string; source?: string; page: number; limit: number;
}): Promise<{ items: SyncJobItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, status, source, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (status) where.status = status;
  if (source) where.source = source;

  const [items, total] = await Promise.all([
    prisma.catalogSyncJob.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.catalogSyncJob.count({ where: where as any }),
  ]);

  return {
    items: items.map((j) => ({
      ...j, errors: j.errors as Record<string, unknown>[],
      startedAt: j.startedAt?.toISOString() || null,
      completedAt: j.completedAt?.toISOString() || null,
      createdAt: j.createdAt.toISOString(),
    })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function getRecommendationRanking(params: { orgId?: string; productId?: string; limit?: number }): Promise<RankingData[]> {
  const { orgId, productId } = params;
  const where: Record<string, unknown> = {};
  if (orgId) where.orgId = orgId;
  if (productId) where.productId = productId;

  const logs = await prisma.recommendationLog.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true } } },
  });

  const grouped: Record<string, RankingData> = {};
  for (const log of logs) {
    const key = log.productId;
    if (!grouped[key]) {
      grouped[key] = {
        productName: log.product.name,
        productId: log.productId,
        rankings: [],
        avgRank: 0,
        avgConfidence: 0,
      };
    }
    grouped[key].rankings.push({
      rank: log.rank,
      similarity: log.similarity ? Number(log.similarity) : null,
      popularity: log.popularity ? Number(log.popularity) : null,
      salesScore: log.salesScore ? Number(log.salesScore) : null,
      confidence: log.confidence ? Number(log.confidence) : null,
      clicked: log.clicked,
      purchased: log.purchased,
    });
  }

  return Object.values(grouped).map((g) => {
    const n = g.rankings.length;
    return {
      ...g,
      avgRank: n > 0 ? g.rankings.reduce((s, r) => s + r.rank, 0) / n : 0,
      avgConfidence: n > 0 ? g.rankings.reduce((s, r) => s + (r.confidence || 0), 0) / n : 0,
    };
  });
}

export async function getProductSearch(params: { orgId: string; query: string; limit?: number }): Promise<ProductItem[]> {
  const { orgId, query, limit = 20 } = params;
  const products = await prisma.product.findMany({
    where: {
      orgId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  return products.map((p) => ({
    ...p, categoryName: p.category?.name || null,
    price: Number(p.price), comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
    costPrice: p.costPrice ? Number(p.costPrice) : null, weight: p.weight ? Number(p.weight) : null,
    tags: p.tags as string[], attributes: p.attributes as Record<string, unknown>,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  })) as any;
}

export async function triggerSync(orgId: string, source: string) {
  return prisma.catalogSyncJob.create({
    data: { orgId, source: source as any, status: "PENDING" },
  });
}
