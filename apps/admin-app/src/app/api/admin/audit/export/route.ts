import { NextRequest, NextResponse } from "next/server";
import { getComplianceReport } from "@/lib/audit/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const report = await getComplianceReport(
    sp.get("type") || "audit_log",
    sp.get("dateFrom") || undefined,
    sp.get("dateTo") || undefined,
  );
  return NextResponse.json(report);
}
