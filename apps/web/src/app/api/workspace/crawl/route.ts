import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { assertPublicUrl } from "@/server/net/ssrfGuard";
import { importCatalogFromUrl } from "@/server/catalog/catalogImporter";
import { getPlanCaps, remainingBudget } from "@/server/billing/caps";
import { normalizeUrl } from "@/server/website/normalizer";

// Force Node.js runtime — this route uses dns/promises (ssrfGuard) and
// other Node built-ins that are unavailable in the Edge runtime.
export const runtime = "nodejs";

// Products now come from the layered catalogImporter (platform-JSON →
// JSON-LD → fetch+LLM → Firecrawl). This route additionally does a light,
// best-effort knowledge pass (shipping/FAQ) over a few pages.

const MAX_PAGES = 3;
const FETCH_TIMEOUT_MS = 3500;

function cleanText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface CrawledEntry {
  type: "FAQ" | "POLICY";
  title: string;
  content: string;
  metadata?: Prisma.InputJsonValue;
}

async function fetchPage(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MidevelaBot/1.0 (+https://midevela.com/bot)",
        Accept: "text/html,application/xhtml+xml,application/xml",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractKnowledge(html: string): CrawledEntry[] {
  const entries: CrawledEntry[] = [];
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const lowerTitle = (titleMatch?.[1] ?? "").toLowerCase();

  if (lowerTitle.includes("shipping") || lowerTitle.includes("delivery")) {
    const pRegex = /<p>([\s\S]*?)<\/p>/gi;
    let pMatch;
    let content = "";
    while ((pMatch = pRegex.exec(html)) !== null && content.length < 500) {
      content += cleanText(pMatch[1]) + " ";
    }
    if (content.trim()) {
      entries.push({
        type: "POLICY",
        title: "Shipping Policy (Crawled)",
        content: content.trim(),
      });
    }
  } else if (lowerTitle.includes("faq") || lowerTitle.includes("question")) {
    const h3Regex = /<h3>([\s\S]*?)<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>/gi;
    let qMatch;
    while ((qMatch = h3Regex.exec(html)) !== null && entries.length < 5) {
      const question = cleanText(qMatch[1]);
      const answer = cleanText(qMatch[2]);
      if (question.length > 5 && answer.length > 10) {
        entries.push({
          type: "FAQ",
          title: question,
          content: answer,
          metadata: { category: "General", usageCount: 0 },
        });
      }
    }
  }
  return entries;
}

function internalLinks(html: string, origin: string): string[] {
  const links: string[] = [];
  const linkRegex = /href="([^"]+)"/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    let link = linkMatch[1];
    if (link.startsWith("//")) link = `https:${link}`;
    else if (link.startsWith("/")) link = `${origin}${link}`;
    if (link.startsWith(origin) && link.startsWith("http") && !links.includes(link)) links.push(link);
  }
  return links;
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const rawUrl = body?.url;
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return jsonError(400, "URL is required.");
    }
    if (rawUrl.length > 2048) {
      return jsonError(400, "URL is too long.");
    }

    let targetUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

    // Ownership check: the website must be registered and ACTIVE for this org
    const normalizedUrl = normalizeUrl(targetUrl);
    const registryEntry = await prisma.websiteRegistry.findUnique({
      where: { normalizedUrl },
    });
    if (!registryEntry) {
      return jsonError(404, "Connect this website first via the dashboard before crawling.");
    }
    if (registryEntry.orgId !== org.id) {
      return jsonError(403, "This website belongs to another workspace.");
    }
    if (registryEntry.status !== "ACTIVE") {
      return jsonError(422, "Website is not active.");
    }

    // Products: layered importer (platform-JSON → JSON-LD → fetch+LLM →
    // Firecrawl), which runs its own SSRF guard + persistence (dedupe,
    // embeddings, category auto-seed).
    const productResult = await importCatalogFromUrl(org.id, targetUrl);

    // Knowledge (shipping/FAQ): a separate best-effort HTML crawl. Its own
    // SSRF guard on the seed + every followed link.
    const parsedTarget = await assertPublicUrl(targetUrl);
    const origin = parsedTarget.origin;

    const crawledPages: string[] = [];
    const foundEntries: CrawledEntry[] = [];

    const queue = [targetUrl];
    while (queue.length > 0 && crawledPages.length < MAX_PAGES) {
      const pageUrl = queue.shift()!;
      if (crawledPages.includes(pageUrl)) continue;

      try {
        await assertPublicUrl(pageUrl);
      } catch {
        continue;
      }
      crawledPages.push(pageUrl);

      const html = await fetchPage(pageUrl);
      if (!html) continue;

      foundEntries.push(...extractKnowledge(html));
      for (const link of internalLinks(html, origin).slice(0, 2)) {
        if (!crawledPages.includes(link)) queue.push(link);
      }
    }

    // Plan-capped: crawled FAQ/policy pages count toward the org's total
    // knowledge entries like any manually-added one. Updates to an already-
    // existing policy don't consume budget — only genuinely new rows do.
    const { knowledgeCap } = await getPlanCaps(org.id);
    const existingKnowledgeCount = await prisma.knowledgeEntry.count({ where: { orgId: org.id } });
    let budget = remainingBudget(existingKnowledgeCount, knowledgeCap);

    let entriesAdded = 0;
    for (const e of foundEntries) {
      const exists = await prisma.knowledgeEntry.findFirst({
        where: {
          orgId: org.id,
          type: e.type,
          title: { equals: e.title, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (exists) {
        if (e.type === "POLICY") {
          await prisma.knowledgeEntry.update({
            where: { id: exists.id },
            data: { content: e.content },
          });
        }
        continue;
      }
      if (budget <= 0) continue;
      await prisma.knowledgeEntry.create({
        data: {
          orgId: org.id,
          type: e.type,
          title: e.title,
          content: e.content,
          metadata: e.metadata ?? {},
        },
      });
      budget--;
      entriesAdded++;
    }

    // Update website crawl status
    const isSuccess = productResult.imported > 0 || entriesAdded > 0 || foundEntries.length > 0;
    await prisma.websiteRegistry.update({
      where: { id: registryEntry.id },
      data: {
        crawlStatus: isSuccess ? "READY" : "FAILED",
        lastCrawledAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      strategy: productResult.strategy,
      productsFoundCount: productResult.imported,
      productsSkipped: productResult.skipped.length,
      productsWarned: productResult.warnings.length,
      pagesCrawledCount: crawledPages.length,
      faqsFoundCount: foundEntries.filter((e) => e.type === "FAQ").length,
      policiesFoundCount: foundEntries.filter((e) => e.type === "POLICY").length,
    });
  }, req);
}
