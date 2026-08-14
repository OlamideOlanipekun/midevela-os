import prisma from "@/lib/prisma";
import type { Crawl, CrawlStatus, CrawlPageType } from "@prisma/client";
import { resolveCrawlLimits, type CrawlLimits } from "@/server/website/crawler/limits";
import { safeFetch, isFetchResult, type SafeFetchOptions } from "@/server/website/crawler/fetcher";
import { parseRobots, emptyRobots, isPathAllowed, type RobotsRules } from "@/server/website/crawler/robots";
import { parseSitemap } from "@/server/website/crawler/sitemap";
import { discoverLinks, declaredCanonical } from "@/server/website/crawler/discovery";
import { classify, type ClassifyDecision } from "@/server/website/crawler/classifier";
import {
  seedFrontier, claimPendingFrontier, completeFrontierEntry, failFrontierEntry,
  skipFrontierEntry, addDiscoveredUrls, frontierProgress,
} from "@/server/website/crawler/frontier";
import { effectiveHost, canonicalUrlFor } from "@/server/website/crawler/canonical";
import { extractDocument } from "@/server/website/extraction/document";
import { extractProductFromJsonLd, extractProductFromDom } from "@/server/website/extraction/product";
import { extractKnowledge } from "@/server/website/extraction/knowledge";
import { upsertPage, hashContent } from "@/server/website/reconciliation/pages";
import { reconcileProducts, reconcileStaleProducts } from "@/server/website/reconciliation/products";
import { reconcileKnowledge } from "@/server/website/reconciliation/knowledge";
import {
  publishWebsiteCrawlStarted, publishWebsiteCrawlCompleted, publishWebsiteCrawlFailed,
} from "@/server/events/instrument";

/**
 * Crawl orchestrator — owns the full website-intelligence lifecycle.
 *
 *   startCrawl(...)  creates a Crawl row, seeds url + robots + sitemaps into
 *                    the frontier, then kickstarts runCrawl (fire-and-forget
 *                    in the API; also usable from the crawl worker).
 *
 *   runCrawl(ctx)    resumable frontier loop: claim → safeFetch → classify →
 *                    extract → reconcile → discover → enqueue.
 *
 * Guarantees come from the frontier's unique (crawlId, normalizedUrl) and
 * the PROCESSING claim state — a worker restart never double-crawls a URL.
 * Every network hop goes through safeFetch (per-hop SSRF, cross-site
 * redirect block, size+time caps). All persistence is plan-capped and
 * idempotent (upsert by canonical/source URL + content hash).
 */

export interface CrawlContext {
  orgId: string;
  websiteId: string;
  crawlId: string;
  rawUrl: string;
  trigger?: "MANUAL" | "SCHEDULED" | "CLAIM" | "REINDEX";
  /** Cooperative cancellation check — returns true to stop at the next checkpoint. */
  isCancelled?: () => boolean;
  /** Ready-to-return callback for synchronous (route) crawls — when set the
   *  helper exits as soon as the first URI yields results. */
  onProgress?: (p: CrawlRunResult) => void;
  /** Optional external logger hook. */
  log?: (msg: string) => void;
}

export interface CrawlRunResult {
  crawlId: string;
  status: CrawlStatus;
  pagesDiscovered: number;
  pagesProcessed: number;
  pagesFailed: number;
  productsCreated: number;
  productsUpdated: number;
  knowledgeCreated: number;
}

const trace = (ctx: CrawlContext, msg: string) => {
  if (ctx.log) ctx.log(msg);
  else console.log(`[crawl:${ctx.crawlId}] ${msg}`);
};

function seedOriginOf(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname.toLowerCase()}`;
  } catch {
    return raw;
  }
}

async function updateCrawlStatus(crawlId: string, status: CrawlStatus, data?: Partial<Crawl>): Promise<void> {
  await prisma.crawl.update({
    where: { id: crawlId },
    data: {
      status,
      ...(status === "RUNNING" ? { startedAt: new Date() } : {}),
      ...(status === "COMPLETED" || status === "FAILED" || status === "CANCELLED" || status === "PARTIAL"
        ? { completedAt: new Date() }
        : {}),
      ...(data ?? {}),
    },
  });
}

import { enqueue } from "@/server/queues/queue";

/**
 * Create a Crawl row, seed the frontier (seed URL + robots + sitemaps), and
 * start the crawl via BullMQ worker queue. Throws when the org doesn't own
 * the website or a crawl is already running.
 */
export async function startCrawl(
  orgId: string,
  websiteId: string,
  rawUrl: string,
  trigger: "MANUAL" | "SCHEDULED" | "CLAIM" | "REINDEX" = "MANUAL"
): Promise<string> {
  const website = await prisma.websiteRegistry.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error("Website not found");
  if (website.orgId !== orgId) throw new Error("You do not own this website");
  if (website.crawlStatus === "CRAWLING") throw new Error("A crawl is already in progress for this website");

  const crawl = await prisma.crawl.create({
    data: { orgId, websiteId, trigger, status: "QUEUED" },
  });
  await prisma.websiteRegistry.update({
    where: { id: websiteId },
    data: { crawlStatus: "CRAWLING" },
  });

  publishWebsiteCrawlStarted(orgId, websiteId, website.normalizedUrl);

  await enqueue("crawl", { orgId, websiteId, crawlId: crawl.id, rawUrl, trigger });
  return crawl.id;
}

// ─── bootstrap: robots + sitemap seeding ─────────────────────────────────

async function loadRobots(ctx: CrawlContext, limits: CrawlLimits): Promise<RobotsRules> {
  try {
    const base = seedOriginOf(ctx.rawUrl);
    const res = await safeFetch(`${base}/robots.txt`, {
      seedHost: effectiveHost(ctx.rawUrl),
      timeoutMs: 6000,
      maxBytes: 512 * 1024,
    });
    if (isFetchResult(res)) return parseRobots(res.html);
    return emptyRobots(false);
  } catch {
    return emptyRobots(true);
  }
}

async function seedSitemap(ctx: CrawlContext, sitemapUrl: string, limits: CrawlLimits, depth = 0): Promise<void> {
  if (depth > 3) return;
  if (effectiveHost(sitemapUrl) !== effectiveHost(ctx.rawUrl)) return; // never crawl foreign sitemaps

  const res = await safeFetch(sitemapUrl, {
    seedHost: effectiveHost(ctx.rawUrl),
    timeoutMs: 8000,
    maxBytes: limits.maxResponseBytes,
  });
  if (!isFetchResult(res)) return;

  const parsed = parseSitemap(res.html, res.finalUrl, limits.maxSitemapUrls);
  if (parsed.parseError) return;

  if (parsed.children.length > 0) {
    for (const child of parsed.children.slice(0, 20)) await seedSitemap(ctx, child, limits, depth + 1);
    return;
  }

  const entries = parsed.urls
    .filter((u) => effectiveHost(u.url) === effectiveHost(ctx.rawUrl))
    .map((u) => ({
      url: u.url,
      key: u.key,
      depth: 1,
      priority: Math.max(1, Math.round((u.priority ?? 0.5) * 100)),
      discoveredFrom: "sitemap",
    }));
  await seedFrontier(ctx.crawlId, ctx.orgId, ctx.websiteId, entries);
}

// ─── single page processing ──────────────────────────────────────────────

const PERMANENT_FAILURES = new Set(["invalid", "ssrf", "content_type", "redirect_loop"] as const);

async function processPage(
  ctx: CrawlContext,
  entry: { id: string; url: string; depth: number },
  limits: CrawlLimits,
  robots: RobotsRules
): Promise<void> {
  const res = await safeFetch(entry.url, {
    seedHost: effectiveHost(ctx.rawUrl),
    timeoutMs: 8000,
    maxBytes: limits.maxResponseBytes,
    maxRedirects: limits.maxRedirects,
  });

  if (!isFetchResult(res)) {
    if (PERMANENT_FAILURES.has(res.kind)) await skipFrontierEntry(entry.id, res.kind);
    else await failFrontierEntry(entry.id);
    return;
  }

  const doc = extractDocument(res.html, { baseUrl: res.finalUrl });
  const declared = declaredCanonical(res.html, res.finalUrl);
  const canonicalUrl = canonicalUrlFor(res.finalUrl, declared?.url);

  const decision: ClassifyDecision = classify({
    url: entry.url,
    title: doc.title,
    h1: doc.h1s[0],
    html: res.html,
  });

  // 1 — page inventory (idempotent upsert + content hash).
  await upsertPage({
    orgId: ctx.orgId,
    websiteId: ctx.websiteId,
    crawlId: ctx.crawlId,
    url: entry.url,
    canonicalUrl,
    pageType: decision.pageType,
    title: doc.title,
    contentHash: hashContent(res.html),
    httpStatus: res.status,
    contentType: res.contentType,
    discoveredFrom: entry.url,
    depth: entry.depth,
    metadata: { signal: decision.signal, confidence: decision.confidence },
  });

  // 2 — products (JSON-LD → DOM fallback), plan-capped inside reconcile.
  if (decision.pageType === "PRODUCT") {
    const product =
      extractProductFromJsonLd(doc.jsonLd, res.finalUrl) ??
      extractProductFromDom(res.html, res.finalUrl);
    if (product) {
      const before = await prisma.crawl.findUniqueOrThrow({ where: { id: ctx.crawlId } });
      const result = await reconcileProducts(ctx.orgId, [product]);
      await prisma.crawl.update({
        where: { id: ctx.crawlId },
        data: {
          productsDiscovered: { increment: 1 },
          productsCreated: { increment: Math.max(0, result.created) },
          productsUpdated: { increment: Math.max(0, result.updated) },
          ...(before.id ? { updatedAt: new Date() } : {}),
        },
      });
    }
  }

  // 3 — knowledge (policies / FAQ / documents).
  if (decision.pageType === "POLICY" || decision.pageType === "FAQ") {
    const entries = extractKnowledge(res.html, res.finalUrl);
    if (entries.length > 0) {
      const kresult = await reconcileKnowledge(ctx.orgId, entries);
      await prisma.crawl.update({
        where: { id: ctx.crawlId },
        data: { knowledgeEntriesProcessed: { increment: kresult.created + kresult.updated } },
      });
    }
  }

  // 4 — same-site discovery (robots-filtered, depth-capped).
  if (entry.depth < limits.maxDepth) {
    const links = discoverLinks(res.html, res.finalUrl, {
      seedHost: effectiveHost(ctx.rawUrl),
      maxLinks: 200,
    }).filter((l) => {
      try {
        return isPathAllowed(new URL(l.url).pathname, robots);
      } catch {
        return false;
      }
    });

    await addDiscoveredUrls(
      ctx.crawlId,
      ctx.orgId,
      ctx.websiteId,
      links.slice(0, 100).map((l) => ({
        url: l.url,
        key: l.key,
        depth: entry.depth + 1,
        priority: Math.max(1, (l.priority ?? 50) - entry.depth * 5),
        discoveredFrom: entry.url,
      }))
    );
  }

  await completeFrontierEntry(entry.id);
}

// ─── the frontier loop ───────────────────────────────────────────────────

export async function runCrawl(ctx: CrawlContext): Promise<CrawlRunResult> {
  const limits = await resolveCrawlLimits(ctx.orgId);
  const start = Date.now();
  const isCancelled = async () => {
    if (ctx.isCancelled?.()) return true;
    const current = await prisma.crawl.findUnique({
      where: { id: ctx.crawlId },
      select: { status: true },
    });
    return current?.status === "CANCELLED";
  };

  await updateCrawlStatus(ctx.crawlId, "RUNNING");

  // Seed: seed URL always; robots/sitemap best-effort.
  const seedUrl = new URL(ctx.rawUrl).toString();
  await seedFrontier(ctx.crawlId, ctx.orgId, ctx.websiteId, [
    { url: seedUrl, key: canonicalUrlFor(seedUrl), depth: 0, priority: 100 },
  ]);

  const robots = await loadRobots(ctx, limits);
  for (const s of robots.sitemaps.slice(0, 10)) {
    try {
      if (isPathAllowed(new URL(s).pathname, robots)) await seedSitemap(ctx, s, limits);
    } catch {
      // Malformed sitemap URL — skip.
    }
  }

  try {
    while (!(await isCancelled())) {
      if (Date.now() - start > limits.maxCrawlDurationMs) break;

      const batch = await claimPendingFrontier(ctx.crawlId, limits.maxConcurrentPages);
      if (batch.length === 0) break;

      for (const entry of batch) {
        if (await isCancelled()) break;
        try {
          await processPage(ctx, entry, limits, robots);
        } catch (err) {
          trace(ctx, `page error ${entry.url}: ${err instanceof Error ? err.message : err}`);
          await failFrontierEntry(entry.id);
        }
      }

      const progress = await frontierProgress(ctx.crawlId);
      await prisma.crawl.update({
        where: { id: ctx.crawlId },
        data: { pagesProcessed: progress.completed, pagesFailed: progress.failed },
      });
    }

    const progress = await frontierProgress(ctx.crawlId);
    const cancelled = await isCancelled();
    const status: CrawlStatus = cancelled ? "CANCELLED" : "COMPLETED";

    await updateCrawlStatus(ctx.crawlId, status, {
      pagesDiscovered: progress.pending + progress.completed + progress.failed + progress.skipped,
      pagesProcessed: progress.completed,
      pagesFailed: progress.failed,
    });

    if (status === "COMPLETED") {
      try {
        const pages = await prisma.websitePage.findMany({
          where: { crawlId: ctx.crawlId, pageType: "PRODUCT" },
          select: { canonicalUrl: true, url: true },
        });
        const activeUrls = pages.map((p) => p.canonicalUrl || p.url);
        if (activeUrls.length > 0) {
          const cleaned = await reconcileStaleProducts(ctx.orgId, activeUrls);
          if (cleaned > 0) {
            trace(ctx, `stale cleanup: marked ${cleaned} removed products OUT_OF_STOCK and purged vector embeddings`);
          }
        }
      } catch (staleErr) {
        trace(ctx, `stale cleanup error: ${staleErr instanceof Error ? staleErr.message : staleErr}`);
      }
    }

    const hardFail = progress.completed === 0 && progress.failed > 0;
    const websiteStatusNow = hardFail ? "FAILED" : "READY";
    await prisma.websiteRegistry.update({
      where: { id: ctx.websiteId },
      data: { crawlStatus: websiteStatusNow, lastCrawledAt: new Date() },
    });

    const crawl = await prisma.crawl.findUniqueOrThrow({ where: { id: ctx.crawlId } });
    publishWebsiteCrawlCompleted(ctx.orgId, ctx.websiteId, seedUrl, crawl.productsCreated);

    return {
      crawlId: ctx.crawlId,
      status,
      pagesDiscovered: progress.pending + progress.completed + progress.failed + progress.skipped,
      pagesProcessed: progress.completed,
      pagesFailed: progress.failed,
      productsCreated: crawl.productsCreated,
      productsUpdated: crawl.productsUpdated,
      knowledgeCreated: crawl.knowledgeEntriesProcessed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    trace(ctx, `crawl failed: ${msg}`);
    await updateCrawlStatus(ctx.crawlId, "FAILED", { error: msg.slice(0, 1000) });
    await prisma.websiteRegistry.update({
      where: { id: ctx.websiteId },
      data: { crawlStatus: "FAILED", lastCrawledAt: new Date() },
    });
    publishWebsiteCrawlFailed(ctx.orgId, ctx.websiteId, seedUrl, msg);
    throw err;
  }
}

export async function getCrawlProgress(crawlId: string) {
  const crawl = await prisma.crawl.findUnique({
    where: { id: crawlId },
  });
  if (!crawl) return null;
  const fp = await frontierProgress(crawlId);
  return {
    crawlId: crawl.id,
    websiteId: crawl.websiteId,
    orgId: crawl.orgId,
    status: crawl.status,
    startedAt: crawl.startedAt,
    completedAt: crawl.completedAt,
    progress: {
      pending: fp.pending,
      processing: fp.processing,
      completed: fp.completed,
      failed: fp.failed,
      skipped: fp.skipped,
      totalDiscovered: fp.pending + fp.processing + fp.completed + fp.failed + fp.skipped,
    },
    products: {
      discovered: crawl.productsDiscovered,
      created: crawl.productsCreated,
      updated: crawl.productsUpdated,
    },
    knowledgeCreated: crawl.knowledgeEntriesProcessed,
    error: crawl.error,
  };
}

export async function cancelCrawl(crawlId: string): Promise<boolean> {
  const crawl = await prisma.crawl.findUnique({ where: { id: crawlId } });
  if (!crawl) return false;
  await prisma.crawl.update({
    where: { id: crawlId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await prisma.websiteRegistry.update({
    where: { id: crawl.websiteId },
    data: { crawlStatus: "READY" },
  });
  return true;
}


export type { RobotsRules };
export { seedOriginOf, updateCrawlStatus };

/**
 * Quick crawl — a bounded synchronous crawl for the onboarding/claims path
 * where the HTTP handler needs results NOW (no queue round-trip). Fetches
 * the seed URL + robots + first sitemap batch, plus up to `maxPages`
 * discovered pages, persisting everything through the same pipeline.
 * Returns a CrawlRunResult (status COMPLETED with a "quick" marker).
 */
export async function quickCrawl(
  orgId: string,
  websiteId: string,
  rawUrl: string,
  maxPages = 20
): Promise<CrawlRunResult> {
  const website = await prisma.websiteRegistry.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error("Website not found");
  if (website.orgId !== orgId) throw new Error("You do not own this website");

  const limits = await resolveCrawlLimits(orgId);
  const effectiveMax = Math.min(maxPages, limits.maxPages, 50);

  const crawl = await prisma.crawl.create({
    data: { orgId, websiteId, trigger: "CLAIM", status: "RUNNING", startedAt: new Date() },
  });
  await prisma.websiteRegistry.update({
    where: { id: websiteId },
    data: { crawlStatus: "CRAWLING" },
  });

  const ctx: CrawlContext = { orgId, websiteId, crawlId: crawl.id, rawUrl };
  const seedUrl = new URL(rawUrl).toString();
  const robots = await loadRobots(ctx, limits);

  try {
    await seedFrontier(crawl.id, orgId, websiteId, [
      { url: seedUrl, key: canonicalUrlFor(seedUrl), depth: 0, priority: 100 },
    ]);
    for (const s of robots.sitemaps.slice(0, 5)) {
      try {
        await seedSitemap(ctx, s, limits);
      } catch {
        // ignore broken sitemap URLs
      }
    }

    let processed = 0;
    while (processed < effectiveMax) {
      const batch = await claimPendingFrontier(crawl.id, 4);
      if (batch.length === 0) break;
      for (const entry of batch) {
        if (processed >= effectiveMax) {
          await failFrontierEntry(entry.id); // leave for a later full crawl
          continue;
        }
        try {
          await processPage(ctx, entry, limits, robots);
        } catch {
          await failFrontierEntry(entry.id);
        }
        processed++;
      }
    }

    const finalProgress = await frontierProgress(crawl.id);
    await updateCrawlStatus(crawl.id, "COMPLETED", {
      pagesDiscovered:
        finalProgress.pending + finalProgress.completed + finalProgress.failed + finalProgress.skipped,
      pagesProcessed: finalProgress.completed,
      pagesFailed: finalProgress.failed,
    });

    const rushed = await prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } });
    await prisma.websiteRegistry.update({
      where: { id: websiteId },
      data: { crawlStatus: "READY", lastCrawledAt: new Date() },
    });
    publishWebsiteCrawlCompleted(orgId, websiteId, seedUrl, rushed.productsCreated);

    return {
      crawlId: crawl.id,
      status: "COMPLETED",
      pagesDiscovered:
        finalProgress.pending + finalProgress.completed + finalProgress.failed + finalProgress.skipped,
      pagesProcessed: finalProgress.completed,
      pagesFailed: finalProgress.failed,
      productsCreated: rushed.productsCreated,
      productsUpdated: rushed.productsUpdated,
      knowledgeCreated: rushed.knowledgeEntriesProcessed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateCrawlStatus(crawl.id, "FAILED", { error: msg.slice(0, 1000) });
    await prisma.websiteRegistry.update({
      where: { id: websiteId },
      data: { crawlStatus: "FAILED", lastCrawledAt: new Date() },
    });
    throw err;
  }
}

/**
 * Triggers scheduled recrawls for active websites whose last crawl is older than staleAgeHours (default 24).
 * Returns the number of enqueued recrawl jobs.
 */
export async function triggerScheduledRecrawls(staleAgeHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - staleAgeHours * 60 * 60 * 1000);
  const staleWebsites = await prisma.websiteRegistry.findMany({
    where: {
      status: "ACTIVE",
      crawlStatus: { not: "CRAWLING" },
      OR: [
        { lastCrawledAt: null },
        { lastCrawledAt: { lt: cutoff } },
      ],
    },
    select: { id: true, orgId: true, originalUrl: true },
  });

  let enqueued = 0;
  for (const site of staleWebsites) {
    try {
      await startCrawl(site.orgId, site.id, site.originalUrl, "SCHEDULED");
      enqueued++;
    } catch (err) {
      console.error(`[scheduledRecrawl] Failed to enqueue crawl for website ${site.id}:`, err);
    }
  }

  return enqueued;
}