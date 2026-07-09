import type { BuyingStage } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Every number here is computed from real Conversation/Customer/Message
 * rows — no invented metrics. Several things the original mock UI showed
 * (AI-influenced revenue, conversion rate, average order value, a 7-day
 * revenue chart) have NO backing data model at all yet — there's no
 * Order/Purchase tracking in the schema, so those are not reproduced
 * here rather than faked. This intentionally reshapes what the page
 * reports around what's real today; revenue-based analytics is a later
 * phase once checkout/order tracking exists.
 */

const INTENT_LABELS: Record<string, string> = {
  greeting: "Greeting",
  discovery: "Product discovery",
  comparison: "Specs comparison",
  purchase_ready: "Purchase intent",
  objection: "Objection handling",
  support: "Support & FAQs",
  unknown: "Unclassified",
};

const INTENT_COLORS: Record<string, string> = {
  greeting: "var(--teal-bright)",
  discovery: "var(--teal)",
  comparison: "var(--blue)",
  purchase_ready: "var(--amber)",
  objection: "var(--rust)",
  support: "var(--ink-soft)",
  unknown: "var(--ink-soft)",
};

const STAGE_LABELS: Record<BuyingStage, string> = {
  EXPLORING: "Exploring",
  COMPARING: "Comparing",
  PURCHASE_READY: "Purchase ready",
  PURCHASED: "Purchased",
};
const STAGE_ORDER: BuyingStage[] = ["EXPLORING", "COMPARING", "PURCHASE_READY", "PURCHASED"];

interface RecommendationJson {
  id?: string;
  name: string;
}

export async function getAnalyticsSummary(orgId: string) {
  const [
    totalConversations,
    totalCustomers,
    conversations,
    stageGroups,
    intentGroups,
    aiMessages,
    dailyRows,
  ] = await Promise.all([
    prisma.conversation.count({ where: { orgId } }),
    prisma.customer.count({ where: { orgId } }),
    prisma.conversation.findMany({ where: { orgId }, select: { aiConfidence: true } }),
    prisma.customer.groupBy({ by: ["buyingStage"], where: { orgId }, _count: true }),
    prisma.conversation.groupBy({ by: ["intent"], where: { orgId }, _count: true }),
    prisma.message.findMany({
      where: { role: "AI", conversation: { orgId } },
      select: { recommendations: true },
    }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', started_at) AS day, count(*)::bigint AS count
      FROM conversations
      WHERE org_id = ${orgId}::uuid AND started_at >= now() - interval '7 days'
      GROUP BY day
      ORDER BY day
    `,
  ]);

  const avgConfidence = conversations.length
    ? Math.round(
        conversations.reduce((sum, c) => sum + c.aiConfidence, 0) / conversations.length
      )
    : 0;

  // Buying-stage funnel — the real equivalent of the old mock's
  // visitor/engaged/purchased funnel, using the stage Midevela actually
  // tracks per customer.
  const stageCounts = new Map<BuyingStage, number>(
    stageGroups.map((g) => [g.buyingStage, g._count])
  );
  const funnelStages = STAGE_ORDER.map((stage) => ({
    label: STAGE_LABELS[stage],
    count: stageCounts.get(stage) ?? 0,
  }));
  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.count));

  // Intent distribution, sorted by volume, zero-count intents omitted.
  const intentTotal = intentGroups.reduce((sum, g) => sum + g._count, 0);
  const intentSegments = intentGroups
    .filter((g) => g._count > 0)
    .map((g) => ({
      label: INTENT_LABELS[g.intent] ?? g.intent,
      color: INTENT_COLORS[g.intent] ?? "var(--ink-soft)",
      pct: intentTotal > 0 ? Math.round((g._count / intentTotal) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Recommendation frequency per product, aggregated in JS — fine at
  // current message volumes; revisit with a proper SQL aggregate if
  // this ever becomes a hot path.
  const recommendationCounts = new Map<string, number>();
  for (const msg of aiMessages) {
    const recs = Array.isArray(msg.recommendations)
      ? (msg.recommendations as unknown as RecommendationJson[])
      : [];
    for (const r of recs) {
      if (!r.name) continue;
      recommendationCounts.set(r.name, (recommendationCounts.get(r.name) ?? 0) + 1);
    }
  }
  const topProducts = [...recommendationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const topProductsMax = Math.max(1, ...topProducts.map((p) => p.count));

  // Last 7 days, zero-filled for days with no conversations.
  const dailyByDate = new Map(
    dailyRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)])
  );
  const dailyConversations: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dailyConversations.push(dailyByDate.get(d.toISOString().slice(0, 10)) ?? 0);
  }

  return {
    totalConversations,
    totalCustomers,
    avgConfidence,
    topIntent: intentSegments[0] ?? null,
    funnelStages: funnelStages.map((s) => ({ ...s, widthPct: Math.round((s.count / funnelMax) * 100) })),
    intentSegments,
    topProducts: topProducts.map((p) => ({ ...p, widthPct: Math.round((p.count / topProductsMax) * 100) })),
    dailyConversations,
  };
}
