import { NextRequest, NextResponse } from "next/server";
import { listSyncJobs, triggerSync } from "@/lib/catalog/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listSyncJobs({
    orgId: sp.get("orgId") || undefined,
    status: sp.get("status") || undefined,
    source: sp.get("source") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const job = await triggerSync(body.orgId, body.source || "manual");
  return NextResponse.json(job, { status: 201 });
}
