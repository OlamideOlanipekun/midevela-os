import type { SubscriptionStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

const TRIAL_DAYS = 14;
/** New orgs trial on Growth rather than Starter — lets them see the
 *  full product during the trial, a common SaaS default. Founder's
 *  call to revisit if a different default is wanted. */
const TRIAL_PLAN_CODE = "growth";

const STATUS_MAP: Record<SubscriptionStatus, string> = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

export interface SubscriptionResponse {
  plan: string;
  status: string;
  gracePeriodDaysRemaining: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

const GRACE_PERIOD_DAYS = 7;

/**
 * What a given (already effective) status is allowed to do. The single
 * place the access rule lives — routes and the widget must consult this
 * rather than re-deriving "is this org allowed" from raw status strings.
 *   full      → trialing / active: unrestricted
 *   read_only → past_due: reads allowed, writes blocked (dunning grace)
 *   locked    → expired / cancelled: no access
 */
export type AccessLevel = "full" | "read_only" | "locked";

export function accessLevelFor(status: string): AccessLevel {
  if (status === "past_due") return "read_only";
  if (status === "expired" || status === "cancelled") return "locked";
  return "full";
}

function daysRemaining(from: Date): number {
  const ms = from.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** No Subscription row (shouldn't happen post-onboarding, but a
 *  pre-existing org from before billing existed could lack one) reads
 *  as "expired" rather than the old prototype's always-unlocked mock. */
export async function getSubscriptionForOrg(orgId: string): Promise<SubscriptionResponse> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });

  if (!sub) {
    return { plan: "starter", status: "expired", gracePeriodDaysRemaining: 0, trialEndsAt: null, currentPeriodEnd: null };
  }

  const now = Date.now();
  let effectiveStatus = sub.status;

  // A trial that has run out reads as expired.
  if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt.getTime() < now) {
    effectiveStatus = "EXPIRED";
  }

  // A paid period that has lapsed with no renewal is not "active" — it
  // drops into the past-due grace window first, then hard-expires. Without
  // this a single successful payment would read as active forever.
  if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now) {
    const graceEnd = sub.currentPeriodEnd.getTime() + GRACE_PERIOD_DAYS * 86400000;
    effectiveStatus = now < graceEnd ? "PAST_DUE" : "EXPIRED";
  }

  return {
    plan: sub.plan.code,
    status: STATUS_MAP[effectiveStatus],
    gracePeriodDaysRemaining:
      effectiveStatus === "PAST_DUE" && sub.currentPeriodEnd
        ? daysRemaining(new Date(sub.currentPeriodEnd.getTime() + GRACE_PERIOD_DAYS * 86400000))
        : 0,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  };
}

/** Called once, at onboarding. */
export async function createTrialSubscription(orgId: string) {
  const plan = await prisma.plan.findUnique({ where: { code: TRIAL_PLAN_CODE } });
  if (!plan) throw new Error(`Trial plan "${TRIAL_PLAN_CODE}" not seeded.`);

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000);
  await prisma.subscription.create({
    data: { orgId, planId: plan.id, status: "TRIALING", trialEndsAt },
  });
}

/**
 * Called only from the verified Paystack webhook handler — never from
 * a client-facing route. currentPeriodEnd is derived from the
 * transaction's own paidAt timestamp (not wall-clock "now") so a
 * duplicate webhook delivery for the same charge is idempotent rather
 * than silently extending the period twice.
 */
export async function activateSubscriptionFromPayment(params: {
  orgId: string;
  planCode: string;
  paystackCustomerCode: string | null;
  paidAt: Date;
}) {
  const plan = await prisma.plan.findUnique({ where: { code: params.planCode } });
  if (!plan) throw new Error(`Unknown plan code from webhook metadata: ${params.planCode}`);

  const currentPeriodEnd = new Date(params.paidAt.getTime() + 30 * 86400000);

  await prisma.subscription.upsert({
    where: { orgId: params.orgId },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      paystackCustomerCode: params.paystackCustomerCode ?? undefined,
      currentPeriodEnd,
    },
    create: {
      orgId: params.orgId,
      planId: plan.id,
      status: "ACTIVE",
      paystackCustomerCode: params.paystackCustomerCode ?? undefined,
      currentPeriodEnd,
    },
  });
}
