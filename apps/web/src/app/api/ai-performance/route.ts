import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getAiPerformanceSummary } from "@/server/analytics/aiPerformance";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const summary = await getAiPerformanceSummary(org.id);
    return NextResponse.json(summary);
  });
}
