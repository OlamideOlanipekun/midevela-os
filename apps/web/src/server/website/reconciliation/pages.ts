import prisma from "@/lib/prisma";
import type { CrawlPageType } from "@prisma/client";
import { createHash } from "crypto";

/**
 * Page-inventory reconciliation — "what did Midevela actually see?".
 *
 * Each fetched page upserts into website_pages keyed by (orgId, canonicalUrl)
 * and records the crawl it was last observed in. contentHash allows cheap
 * change detection between crawls for freshness reporting. Nothing is ever
 * deleted here — the orchestrator decides on removals via grace periods.
 */

export interface PageRecordInput {
  orgId: string;
  websiteId: string;
  crawlId: string;
  url: string;
  canonicalUrl: string;
  pageType: CrawlPageType;
  title?: string;
  contentHash: string;
  httpStatus: number;
  contentType: string;
  discoveredFrom?: string;
  depth: number;
  metadata?: Record<string, unknown>;
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text.slice(0, 500_000)).digest("hex");
}

/** Upsert a fetched page. Returns { created, changed } so progress
 *  accounting is exact. */
export async function upsertPage(
  input: PageRecordInput
): Promise<{ created: boolean; changed: boolean }> {
  const existing = await prisma.websitePage.findUnique({
    where: { orgId_canonicalUrl: { orgId: input.orgId, canonicalUrl: input.canonicalUrl } },
    select: { id: true, contentHash: true },
  });

  if (existing) {
    const changed = existing.contentHash !== input.contentHash;
    await prisma.websitePage.update({
      where: { id: existing.id },
      data: {
        crawlId: input.crawlId,
        url: input.url,
        pageType: input.pageType,
        title: input.title ?? null,
        contentHash: input.contentHash,
        httpStatus: input.httpStatus,
        contentType: input.contentType,
        discoveredFrom: input.discoveredFrom ?? null,
        depth: input.depth,
        metadata: (input.metadata ?? {}) as object,
        lastCrawledAt: new Date(),
        lastSuccessfulCrawlAt: new Date(),
      },
    });
    return { created: false, changed };
  }

  await prisma.websitePage.create({
    data: {
      orgId: input.orgId,
      websiteId: input.websiteId,
      crawlId: input.crawlId,
      url: input.url,
      canonicalUrl: input.canonicalUrl,
      pageType: input.pageType,
      title: input.title ?? null,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      contentType: input.contentType,
      discoveredFrom: input.discoveredFrom ?? null,
      depth: input.depth,
      metadata: (input.metadata ?? {}) as object,
      lastCrawledAt: new Date(),
      lastSuccessfulCrawlAt: new Date(),
    },
  });
  return { created: true, changed: true };
}

/**
 * Soft-mark pages that were NOT observed in the given crawl. Products run
 * through the same grace logic in products.ts; here we only record that a
 * page went unseen so dashboards can report staleness. Returns the count.
 */
export async function markUnseenPages(
  orgId: string,
  websiteId: string,
  observedCanonicals: string[],
  seenInCrawlId: string
): Promise<number> {
  const result = await prisma.websitePage.updateMany({
    where: {
      orgId,
      websiteId,
      canonicalUrl: { notIn: observedCanonicals },
      lastCrawledAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    data: { crawlId: seenInCrawlId },
  });
  return result.count;
}