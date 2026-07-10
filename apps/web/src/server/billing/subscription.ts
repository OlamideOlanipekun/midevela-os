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

  let effectiveStatus = sub.status;
  if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) {
    effectiveStatus = "EXPIRED";
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
