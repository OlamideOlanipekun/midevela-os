import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getAnalyticsSummary } from "@/server/analytics/analytics";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const summary = await getAnalyticsSummary(org.id);
    return NextResponse.json(summary);
  });
}
