import { NextRequest, NextResponse } from "next/server";
import { getInfraDashboard, listMetrics, listDeployments, listScheduledTasks } from "@/lib/infra/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") return NextResponse.json(await getInfraDashboard());
  if (sp.get("type") === "deployments") {
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    return NextResponse.json(await listDeployments({ service: sp.get("service") || undefined, environment: sp.get("environment") || undefined, status: sp.get("status") || undefined, page, limit }));
  }
  if (sp.get("type") === "tasks") return NextResponse.json(await listScheduledTasks(sp.get("taskType") || undefined));
  return NextResponse.json(await listMetrics({ type: sp.get("metricType") || undefined, hours: Number(sp.get("hours")) || undefined }));
}
