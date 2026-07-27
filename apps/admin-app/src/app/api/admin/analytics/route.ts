import { NextResponse } from "next/server";
import { getAnalyticsDashboard } from "@/lib/analytics/service";

export async function GET() {
  const data = await getAnalyticsDashboard();
  return NextResponse.json(data);
}
