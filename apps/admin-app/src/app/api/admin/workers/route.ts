import { NextRequest, NextResponse } from "next/server";
import { getWorkerHealth, listWorkerLogs } from "@/lib/queue/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("logs") === "true") {
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    const data = await listWorkerLogs({ worker: sp.get("worker") || undefined, jobId: sp.get("jobId") || undefined, page, limit });
    return NextResponse.json(data);
  }
  const health = await getWorkerHealth();
  return NextResponse.json(health);
}
