import { NextRequest, NextResponse } from "next/server";
import { getAICosts } from "@/lib/ai/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const data = await getAICosts({
    orgId: sp.get("orgId") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    groupBy: sp.get("groupBy") || undefined,
  });
  return NextResponse.json(data);
}
