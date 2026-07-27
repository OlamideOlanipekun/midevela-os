import { NextRequest, NextResponse } from "next/server";
import { getCatalogHealth } from "@/lib/catalog/service";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || undefined;
  const health = await getCatalogHealth(orgId);
  return NextResponse.json(health);
}
