import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auth/audit";
import { normalizeDomain, extractDomain } from "./normalizer";
import type {
  WebsiteListItem, WebsiteListResponse, WebsiteDetail, WebsiteHealthScore,
  CrawlJobItem, WebsiteHealthData, WebsiteAnalyticsData,
} from "./types";
import type { Prisma } from "@prisma/client";

function calcHealthScore(w: {
  sslStatus: string; robotsStatus: string; healthScore: number;
  crawlStatus: string; status: string;
  products?: number; knowledgeEntries?: number;
}): WebsiteHealthScore {
  const ssl = w.sslStatus === "valid" ? 100 : w.sslStatus === "unknown" ? 50 : 0;
  const crawler = w.crawlStatus === "READY" ? 100 : w.crawlStatus === "INDEXING" ? 80 : w.crawlStatus === "CRAWLING" ? 60 : w.crawlStatus === "FAILED" ? 20 : 10;
  const kc = w.knowledgeEntries ?? 0;
  const pc = w.products ?? 0;
  const knowledge = kc > 10 ? 100 : kc > 3 ? 70 : kc > 0 ? 40 : 0;
  const products = pc > 100 ? 100 : pc > 30 ? 80 : pc > 5 ? 50 : 20;
  const availability = w.status === "ACTIVE" ? 100 : w.status === "INACTIVE" ? 50 : 0;
  const score = Math.round([ssl, crawler, knowledge, products, availability].reduce((a, b) => a + b, 0) / 5);
  const label = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 55 ? "Fair" : "Needs attention";
  return { score, label, ssl, crawler, knowledge, products, availability };
}

interface SearchParams {
  search?: string;
  status?: string;
  health?: string;
  crawler?: string;
  merchant?: string;
  ssl?: string;
  page: number;
  limit: number;
}

export async function listWebsites(params: SearchParams): Promise<WebsiteListResponse> {
  const { search, status, health, crawler, merchant, ssl, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Prisma.WebsiteRegistryWhereInput = {};
  const AND: Prisma.WebsiteRegistryWhereInput[] = [];

  if (search) {
    AND.push({
      OR: [
        { domain: { contains: search, mode: "insensitive" } },
        { normalizedUrl: { contains: search, mode: "insensitive" } },
        { org: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (status) AND.push({ status: status as any });
  if (crawler) AND.push({ crawlStatus: crawler as any });
  if (ssl) AND.push({ sslStatus: ssl });
  if (merchant) AND.push({ orgId: merchant });
  if (AND.length > 0) where.AND = AND;

  const [items, total] = await Promise.all([
    prisma.websiteRegistry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        org: { select: { id: true, name: true } },
      },
    }),
    prisma.websiteRegistry.count({ where }),
  ]);

  const list: WebsiteListItem[] = items.map((w) => ({
    id: w.id,
    domain: w.domain,
    normalizedUrl: w.normalizedUrl,
    merchantName: w.org.name,
    merchantId: w.org.id,
    health: w.healthScore,
    crawlStatus: w.crawlStatus,
    products: 0,
    pages: 0,
    sslStatus: w.sslStatus,
    status: w.status,
    verified: w.verified,
    createdAt: w.createdAt.toISOString(),
  }));

  return { items: list, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getWebsiteDetail(id: string): Promise<WebsiteDetail> {
  const w = await prisma.websiteRegistry.findUnique({
    where: { id },
    include: {
      org: { select: { id: true, name: true, slug: true } },
      crawlJobs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!w) throw new Error("Website not found");

  const health = calcHealthScore(w);
  const recentCrawls: CrawlJobItem[] = w.crawlJobs.map((c) => ({
    id: c.id, status: c.status,
    pagesFound: c.pagesFound, productsFound: c.productsFound,
    categoriesFound: c.categoriesFound, errors: c.errors, duration: c.duration,
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    id: w.id, domain: w.domain, normalizedUrl: w.normalizedUrl,
    status: w.status, verified: w.verified,
    verificationMethod: w.verificationMethod,
    sslStatus: w.sslStatus, robotsStatus: w.robotsStatus,
    healthScore: w.healthScore, health,
    crawlStatus: w.crawlStatus,
    lastCrawledAt: w.lastCrawledAt?.toISOString() ?? null,
    nextCrawlAt: w.nextCrawlAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString(),
    merchant: { id: w.org.id, name: w.org.name, slug: w.org.slug },
    products: 0,
    knowledgeEntries: 0,
    recentCrawls,
  };
}

export async function checkDuplicate(normalizedUrl: string, excludeId?: string): Promise<{ exists: boolean; owner?: string; status?: string }> {
  const existing = await prisma.websiteRegistry.findUnique({ where: { normalizedUrl } });
  if (!existing) return { exists: false };
  if (excludeId && existing.id === excludeId) return { exists: false };
  const org = await prisma.organization.findUnique({ where: { id: existing.orgId }, select: { name: true } });
  return { exists: true, owner: org?.name, status: existing.status };
}

export async function verifyWebsite(id: string, adminId: string): Promise<WebsiteDetail> {
  const w = await prisma.websiteRegistry.update({
    where: { id }, data: { verified: true, verificationMethod: "admin" },
  });
  await logAudit(adminId, "website_verified", "website", id);
  return getWebsiteDetail(id);
}

export async function recrawlWebsite(id: string, adminId: string): Promise<CrawlJobItem> {
  const w = await prisma.websiteRegistry.findUnique({ where: { id }, select: { id: true, crawlStatus: true } });
  if (!w) throw new Error("Website not found");
  if (w.crawlStatus === "CRAWLING") throw new Error("A crawl is already in progress");

  await prisma.websiteRegistry.update({ where: { id }, data: { crawlStatus: "CRAWLING" } });

  const job = await prisma.crawlJob.create({
    data: { websiteId: id, status: "RUNNING", startedAt: new Date() },
  });

  await logAudit(adminId, "crawler_started", "website", id);

  return {
    id: job.id, status: job.status,
    pagesFound: 0, productsFound: 0, categoriesFound: 0,
    errors: 0, duration: 0,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: null, createdAt: job.createdAt.toISOString(),
  };
}

export async function suspendWebsite(id: string, adminId: string, reason?: string): Promise<void> {
  await prisma.websiteRegistry.update({ where: { id }, data: { status: "SUSPENDED" } });
  await logAudit(adminId, "website_suspended", "website", id, { reason });
}

export async function reactivateWebsite(id: string, adminId: string): Promise<void> {
  await prisma.websiteRegistry.update({ where: { id }, data: { status: "ACTIVE" } });
  await logAudit(adminId, "website_reactivated", "website", id);
}

export async function deleteWebsite(id: string, adminId: string): Promise<void> {
  await prisma.websiteRegistry.update({ where: { id }, data: { status: "DELETED" } });
  await logAudit(adminId, "website_deleted", "website", id);
}

export async function transferWebsite(id: string, newOrgId: string, adminId: string): Promise<void> {
  const w = await prisma.websiteRegistry.findUnique({ where: { id }, select: { normalizedUrl: true } });
  if (!w) throw new Error("Website not found");

  const dup = await checkDuplicate(w.normalizedUrl);
  if (dup.exists) throw new Error(`Domain ${w.normalizedUrl} already belongs to another merchant`);

  await prisma.websiteRegistry.update({ where: { id }, data: { orgId: newOrgId } });
  await logAudit(adminId, "ownership_transferred", "website", id, { newOrgId });
}

export async function getCrawlHistory(id: string, limit = 20): Promise<CrawlJobItem[]> {
  const jobs = await prisma.crawlJob.findMany({
    where: { websiteId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return jobs.map((c) => ({
    id: c.id, status: c.status,
    pagesFound: c.pagesFound, productsFound: c.productsFound,
    categoriesFound: c.categoriesFound, errors: c.errors, duration: c.duration,
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function getHealthData(id: string): Promise<WebsiteHealthData | null> {
  const h = await prisma.websiteHealth.findFirst({
    where: { websiteId: id },
    orderBy: { lastChecked: "desc" },
  });
  if (!h) return null;
  return {
    uptime: h.uptime, ssl: h.ssl, robots: h.robots,
    responseTime: h.responseTime, pages: h.pages,
    products: h.products, knowledge: h.knowledge,
    lastChecked: h.lastChecked.toISOString(),
  };
}

export async function getAnalytics(id: string): Promise<WebsiteAnalyticsData> {
  return {
    productsGrowth: [],
    pagesIndexed: [],
    crawlTimes: [],
    errors: [],
    knowledgeGrowth: [],
  };
}

export async function addWebsite(
  orgId: string, url: string, adminId: string
): Promise<WebsiteDetail> {
  const normalizedUrl = normalizeDomain(url);
  const domain = extractDomain(url);

  const dup = await checkDuplicate(normalizedUrl);
  if (dup.exists) {
    throw new Error(`Domain ${normalizedUrl} is already registered${dup.owner ? ` by ${dup.owner}` : ""}`);
  }

  const w = await prisma.websiteRegistry.create({
    data: {
      orgId,
      domain,
      normalizedUrl,
      status: "ACTIVE",
      sslStatus: "unknown",
      robotsStatus: "unknown",
    },
  });

  await logAudit(adminId, "website_created", "website", w.id, { url: normalizedUrl, orgId });

  return getWebsiteDetail(w.id);
}
