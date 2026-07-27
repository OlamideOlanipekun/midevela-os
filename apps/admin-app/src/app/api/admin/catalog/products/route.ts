import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@/lib/catalog/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listProducts({
    orgId: sp.get("orgId") || undefined,
    search: sp.get("search") || undefined,
    category: sp.get("category") || undefined,
    status: sp.get("status") || undefined,
    minPrice: sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined,
    maxPrice: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined,
    inStock: sp.get("inStock") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
