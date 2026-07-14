import type { BuyingStage, Channel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { shortRelativeTime } from "@/server/shared/time";

/**
 * Real workspace overview for the dashboard home. Every figure is derived
 * from actual Conversation/Customer/Message/Product rows.
 *
 * What this deliberately does NOT report: revenue, conversion rate,
 * AI-influenced revenue, lost revenue, "buying confidence". Those need an
 * Order/checkout data model that doesn't exist yet — the schema tracks
 * conversations and customers, not sales — so they are omitted rather than
 * invented. (The old page hard-coded them and even ran a fake "live feed"
 * simulator; both are gone.)
 */

const STAGE_LABELS: Record<BuyingStage, string> = {
  EXPLORING: "Exploring",
  COMPARING: "Comparing",
  PURCHASE_READY: "Purchase ready",
  PURCHASED: "Purchased",
};
const STAGE_ORDER: BuyingStage[] = ["EXPLORING", "COMPARING", "PURCHASE_READY", "PURCHASED"];

const CHANNEL_LABELS: Record<Channel, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  EMAIL: "Email",
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export interface DashboardOverview {
  kpis: Array<{ label: string; value: string; sub: string }>;
  activeConversations: number;
  funnel: Array<{ label: string; count: number; widthPct: number }>;
  dailyConversations: number[];
  avgConfidence: number;
  recentActivity: Array<{ id: string; name: string; text: string; meta: string; color: string }>;
  insights: Array<{ tag: string; text: string; action: string; href: string }>;
}

export async function getDashboardOverview(orgId: string): Promise<DashboardOverview> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    totalConversations,
    conversationsToday,
    activeConversations,
    handedOff,
    totalCustomers,
    customersToday,
    purchaseReady,
    aiMessages,
    stageGroups,
    confidenceRows,
    productCount,
    knowledgeCount,
    dailyRows,
    recent,
  ] = await Promise.all([
    prisma.conversation.count({ where: { orgId } }),
    prisma.conversation.count({ where: { orgId, startedAt: { gte: startOfToday } } }),
    prisma.conversation.count({ where: { orgId, status: "ACTIVE" } }),
    prisma.conversation.count({ where: { orgId, status: "HANDED_OFF" } }),
    prisma.customer.count({ where: { orgId } }),
    prisma.customer.count({ where: { orgId, firstSeen: { gte: startOfToday } } }),
    prisma.customer.count({ where: { orgId, buyingStage: "PURCHASE_READY" } }),
    prisma.message.count({ where: { role: "AI", conversation: { orgId } } }),
    prisma.customer.groupBy({ by: ["buyingStage"], where: { orgId }, _count: true }),
    prisma.conversation.findMany({ where: { orgId }, select: { aiConfidence: true } }),
    prisma.product.count({ where: { orgId } }),
    prisma.knowledgeEntry.count({ where: { orgId } }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', started_at) AS day, count(*)::bigint AS count
      FROM conversations
      WHERE org_id = ${orgId}::uuid AND started_at >= now() - interval '7 days'
      GROUP BY day
      ORDER BY day
    `,
    prisma.conversation.findMany({
      where: { orgId },
      orderBy: { startedAt: "desc" },
      take: 6,
      include: {
        customer: { select: { name: true, buyingStage: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      },
    }),
  ]);

  const avgConfidence = confidenceRows.length
    ? Math.round(confidenceRows.reduce((s, c) => s + c.aiConfidence, 0) / confidenceRows.length)
    : 0;

  // Buying-stage funnel (real equivalent of the old mock visitor funnel).
  const stageCounts = new Map<BuyingStage, number>(stageGroups.map((g) => [g.buyingStage, g._count]));
  const funnelRaw = STAGE_ORDER.map((stage) => ({ label: STAGE_LABELS[stage], count: stageCounts.get(stage) ?? 0 }));
  const funnelMax = Math.max(1, ...funnelRaw.map((s) => s.count));
  const funnel = funnelRaw.map((s) => ({ ...s, widthPct: Math.round((s.count / funnelMax) * 100) }));

  // Last 7 days of conversations, zero-filled.
  const dailyByDate = new Map(dailyRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const dailyConversations: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dailyConversations.push(dailyByDate.get(d.toISOString().slice(0, 10)) ?? 0);
  }

  // Real recent activity — the most recent conversations, never simulated.
  const recentActivity = recent.map((c) => {
    const latest = c.messages[0]?.content;
    const color =
      c.status === "HANDED_OFF"
        ? "rust"
        : c.customer.buyingStage === "PURCHASE_READY" || c.customer.buyingStage === "PURCHASED"
          ? "amber"
          : "teal";
    return {
      id: c.id,
      name: c.customer.name || "Anonymous visitor",
      text: latest ? truncate(latest, 70) : "started a conversation",
      meta: `${shortRelativeTime(c.startedAt)} · ${CHANNEL_LABELS[c.channel]}`,
      color,
    };
  });

  const kpis = [
    { label: "Conversations", value: String(totalConversations), sub: `${conversationsToday} today` },
    { label: "Customers", value: String(totalCustomers), sub: `${customersToday} new today` },
    { label: "Active now", value: String(activeConversations), sub: "live conversations" },
    { label: "Purchase-ready", value: String(purchaseReady), sub: "customers to follow up" },
    { label: "AI replies", value: String(aiMessages), sub: "messages handled" },
    { label: "AI confidence", value: `${avgConfidence}%`, sub: "avg across chats" },
  ];

  // Insights are DERIVED from real signals — modest, truthful nudges, not
  // fabricated "AI recommendations".
  const insights: DashboardOverview["insights"] = [];
  if (totalConversations === 0) {
    insights.push({
      tag: "Getting started",
      text: "No conversations yet. Add your widget snippet to your website so shoppers can start chatting.",
      action: "Open widget settings →",
      href: "/dashboard/settings?tab=widget",
    });
  }
  if (purchaseReady > 0) {
    insights.push({
      tag: "Hot leads",
      text: `${purchaseReady} customer${purchaseReady === 1 ? " is" : "s are"} purchase-ready. Follow up before they cool off.`,
      action: "View conversations →",
      href: "/dashboard/conversations",
    });
  }
  if (handedOff > 0) {
    insights.push({
      tag: "Needs a human",
      text: `${handedOff} conversation${handedOff === 1 ? " was" : "s were"} handed off and may be waiting for a reply.`,
      action: "View conversations →",
      href: "/dashboard/conversations",
    });
  }
  if (knowledgeCount === 0) {
    insights.push({
      tag: "Coverage gap",
      text: "Your knowledge base is empty, so the AI can't answer shipping, returns or FAQ questions. Add a few entries.",
      action: "Add knowledge →",
      href: "/dashboard/knowledge",
    });
  }
  if (productCount === 0) {
    insights.push({
      tag: "Coverage gap",
      text: "No products yet — the AI has nothing to recommend. Add or import your catalog.",
      action: "Add products →",
      href: "/dashboard/products",
    });
  }
  if (insights.length === 0) {
    insights.push({
      tag: "All clear",
      text: `${activeConversations} active conversation${activeConversations === 1 ? "" : "s"} and ${totalCustomers} customers tracked. Everything looks healthy.`,
      action: "View analytics →",
      href: "/dashboard/analytics",
    });
  }

  return {
    kpis,
    activeConversations,
    funnel,
    dailyConversations,
    avgConfidence,
    recentActivity,
    insights: insights.slice(0, 3),
  };
}
