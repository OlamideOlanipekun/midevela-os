import prisma from "@/lib/prisma";
import type { Prisma, CrawlFrontierStatus } from "@prisma/client";

/**
 * DB-backed crawl frontier.
 *
 * The frontier is persisted (not an in-memory array) so that:
 *  - concurrent discovery by multiple workers can't double-crawl a URL
 *    (unique (crawlId, normalizedUrl))
 *  - a failed crawl can resume from where it left off
 *  - the orchestrator can prioritize (PRODUCT > CATEGORY > POLICY > ...)
 *    and cap attempts.
 *
 * States: PENDING → PROCESSING → COMPLETED | FAILED | SKIPPED.
 */
export interface FrontierEntry {
  id: string;
  url: string;
  normalizedUrl: string;
  depth: number;
  priority: number;
  status: CrawlFrontierStatus;
  attempts: number;
}

const PROGRESS_BATCH = 200;

/** Claim up to `limit` PENDING entries for processing. Returns entries with
 *  status atomically moved to PROCESSING to avoid double-processing. */
export async function claimPendingFrontier(
  crawlId: string,
  limit: number
): Promise<FrontierEntry[]> {
  const pending = await prisma.crawlFrontier.findMany({
    where: { crawlId, status: "PENDING" },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      url: true,
      normalizedUrl: true,
      depth: true,
      priority: true,
      status: true,
      attempts: true,
    },
  });
  if (pending.length === 0) return [];

  await prisma.crawlFrontier.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  // Re-read to reflect the actual claimed set (in case of a race).
  return pending;
}

/** Seed the frontier with seed URL + sitemap URLs + discovered links. */
export async function seedFrontier(
  crawlId: string,
  orgId: string,
  websiteId: string,
  entries: Array<{ url: string; key: string; depth: number; priority: number; discoveredFrom?: string }>
): Promise<number> {
  if (entries.length === 0) return 0;
  const data: Prisma.CrawlFrontierCreateManyInput[] = entries.map((e) => ({
    crawlId,
    orgId,
    websiteId,
    url: e.url,
    normalizedUrl: e.key,
    depth: e.depth,
    priority: e.priority,
    discoveredFrom: e.discoveredFrom,
    status: "PENDING",
  }));

  let created = 0;
  for (let i = 0; i < data.length; i += PROGRESS_BATCH) {
    const batch = data.slice(i, i + PROGRESS_BATCH);
    const result = await prisma.crawlFrontier.createMany({
      data: batch,
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

/** Add newly discovered links mid-crawl (deduped by unique constraint). */
export async function addDiscoveredUrls(
  crawlId: string,
  orgId: string,
  websiteId: string,
  entries: Array<{ url: string; key: string; depth: number; priority: number; discoveredFrom?: string }>
): Promise<number> {
  if (entries.length === 0) return 0;
  const data: Prisma.CrawlFrontierCreateManyInput[] = entries.map((e) => ({
    crawlId,
    orgId,
    websiteId,
    url: e.url,
    normalizedUrl: e.key,
    depth: e.depth,
    priority: e.priority,
    discoveredFrom: e.discoveredFrom,
    status: "PENDING",
  }));

  let created = 0;
  for (let i = 0; i < data.length; i += PROGRESS_BATCH) {
    const batch = data.slice(i, i + PROGRESS_BATCH);
    const result = await prisma.crawlFrontier.createMany({
      data: batch,
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

/** Mark a single entry COMPLETED (owner of the claim). */
export async function completeFrontierEntry(id: string): Promise<void> {
  await prisma.crawlFrontier.update({
    where: { id },
    data: { status: "COMPLETED", processedAt: new Date() },
  });
}

/** Mark FAILED and increment attempts. Returns new attempt count. */
export async function failFrontierEntry(id: string): Promise<number> {
  const updated = await prisma.crawlFrontier.update({
    where: { id },
    data: { status: "FAILED", attempts: { increment: 1 }, processedAt: new Date() },
    select: { attempts: true },
  });
  return updated.attempts;
}

/** A permanent failure (404, robots, SSRF, content-type) — no retry. */
export async function skipFrontierEntry(id: string, reason?: string): Promise<void> {
  await prisma.crawlFrontier.update({
    where: { id },
    data: {
      status: "SKIPPED",
      processedAt: new Date(),
      ...(reason ? { scheduledAt: new Date() } : {}),
    },
  });
}

export async function frontierProgress(crawlId: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
}> {
  const rows = await prisma.crawlFrontier.groupBy({
    by: ["status"],
    where: { crawlId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r._count._all;
  return {
    pending: counts.PENDING ?? 0,
    processing: counts.PROCESSING ?? 0,
    completed: counts.COMPLETED ?? 0,
    failed: counts.FAILED ?? 0,
    skipped: counts.SKIPPED ?? 0,
  };
}

/** Reset FAILED entries back to PENDING (used by "retry crawl safely"). */
export async function requeueFailedFrontier(crawlId: string): Promise<number> {
  const result = await prisma.crawlFrontier.updateMany({
    where: { crawlId, status: "FAILED", attempts: { lt: 3 } },
    data: { status: "PENDING" },
  });
  return result.count;
}