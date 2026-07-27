import { NextRequest, NextResponse } from "next/server";
import { listMerchants } from "@/lib/merchant/service";
import type { MerchantFilters } from "@/lib/merchant/types";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));

  const filters: MerchantFilters = {
    search: sp.get("search") || undefined,
    status: sp.get("status") || undefined,
    plan: sp.get("plan") || undefined,
    country: sp.get("country") || undefined,
    health: sp.get("health") || undefined,
    createdFrom: sp.get("createdFrom") || undefined,
    createdTo: sp.get("createdTo") || undefined,
    sort: sp.get("sort") || undefined,
    order: (sp.get("order") as "asc" | "desc") || "desc",
  };

  const data = await listMerchants(page, limit, filters);
  return NextResponse.json(data);
}
