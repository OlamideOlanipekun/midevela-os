import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { initializeTransaction } from "@/server/billing/paystack";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { user, org } = await requireOrg();
    const body = await req.json();
    const planCode = body?.planCode;
    if (typeof planCode !== "string" || !planCode) {
      return jsonError(400, "planCode is required.");
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.active) {
      return jsonError(404, "Plan not found.");
    }
    // Recurring billing requires the tier to be backed by a Paystack Plan.
    if (!plan.paystackPlanCode) {
      return jsonError(409, "This plan isn't available for checkout yet. Please contact support.");
    }

    const origin = new URL(req.url).origin;
    const result = await initializeTransaction({
      email: user.email,
      amountKobo: Math.round(Number(plan.priceMonthly) * 100),
      metadata: { orgId: org.id, planCode: plan.code },
      callbackUrl: `${origin}/dashboard/billing?checkout=complete`,
      // Subscription-backed: Paystack auto-charges this plan each interval.
      planCode: plan.paystackPlanCode,
    });

    return NextResponse.json({ authorizationUrl: result.authorizationUrl });
  });
}
