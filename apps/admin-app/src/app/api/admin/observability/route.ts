import { NextRequest, NextResponse } from "next/server";
import { getObservabilityDashboard, listFeedback, listExperiments, listMonitorSnapshots } from "@/lib/observability/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") return NextResponse.json(await getObservabilityDashboard());
  if (sp.get("type") === "feedback") {
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
    return NextResponse.json(await listFeedback({ rating: Number(sp.get("rating")) || undefined, category: sp.get("category") || undefined, page, limit }));
  }
  if (sp.get("type") === "experiments") return NextResponse.json(await listExperiments(sp.get("activeOnly") === "true"));
  if (sp.get("type") === "monitor") return NextResponse.json(await listMonitorSnapshots(sp.get("model") || undefined, Number(sp.get("hours")) || undefined));
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
