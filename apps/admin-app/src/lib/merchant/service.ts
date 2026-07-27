import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auth/audit";
import { signAccessToken } from "@/lib/auth/jwt";
import { buildMerchantWhere, buildMerchantOrderBy } from "./search";
import { getMerchantAnalytics } from "./analytics";
import type {
  MerchantListItem, MerchantListResponse, MerchantDetail, MerchantFilters,
  MerchantHealth, MerchantAIData, MerchantConversationData, MerchantBilling,
  MerchantUsage, MerchantNoteItem, MerchantActivityItem,
} from "./types";

function calcHealth(org: { websites: unknown[]; _count: { knowledgeEntries: number; conversations: number } }, sub?: { status: string } | null): MerchantHealth {
  const websiteScore = org.websites.length > 0 ? 95 : 50;
  const aiScore = org._count.conversations > 0 ? 90 : 70;
  const knowledgeScore = org._count.knowledgeEntries > 0 ? 90 : 40;
  const billingScore = sub?.status === "ACTIVE" ? 100 : sub?.status === "PAST_DUE" ? 50 : 30;
  const convScore = org._count.conversations > 0 ? 85 : 60;
  const crawlerScore = org.websites.length > 0 ? 85 : 50;
  const usageScore = 90;
  const score = Math.round([websiteScore, aiScore, knowledgeScore, billingScore, convScore, crawlerScore, usageScore].reduce((a, b) => a + b, 0) / 7);
  const label = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Needs attention";
  return { score, label, website: websiteScore, ai: aiScore, knowledge: knowledgeScore, billing: billingScore, conversations: convScore, crawler: crawlerScore, usage: usageScore };
}

export async function listMerchants(
  page: number,
  limit: number,
  filters: MerchantFilters
): Promise<MerchantListResponse> {
  const where = buildMerchantWhere(filters);
  const orderBy = buildMerchantOrderBy(filters.sort, filters.order);
  const skip = (page - 1) * limit;

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        subscription: { include: { plan: true } },
        users: { where: { role: "owner" }, take: 1, select: { email: true, name: true } },
        _count: { select: { conversations: true, products: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  const items: MerchantListItem[] = orgs.map((o) => {
    const owner = o.users[0];
    const sub = o.subscription;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      websiteUrl: o.websiteUrl,
      logoUrl: o.logoUrl,
      country: o.country,
      plan: sub?.plan.name ?? null,
      planCode: sub?.plan.code ?? null,
      status: (sub?.status ?? "trialing") as MerchantListItem["status"],
      health: 0,
      conversations: o._count.conversations,
      revenue: 0,
      createdAt: o.createdAt.toISOString(),
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.name ?? null,
    };
  });

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getMerchantDetail(orgId: string): Promise<MerchantDetail> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: { include: { plan: true } },
      websites: true,
      users: { where: { role: "owner" }, take: 1 },
      _count: { select: { products: true, knowledgeEntries: true, conversations: true, customers: true } },
    },
  });

  if (!org) throw new Error("Merchant not found");

  const messageCount = await prisma.message.count({
    where: { conversation: { orgId } },
  });

  const sub = org.subscription;
  const owner = org.users[0];

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    websiteUrl: org.websiteUrl,
    logoUrl: org.logoUrl,
    industry: org.industry,
    country: org.country,
    currency: org.currency,
    settings: org.settings as Record<string, unknown>,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    owner: owner ? { id: owner.id, email: owner.email, name: owner.name, lastLoginAt: owner.lastLoginAt?.toISOString() ?? null } : null,
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      planName: sub.plan.name,
      planCode: sub.plan.code,
      priceMonthly: Number(sub.plan.priceMonthly),
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(),
    } : null,
    websites: org.websites.map((w) => ({
      id: w.id,
      normalizedUrl: w.normalizedUrl,
      status: w.status,
      crawlStatus: w.crawlStatus,
      lastCrawledAt: w.lastCrawledAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
    products: org._count.products,
    knowledgeEntries: org._count.knowledgeEntries,
    conversations: org._count.conversations,
    customers: org._count.customers,
    messages: messageCount,
    health: calcHealth(org, sub),
  };
}

export async function getAIData(orgId: string): Promise<MerchantAIData> {
  const conversations = await prisma.conversation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      messages: { where: { role: "AI" }, take: 3, orderBy: { createdAt: "desc" }, select: { content: true, createdAt: true } },
    },
  });

  const total = conversations.length;
  const avgConfidence = total > 0 ? Math.round(conversations.reduce((s, c) => s + c.aiConfidence, 0) / total) : 0;
  const escalated = conversations.filter((c) => c.status === "HANDED_OFF").length;
  const resolved = conversations.filter((c) => c.outcome === "RESOLVED").length;

  const failures = conversations
    .filter((c) => c.aiConfidence < 60)
    .slice(0, 10)
    .map((c) => {
      const lastAiMsg = c.messages[0];
      return {
        id: c.id,
        query: lastAiMsg?.content?.slice(0, 120) ?? "Unknown",
        reason: `Low confidence (${c.aiConfidence}%)`,
        date: c.createdAt.toISOString(),
      };
    });

  return {
    avgConfidence,
    hallucinationRate: 0.3,
    responseTime: 1.1,
    knowledgeCoverage: 85,
    escalations: escalated,
    fallbackRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
    failures,
  };
}

export async function getConversationData(orgId: string, limit = 20): Promise<MerchantConversationData> {
  const conversations = await prisma.conversation.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      customer: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  const total = await prisma.conversation.count({ where: { orgId } });
  const resolved = conversations.filter((c) => c.outcome === "RESOLVED").length;
  const escalated = conversations.filter((c) => c.status === "HANDED_OFF").length;
  const avgLength = total > 0 ? Math.round(conversations.reduce((s, c) => s + c._count.messages, 0) / total) : 0;
  const completed = conversations.filter((c) => c.outcome === "PURCHASED" || c.outcome === "RESOLVED").length;
  const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const recent = conversations.slice(0, 10).map((c) => ({
    id: c.id,
    customerName: c.customer.name,
    customerEmail: c.customer.email,
    started: c.createdAt.toISOString(),
    ended: null,
    intent: c.intent,
    status: c.status,
    outcome: c.outcome,
  }));

  return {
    total,
    resolved,
    escalated,
    avgLength,
    avgResponseTime: 1.1,
    conversionRate,
    recent,
  };
}

export async function getBillingData(orgId: string): Promise<MerchantBilling> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });

  if (!sub) throw new Error("No subscription found");

  return {
    plan: { name: sub.plan.name, code: sub.plan.code, priceMonthly: Number(sub.plan.priceMonthly), currency: sub.plan.currency },
    status: sub.status,
    renewal: sub.currentPeriodEnd?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    invoices: [],
    paymentMethod: null,
    subscriptionId: sub.id,
  };
}

export async function getUsageData(orgId: string): Promise<MerchantUsage> {
  const usage = await prisma.merchantUsage.findUnique({ where: { orgId } });
  const productCount = await prisma.product.count({ where: { orgId } });

  const messages = usage?.messagesMonth ?? 0;
  const messagesLimit = 10000;
  const products = productCount;
  const productsLimit = 500;
  const files = usage?.knowledgeFiles ?? 0;
  const filesLimit = 200;
  const storageBytes = Number(usage?.storageBytes ?? 0);
  const storageLimitBytes = 1_073_741_824;
  const apiCalls = usage?.apiCallsMonth ?? 0;
  const apiCallsLimit = 50000;
  const embeddings = usage?.embeddingsTotal ?? 0;
  const embeddingsLimit = 100000;
  const crawlerMin = usage?.crawlerMinutes ?? 0;
  const crawlerMinLimit = 500;

  return {
    messages: { used: messages, limit: messagesLimit },
    products: { used: products, limit: productsLimit },
    knowledgeFiles: { used: files, limit: filesLimit },
    storage: { bytes: storageBytes, formatted: formatBytes(storageBytes), limitBytes: storageLimitBytes, limitFormatted: formatBytes(storageLimitBytes) },
    apiCalls: { total: usage?.apiCallsTotal ?? 0, thisMonth: apiCalls, limit: apiCallsLimit },
    embeddings: { total: embeddings, limit: embeddingsLimit },
    crawlerMinutes: { used: crawlerMin, limit: crawlerMinLimit },
  };
}

export async function suspendMerchant(orgId: string, adminId: string, reason?: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { settings: { ...(await getSettings(orgId)), suspended: true, suspensionReason: reason ?? null, suspendedAt: new Date().toISOString(), suspendedBy: adminId } },
  });

  await logAudit(adminId, "merchant_suspended", "merchant", orgId, { reason });
}

export async function reactivateMerchant(orgId: string, adminId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { settings: { ...(await getSettings(orgId)), suspended: false, suspensionReason: null, suspendedAt: null, suspendedBy: null } },
  });

  await logAudit(adminId, "merchant_reactivated", "merchant", orgId);
}

export async function softDeleteMerchant(orgId: string, adminId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { settings: { ...(await getSettings(orgId)), deleted: true, deletedAt: new Date().toISOString(), deletedBy: adminId } },
  });

  await logAudit(adminId, "merchant_deleted", "merchant", orgId);
}

export async function loginAsMerchant(orgId: string, adminId: string): Promise<{ token: string; expiresIn: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error("Merchant not found");

  const token = signAccessToken({ sub: `imp-${org.id}`, email: "impersonation@midevela.app", roles: [], permissions: [] });

  await logAudit(adminId, "merchant_login_as", "merchant", orgId);

  return { token, expiresIn: 900 };
}

async function getSettings(orgId: string): Promise<Record<string, unknown>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  return (org?.settings as Record<string, unknown>) ?? {};
}

// ── Notes ──

export async function getNotes(orgId: string): Promise<MerchantNoteItem[]> {
  const notes = await prisma.merchantNote.findMany({
    where: { orgId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { admin: { select: { firstName: true } } },
  });
  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    pinned: n.pinned,
    adminName: n.admin?.firstName ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
}

export async function createNote(orgId: string, adminId: string, content: string, pinned = false): Promise<MerchantNoteItem> {
  const note = await prisma.merchantNote.create({
    data: { orgId, adminId, content, pinned },
    include: { admin: { select: { firstName: true } } },
  });

  await logAudit(adminId, "merchant_note_added", "merchant", orgId);

  return {
    id: note.id,
    content: note.content,
    pinned: note.pinned,
    adminName: note.admin?.firstName ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function deleteNote(noteId: string, adminId: string): Promise<void> {
  await prisma.merchantNote.delete({ where: { id: noteId } });
}

export async function togglePinNote(noteId: string): Promise<void> {
  const note = await prisma.merchantNote.findUnique({ where: { id: noteId }, select: { pinned: true } });
  if (note) {
    await prisma.merchantNote.update({ where: { id: noteId }, data: { pinned: !note.pinned } });
  }
}

// ── Activity ──

export async function getActivity(orgId: string, limit = 50): Promise<MerchantActivityItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: { targetId: orgId, module: "merchant" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { firstName: true } } },
  });

  return logs.map((l) => ({
    id: l.id,
    time: l.createdAt.toISOString(),
    action: l.action,
    adminName: l.admin?.firstName ?? null,
    metadata: l.metadata as Record<string, unknown>,
  }));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
