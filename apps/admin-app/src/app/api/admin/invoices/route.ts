import { NextRequest, NextResponse } from "next/server";
import { listInvoices } from "@/lib/billing/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listInvoices({ orgId: sp.get("orgId") || undefined, status: sp.get("status") || undefined, page, limit });
  return NextResponse.json(data);
}
