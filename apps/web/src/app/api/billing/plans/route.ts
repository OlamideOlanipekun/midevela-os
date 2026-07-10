import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { formatMoney } from "@/server/catalog/money";

export async function GET() {
  return withErrorHandling(async () => {
    await requireUser();
    const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { priceMonthly: "asc" } });
    return NextResponse.json({
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        price: formatMoney(p.priceMonthly, p.currency),
        priceMonthly: Number(p.priceMonthly),
      })),
    });
  });
}
