import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auth/audit";
import type {
  ConversationListItem, ConversationDetail, CustomerProfile,
  MessageItem, ConversationEventItem, AIReasoning, RecommendationData,
} from "./types";

function calcQuality(conv: {
  aiConfidence: number; status: string; outcome: string;
  humanJoined: boolean; messages: unknown[];
}): { score: number; label: string } {
  const confidenceScore = conv.aiConfidence * 0.3;
  const outcomeScore = conv.outcome === "PURCHASED" ? 100 : conv.outcome === "RESOLVED" ? 80 : conv.outcome === "ABANDONED" ? 20 : 40;
  const interventionPenalty = conv.humanJoined ? -15 : 0;
  const statusBonus = conv.status === "ENDED" ? 10 : conv.status === "HANDED_OFF" ? -5 : 0;
  const msgCount = conv.messages.length;
  const lengthScore = msgCount <= 5 ? 100 : msgCount <= 15 ? 80 : msgCount <= 30 ? 60 : 40;
  const raw = Math.round(confidenceScore + outcomeScore * 0.25 + lengthScore * 0.2 + interventionPenalty + statusBonus);
  const score = Math.max(0, Math.min(100, raw));
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor";
  return { score, label };
}

export async function listConversations(params: {
  search?: string; status?: string; merchant?: string; intent?: string;
  confidence?: string; escalated?: string; country?: string; dateFrom?: string; dateTo?: string;
  page: number; limit: number;
}): Promise<{ items: ConversationListItem[]; total: number; page: number; totalPages: number }> {
  const { search, status, merchant, intent, escalated, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};

  const AND: Record<string, unknown>[] = [];

  if (search) {
    AND.push({
      OR: [
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
        { org: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (status) AND.push({ status: status as any });
  if (merchant) AND.push({ orgId: merchant });
  if (intent) AND.push({ intent: { contains: intent, mode: "insensitive" } });
  if (escalated === "true") AND.push({ status: "HANDED_OFF" });
  if (AND.length > 0) where.AND = AND;

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where: where as any,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        customer: { select: { name: true, email: true } },
        org: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where: where as any }),
  ]);

  const list: ConversationListItem[] = items.map((c) => ({
    id: c.id,
    customerName: c.customer.name,
    customerEmail: c.customer.email,
    merchantName: c.org.name,
    merchantId: c.org.id,
    started: c.createdAt.toISOString(),
    status: c.status,
    outcome: c.outcome,
    messages: c._count.messages,
    aiConfidence: c.aiConfidence,
    qualityScore: c.qualityScore,
    intent: c.intent,
    tags: (c.tags as string[]) ?? [],
    humanJoined: c.humanJoined,
  }));

  return { items: list, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      org: { select: { id: true, name: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conv) throw new Error("Conversation not found");

  const quality = calcQuality(conv);
  await prisma.conversation.update({ where: { id }, data: { qualityScore: quality.score } }).catch(() => {});

  const messages: MessageItem[] = conv.messages.map((m) => ({
    id: m.id, role: m.role, content: m.content,
    inputTokens: m.inputTokens, outputTokens: m.outputTokens,
    confidence: 95, latency: 1.2,
    promptVersion: null, modelUsed: "gpt-4",
    knowledgeSources: [], productsUsed: [],
    createdAt: m.createdAt.toISOString(),
  }));

  const events: ConversationEventItem[] = conv.events.map((e) => ({
    id: e.id, type: e.type,
    data: e.data as Record<string, unknown>,
    createdAt: e.createdAt.toISOString(),
  }));

  const customer: CustomerProfile = {
    id: conv.customer.id, name: conv.customer.name, email: conv.customer.email,
    phone: null, location: null, device: null, browser: null, ip: null,
    firstSeen: conv.customer.firstSeen.toISOString(),
    lastSeen: conv.customer.lastSeen.toISOString(),
    totalConversations: 1, totalOrders: 0, lifetimeValue: 0,
    returning: false, currentPage: null, productsViewed: [],
    sessionDuration: 0,
  };

  return {
    id: conv.id, status: conv.status, outcome: conv.outcome,
    intent: conv.intent, aiConfidence: conv.aiConfidence,
    qualityScore: quality.score, qualityLabel: quality.label,
    tags: (conv.tags as string[]) ?? [],
    humanJoined: conv.humanJoined, aiPaused: conv.aiPaused,
    createdAt: conv.createdAt.toISOString(),
    merchant: { id: conv.org.id, name: conv.org.name, slug: conv.org.slug },
    customer, messages, events,
  };
}

export async function getMessages(id: string, before?: string, limit = 50): Promise<MessageItem[]> {
  const where: Record<string, unknown> = { conversationId: id };
  if (before) where.createdAt = { lt: new Date(before) };

  const msgs = await prisma.message.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return msgs.reverse().map((m) => ({
    id: m.id, role: m.role, content: m.content,
    inputTokens: m.inputTokens, outputTokens: m.outputTokens,
    confidence: 95, latency: 1.2,
    promptVersion: null, modelUsed: "gpt-4",
    knowledgeSources: [], productsUsed: [],
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function getCustomerProfile(id: string): Promise<CustomerProfile> {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!conv) throw new Error("Conversation not found");
  const c = conv.customer;
  return {
    id: c.id, name: c.name, email: c.email,
    phone: null, location: null, device: null, browser: null, ip: null,
    firstSeen: c.firstSeen.toISOString(), lastSeen: c.lastSeen.toISOString(),
    totalConversations: 1, totalOrders: 0, lifetimeValue: 0,
    returning: false, currentPage: null, productsViewed: [],
    sessionDuration: 0,
  };
}

export async function getReplay(id: string): Promise<ConversationEventItem[]> {
  const events = await prisma.conversationEvent.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  return events.map((e) => ({
    id: e.id, type: e.type,
    data: e.data as Record<string, unknown>,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function exportConversation(id: string, format: string, adminId: string): Promise<{ content: string; filename: string; type: string }> {
  const conv = await getConversationDetail(id);
  const header = `Conversation: ${conv.id}\nMerchant: ${conv.merchant.name}\nCustomer: ${conv.customer.name ?? conv.customer.email}\nStatus: ${conv.status}\nIntent: ${conv.intent}\nQuality: ${conv.qualityScore}/100\n\n`;

  if (format === "json") {
    return { content: JSON.stringify(conv, null, 2), filename: `conversation-${id}.json`, type: "application/json" };
  }

  const csvRows = [["Role", "Message", "Confidence", "Tokens", "Time"].join(",")];
  for (const m of conv.messages) {
    csvRows.push([m.role, `"${m.content.replace(/"/g, '""')}"`, m.confidence, m.inputTokens + m.outputTokens, new Date(m.createdAt).toISOString()].join(","));
  }

  await logAudit(adminId, "conversation_exported", "conversation", id, { format });

  return {
    content: format === "csv" ? csvRows.join("\n") : header + conv.messages.map((m) => `[${m.role.toUpperCase()}] ${m.content}`).join("\n\n"),
    filename: `conversation-${id}.${format === "csv" ? "csv" : "txt"}`,
    type: format === "csv" ? "text/csv" : "text/plain",
  };
}

export async function joinConversation(id: string, adminId: string): Promise<void> {
  await prisma.conversation.update({ where: { id }, data: { humanJoined: true, aiPaused: true } });
  await prisma.conversationEvent.create({
    data: { conversationId: id, type: "human.joined", data: { adminId } },
  });
  await logAudit(adminId, "conversation_joined", "conversation", id);
}

export async function resumeAI(id: string, adminId: string): Promise<void> {
  await prisma.conversation.update({ where: { id }, data: { aiPaused: false } });
  await prisma.conversationEvent.create({
    data: { conversationId: id, type: "ai.resumed", data: { adminId } },
  });
  await logAudit(adminId, "conversation_ai_resumed", "conversation", id);
}

export async function addTag(id: string, tag: string, adminId: string): Promise<string[]> {
  const conv = await prisma.conversation.findUnique({ where: { id }, select: { tags: true } });
  if (!conv) throw new Error("Conversation not found");
  const tags = new Set<string>((conv.tags as string[]) ?? []);
  tags.add(tag);
  const arr = Array.from(tags);
  await prisma.conversation.update({ where: { id }, data: { tags: arr as any } });
  await logAudit(adminId, "conversation_tagged", "conversation", id, { tag });
  return arr;
}

export async function removeTag(id: string, tag: string, adminId: string): Promise<string[]> {
  const conv = await prisma.conversation.findUnique({ where: { id }, select: { tags: true } });
  if (!conv) throw new Error("Conversation not found");
  const tags = ((conv.tags as string[]) ?? []).filter((t) => t !== tag);
  await prisma.conversation.update({ where: { id }, data: { tags: tags as any } });
  return tags;
}

export function getAIReasoning(conv: { intent: string; aiConfidence: number }): AIReasoning {
  return {
    intent: conv.intent,
    knowledgeSources: [{ title: "Product Catalog" }, { title: "Shipping Policy" }],
    productsConsidered: [{ name: "Product A", price: 25000 }, { name: "Product B", price: 35000 }],
    productsRanked: [{ name: "Product A", score: 92 }, { name: "Product B", score: 78 }],
    recommended: { name: "Product A", reason: "Matches customer budget and preferences" },
    confidence: conv.aiConfidence,
  };
}

export function getRecommendationData(): RecommendationData {
  return {
    productsConsidered: ["Vitamin C Serum", "Niacinamide Serum", "Hyaluronic Acid"],
    productsRanked: ["Vitamin C Serum", "Niacinamide Serum", "Hyaluronic Acid"],
    productSent: "Vitamin C Serum",
    customerClicked: true,
    purchased: false,
  };
}
