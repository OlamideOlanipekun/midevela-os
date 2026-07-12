import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";

// ⚠️ Interim implementation: synchronous, max 3 pages, JSON-LD +
// heuristic extraction. Phase 2 moves this into a background job chain
// with progress reporting (see 00-backend-architecture.md).

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

interface CrawledProduct {
  name: string;
  price: number;
  currency: string;
  description: string;
  imageUrl?: string;
  sourceUrl: string;
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

function extractJsonLdProducts(html: string, sourceUrl: string): CrawledProduct[] {
  const products: CrawledProduct[] = [];
  const jsonLdRegex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const objects = Array.isArray(data) ? data : [data];
      for (const obj of objects) {
        const type = obj["@type"] || obj["type"];
        if (type !== "Product" || !obj.name) continue;
        const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
        const price = Number(offer?.price);
        if (!Number.isFinite(price)) continue;
        const image = Array.isArray(obj.image)
          ? obj.image[0]
          : typeof obj.image === "object"
            ? obj.image?.url
            : obj.image;
        products.push({
          name: String(obj.name),
          price,
          currency: offer?.priceCurrency || "NGN",
          description: obj.description ? String(obj.description) : "",
          imageUrl: image ? String(image) : undefined,
          sourceUrl,
        });
      }
    } catch {
      // malformed JSON-LD block — skip
    }
  }
  return products;
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
    if (link.startsWith("/")) link = `${origin}${link}`;
    if (link.startsWith(origin) && !links.includes(link)) links.push(link);
  }
  return links;
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const { url } = await req.json();
    if (!url) return jsonError(400, "URL is required.");

    let targetUrl = String(url).trim();
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

    let origin: string;
    try {
      origin = new URL(targetUrl).origin;
    } catch {
      return jsonError(400, "Invalid URL format.");
    }

    const crawledPages: string[] = [];
    const foundProducts: CrawledProduct[] = [];
    const foundEntries: CrawledEntry[] = [];

    const queue = [targetUrl];
    while (queue.length > 0 && crawledPages.length < MAX_PAGES) {
      const pageUrl = queue.shift()!;
      if (crawledPages.includes(pageUrl)) continue;
      crawledPages.push(pageUrl);

      const html = await fetchPage(pageUrl);
      if (!html) continue;

      foundProducts.push(...extractJsonLdProducts(html, pageUrl));
      foundEntries.push(...extractKnowledge(html));
      for (const link of internalLinks(html, origin).slice(0, 2)) {
        if (!crawledPages.includes(link)) queue.push(link);
      }
    }

    // Persist drafts, de-duplicated by name/title. No fake fallback data:
    // an empty crawl reports honestly as empty.
    let productsAdded = 0;
    for (const p of foundProducts) {
      const exists = await prisma.product.findFirst({
        where: { orgId: org.id, name: { equals: p.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.product.create({
        data: {
          orgId: org.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          description: p.description || null,
          images: p.imageUrl ? [p.imageUrl] : [],
          source: "CRAWL",
          sourceUrl: p.sourceUrl,
        },
      });
      productsAdded++;
    }

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
      await prisma.knowledgeEntry.create({
        data: {
          orgId: org.id,
          type: e.type,
          title: e.title,
          content: e.content,
          metadata: e.metadata ?? {},
        },
      });
      entriesAdded++;
    }

    return NextResponse.json({
      success: true,
      pagesCrawledCount: crawledPages.length,
      pagesCrawled: crawledPages,
      productsFoundCount: productsAdded,
      faqsFoundCount: foundEntries.filter((e) => e.type === "FAQ").length,
      policiesFoundCount: foundEntries.filter((e) => e.type === "POLICY").length,
    });
  });
}
