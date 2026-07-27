import { NextRequest, NextResponse } from "next/server";
import { getAuditDashboard, listAuditLogs } from "@/lib/audit/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") {
    const data = await getAuditDashboard();
    return NextResponse.json(data);
  }
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 30));
  const data = await listAuditLogs({
    search: sp.get("search") || undefined,
    action: sp.get("action") || undefined,
    module: sp.get("module") || undefined,
    adminId: sp.get("adminId") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
