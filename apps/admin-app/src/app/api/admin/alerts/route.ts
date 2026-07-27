import { NextRequest, NextResponse } from "next/server";
import { getAlertDashboard, listAlerts } from "@/lib/alerts/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") {
    const data = await getAlertDashboard();
    return NextResponse.json(data);
  }
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listAlerts({
    severity: sp.get("severity") || undefined,
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    orgId: sp.get("orgId") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
