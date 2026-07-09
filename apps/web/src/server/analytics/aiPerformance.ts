import prisma from "@/lib/prisma";
import { FALLBACK_REPLY_TEXT } from "@/server/conversation/engine";

/**
 * Same honesty rule as analytics.ts: only report what's actually
 * computable. The original mock's "Escalation Rate" and "AI Sales
 * Conversion" have no backing signal at all — there's no human-handoff
 * tracking and no order/checkout tracking anywhere in the schema — so
 * they're not reproduced here, not faked. "AI Resolution Rate" is
 * replaced by "fallback rate": the real, measurable rate at which the
 * model's structured output failed to parse twice and the engine had
 * to serve its safe fallback reply. That's a narrower, more honest
 * claim than "resolution" (it measures generation failures, not
 * whether the customer's issue actually got resolved) — labeled
 * accordingly in the UI.
 *
 * Response time is genuinely real: customer message -> the immediately
 * following AI message in the same conversation are always created in
 * the same HTTP request by the widget route, so the delta is a true
 * end-to-end latency measurement (embedding + retrieval + LLM call).
 * A 120s sanity cap guards against the one edge case where that
 * pairing breaks: a request that persisted the customer message but
 * failed before persisting the AI reply, leaving it to get paired with
 * a much later, unrelated message.
 */

const RESPONSE_TIME_CAP_SECONDS = 120;

interface MessageRow {
  conversationId: string;
  role: "CUSTOMER" | "AI" | "SYSTEM";
  content: string;
  recommendations: unknown;
  createdAt: Date;
}

export async function getAiPerformanceSummary(orgId: string) {
  const messages = await prisma.message.findMany({
    where: { conversation: { orgId } },
    orderBy: [{ conversationId: "asc" }, { createdAt: "asc" }],
    select: { conversationId: true, role: true, content: true, recommendations: true, createdAt: true },
  });

  const byConversation = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId) ?? [];
    list.push(m);
    byConversation.set(m.conversationId, list);
  }

  const responseTimes: number[] = [];
  let totalAiMessages = 0;
  let recommendedCount = 0;
  let fallbackCount = 0;
  const buckets = { under2: 0, from2to5: 0, from5to10: 0, over10: 0 };

  for (const msgs of byConversation.values()) {
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== "AI") continue;
      totalAiMessages++;

      const recs = Array.isArray(m.recommendations) ? (m.recommendations as unknown[]) : [];
      if (recs.length > 0) recommendedCount++;
      if (m.content.trim() === FALLBACK_REPLY_TEXT) fallbackCount++;

      const prev = msgs[i - 1];
      if (prev && prev.role === "CUSTOMER") {
        const deltaSeconds = (m.createdAt.getTime() - prev.createdAt.getTime()) / 1000;
        if (deltaSeconds >= 0 && deltaSeconds <= RESPONSE_TIME_CAP_SECONDS) {
          responseTimes.push(deltaSeconds);
          if (deltaSeconds < 2) buckets.under2++;
          else if (deltaSeconds < 5) buckets.from2to5++;
          else if (deltaSeconds < 10) buckets.from5to10++;
          else buckets.over10++;
        }
      }
    }
  }

  const avgResponseSeconds = responseTimes.length
    ? Math.round((responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length) * 10) / 10
    : null;

  const bucketTotal = buckets.under2 + buckets.from2to5 + buckets.from5to10 + buckets.over10;
  const pct = (n: number) => (bucketTotal > 0 ? Math.round((n / bucketTotal) * 100) : 0);

  return {
    avgResponseSeconds,
    totalAiMessages,
    recommendationRatePct: totalAiMessages > 0 ? Math.round((recommendedCount / totalAiMessages) * 100) : 0,
    fallbackRatePct: totalAiMessages > 0 ? Math.round((fallbackCount / totalAiMessages) * 100) : 0,
    responseTimeBuckets: [
      { label: "< 2s", count: buckets.under2, pct: pct(buckets.under2) },
      { label: "2–5s", count: buckets.from2to5, pct: pct(buckets.from2to5) },
      { label: "5–10s", count: buckets.from5to10, pct: pct(buckets.from5to10) },
      { label: "> 10s", count: buckets.over10, pct: pct(buckets.over10) },
    ],
  };
}
