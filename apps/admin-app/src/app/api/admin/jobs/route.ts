import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/queue/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listJobs({
    queue: sp.get("queue") || undefined,
    status: sp.get("status") || undefined,
    type: sp.get("type") || undefined,
    orgId: sp.get("orgId") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
