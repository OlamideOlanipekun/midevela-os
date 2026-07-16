import prisma from "@/lib/prisma";

/**
 * Real, per-plan AI usage tracking — closes the gap where Plan.
 * monthlyMessageCap existed in the schema but was never read anywhere,
 * and every org shared one flat abuse ceiling regardless of tier.
 *
 * Message counts are durable in Postgres (UsageRecord), not Redis, because
 * they're the actual billing-relevant number a merchant/founder needs to
 * trust later — Redis stays for the cheap, fail-open, short-window abuse
 * limits (daily/session/global) layered on top in the widget route.
 */

const WARNING_PCT = 75;
const CRITICAL_PCT = 90;
const UNLIMITED = -1;

export type UsageLevel = "ok" | "warning" | "critical" | "exceeded";

export interface UsageStatus {
  planCode: string;
  used: number;
  cap: number; // -1 = unlimited
  unlimited: boolean;
  pct: number; // 0 when unlimited
  level: UsageLevel;
  periodLabel: string; // "2026-07"
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // yyyy-mm
}

/** One AI turn served — durable, org-scoped monthly counter. Best-effort:
 *  a failure here must never break the reply that was already generated. */
export async function recordAiUsage(orgId: string): Promise<void> {
  const period = currentPeriod();
  try {
    await prisma.usageRecord.upsert({
      where: { orgId_metric_period: { orgId, metric: "ai_messages", period } },
      update: { quantity: { increment: 1 } },
      create: { orgId, metric: "ai_messages", period, quantity: 1 },
    });
  } catch (err) {
    console.error("recordAiUsage: failed to record usage (non-fatal):", err);
  }
}

async function getMonthlyMessageCount(orgId: string): Promise<number> {
  const period = currentPeriod();
  const row = await prisma.usageRecord.findUnique({
    where: { orgId_metric_period: { orgId, metric: "ai_messages", period } },
    select: { quantity: true },
  });
  return row?.quantity ?? 0;
}

function levelFor(pct: number, unlimited: boolean): UsageLevel {
  if (unlimited) return "ok";
  if (pct >= 100) return "exceeded";
  if (pct >= CRITICAL_PCT) return "critical";
  if (pct >= WARNING_PCT) return "warning";
  return "ok";
}

/**
 * The org's real plan-based usage this month. Single source of truth for
 * both the widget's enforcement gate and the dashboard's usage display —
 * they must never compute this independently and drift.
 */
export async function getUsageStatus(orgId: string): Promise<UsageStatus> {
  const sub = await prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } });
  const cap = sub?.plan.monthlyMessageCap ?? 0;
  const planCode = sub?.plan.code ?? "starter";
  const unlimited = cap === UNLIMITED;

  const used = await getMonthlyMessageCount(orgId);
  const pct = unlimited || cap <= 0 ? 0 : Math.round((used / cap) * 100);

  return {
    planCode,
    used,
    cap,
    unlimited,
    pct,
    level: levelFor(pct, unlimited),
    periodLabel: currentPeriod(),
  };
}
