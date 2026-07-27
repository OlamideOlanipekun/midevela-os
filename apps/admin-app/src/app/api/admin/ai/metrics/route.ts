import { NextRequest, NextResponse } from "next/server";
import { getAIMetrics } from "@/lib/ai/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const data = await getAIMetrics({
    orgId: sp.get("orgId") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
  });
  return NextResponse.json(data);
}
