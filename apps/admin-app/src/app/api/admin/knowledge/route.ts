import { NextRequest, NextResponse } from "next/server";
import { listDocuments } from "@/lib/knowledge/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listDocuments({
    orgId: sp.get("orgId") || undefined,
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    search: sp.get("search") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
