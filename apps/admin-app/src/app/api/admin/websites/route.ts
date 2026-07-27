import { NextRequest, NextResponse } from "next/server";
import { listWebsites, addWebsite } from "@/lib/websites/service";
import { requireAdmin } from "@/lib/middleware/admin-guard";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listWebsites({
    search: sp.get("search") || undefined,
    status: sp.get("status") || undefined,
    health: sp.get("health") || undefined,
    crawler: sp.get("crawler") || undefined,
    merchant: sp.get("merchant") || undefined,
    ssl: sp.get("ssl") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json();
    const data = await addWebsite(body.orgId, body.url, admin.sub);
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
