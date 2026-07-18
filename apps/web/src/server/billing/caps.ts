import prisma from "@/lib/prisma";

/**
 * Generalizes the org -> subscription -> plan resolution already used by
 * getUsageStatus (usage.ts) into a shared helper for the OTHER plan caps
 * (knowledge entries, products) so they don't each duplicate the query and
 * drift on how -1/"unlimited" is handled.
 */

export const UNLIMITED = -1;

export interface PlanCaps {
  planCode: string;
  monthlyMessageCap: number;
  productCap: number;
  knowledgeCap: number;
}

const STARTER_DEFAULT_CAPS: Omit<PlanCaps, "planCode"> = {
  monthlyMessageCap: 0,
  productCap: 0,
  knowledgeCap: 0,
};

export async function getPlanCaps(orgId: string): Promise<PlanCaps> {
  const sub = await prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } });
  if (!sub) return { planCode: "starter", ...STARTER_DEFAULT_CAPS };
  return {
    planCode: sub.plan.code,
    monthlyMessageCap: sub.plan.monthlyMessageCap,
    productCap: sub.plan.productCap,
    knowledgeCap: sub.plan.knowledgeCap,
  };
}

export function isUnlimited(cap: number): boolean {
  return cap === UNLIMITED;
}

/** How many more of something the org can create against a cap — Infinity
 *  when unlimited, never negative when already over. */
export function remainingBudget(current: number, cap: number): number {
  if (isUnlimited(cap)) return Infinity;
  return Math.max(0, cap - current);
}
