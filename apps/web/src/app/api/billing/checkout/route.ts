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

    const origin = new URL(req.url).origin;
    const result = await initializeTransaction({
      email: user.email,
      amountKobo: Math.round(Number(plan.priceMonthly) * 100),
      metadata: { orgId: org.id, planCode: plan.code },
      callbackUrl: `${origin}/dashboard/billing?checkout=complete`,
    });

    return NextResponse.json({ authorizationUrl: result.authorizationUrl });
  });
}
