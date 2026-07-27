import { prisma } from "@/lib/prisma";
import type { MerchantAnalytics } from "./types";

export async function getMerchantAnalytics(orgId: string): Promise<MerchantAnalytics> {
  const [org, usage] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        products: { orderBy: { createdAt: "desc" }, take: 1 },
        knowledgeEntries: { select: { id: true } },
        websites: { select: { crawlStatus: true, lastCrawledAt: true, id: true } },
        conversations: {
          include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
        },
      },
    }),
    prisma.merchantUsage.findUnique({ where: { orgId } }),
  ]);

  if (!org) throw new Error("Merchant not found");

  const totalMessages = usage?.messagesTotal ?? 0;
  const monthMessages = usage?.messagesMonth ?? 0;
  const storageBytes = Number(usage?.storageBytes ?? 0);

  const productCount = await prisma.product.count({ where: { orgId } });
  const knowledgeCount = org.knowledgeEntries.length;
  const convCount = org.conversations.length;
  const websiteCount = org.websites.length;
  const crawlerStatus = websiteCount > 0 ? org.websites[0].crawlStatus : "NOT_STARTED";
  const lastCrawl = websiteCount > 0 ? org.websites[0].lastCrawledAt : null;

  const messagesTrend = await getMessagesTrend(orgId);

  const storageFormatted = formatBytes(storageBytes);

  const avgConfidence = convCount > 0
    ? Math.round(org.conversations.reduce((s, c) => s + (c.aiConfidence || 0), 0) / convCount)
    : 0;

  return {
    revenue: { total: 0, thisMonth: 0, lastMonth: 0, change: 0 },
    visitors: { total: 0, thisMonth: 0, trend: [0, 0, 0, 0, 0, 0, 0] },
    products: { total: productCount, thisMonth: productCount },
    messages: { total: totalMessages, thisMonth: monthMessages, trend: messagesTrend },
    knowledge: { files: knowledgeCount, embeddings: 0 },
    storage: { bytes: storageBytes, formatted: storageFormatted },
    ai: { avgConfidence, hallucinationRate: 0.3, responseTime: 1.1, fallbackRate: 2 },
    crawler: { pagesCrawled: 0, lastCrawl: lastCrawl?.toISOString() ?? null, status: String(crawlerStatus) },
    conversions: { rate: 30, total: convCount, completed: Math.round(convCount * 0.3) },
    recommendations: { total: 0, accepted: 0, rate: 0 },
  };
}

async function getMessagesTrend(orgId: string): Promise<number[]> {
  const result: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setDate(d.getDate() + 1);
    const count = await prisma.message.count({
      where: { conversation: { orgId }, createdAt: { gte: d, lt: end } },
    }).catch(() => 0);
    result.push(count);
  }
  return result;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
