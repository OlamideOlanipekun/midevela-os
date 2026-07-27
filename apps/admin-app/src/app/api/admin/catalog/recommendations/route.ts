import { NextRequest, NextResponse } from "next/server";
import { getRecommendationRanking } from "@/lib/catalog/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const data = await getRecommendationRanking({
    orgId: sp.get("orgId") || undefined,
    productId: sp.get("productId") || undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json(data);
}
