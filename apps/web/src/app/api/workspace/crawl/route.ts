import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { quickCrawl, startCrawl, getCrawlProgress, cancelCrawl } from "@/server/website/crawler/orchestrator";
import { normalizeUrl } from "@/server/website/normalizer";
import { assertPublicUrl } from "@/server/net/ssrfGuard";

export const runtime = "nodejs";

/**
 * POST /api/workspace/crawl
 * Starts a quick synchronous or full background crawl.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const rawUrl = body?.url;
    const mode: string = body?.mode ?? "quick";

    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return jsonError(400, "URL is required.");
    }
    if (rawUrl.length > 2048) {
      return jsonError(400, "URL is too long.");
    }
    if (mode !== "quick" && mode !== "full") {
      return jsonError(400, "mode must be 'quick' or 'full'.");
    }

    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

    await assertPublicUrl(targetUrl);

    const normalizedUrl = normalizeUrl(targetUrl);
    let registryEntry = await prisma.websiteRegistry.findUnique({
      where: { normalizedUrl },
    });

    if (!registryEntry) {
      registryEntry = await prisma.websiteRegistry.create({
        data: {
          orgId: org.id,
          normalizedUrl,
          originalUrl: targetUrl,
          status: "ACTIVE",
          verificationStatus: "UNVERIFIED",
          crawlStatus: "CRAWLING",
        },
      });
    } else if (registryEntry.orgId !== org.id) {
      return jsonError(403, "This website belongs to another workspace.");
    } else if (registryEntry.status !== "ACTIVE") {
      return jsonError(422, "Website is not active.");
    }

    if (mode === "full") {
      if (registryEntry.crawlStatus === "CRAWLING") {
        return jsonError(409, "A crawl is already in progress for this website.");
      }
      const crawlId = await startCrawl(org.id, registryEntry.id, targetUrl, "CLAIM");
      return NextResponse.json({ success: true, mode: "full", crawlId });
    }

    const result = await quickCrawl(org.id, registryEntry.id, targetUrl, 20);

    return NextResponse.json({
      success: true,
      mode: "quick",
      crawlId: result.crawlId,
      status: result.status,
      pagesDiscovered: result.pagesDiscovered,
      pagesProcessed: result.pagesProcessed,
      pagesFailed: result.pagesFailed,
      productsCreated: result.productsCreated,
      productsUpdated: result.productsUpdated,
      knowledgeCreated: result.knowledgeCreated,
    });
  }, req);
}

/**
 * GET /api/workspace/crawl?crawlId=xyz
 * Returns real-time crawl progress, page counts, products created, and status.
 */
export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const { searchParams } = new URL(req.url);
    let crawlId = searchParams.get("crawlId");

    if (!crawlId) {
      const latest = await prisma.crawl.findFirst({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      crawlId = latest?.id ?? null;
    }

    if (!crawlId) {
      return jsonError(444, "No crawls found for this workspace.");
    }

    const progress = await getCrawlProgress(crawlId);
    if (!progress || progress.orgId !== org.id) {
      return jsonError(404, "Crawl not found.");
    }

    return NextResponse.json({ success: true, ...progress });
  }, req);
}

/**
 * DELETE /api/workspace/crawl?crawlId=xyz
 * Cooperatively cancels an active crawl.
 */
export async function DELETE(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const { searchParams } = new URL(req.url);
    const crawlId = searchParams.get("crawlId");

    if (!crawlId) {
      return jsonError(400, "crawlId query parameter is required.");
    }

    const progress = await getCrawlProgress(crawlId);
    if (!progress || progress.orgId !== org.id) {
      return jsonError(404, "Crawl not found.");
    }

    const cancelled = await cancelCrawl(crawlId);
    return NextResponse.json({ success: true, cancelled, crawlId });
  }, req);
}