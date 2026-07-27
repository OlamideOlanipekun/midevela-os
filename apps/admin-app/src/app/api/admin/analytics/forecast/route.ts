import { NextRequest, NextResponse } from "next/server";
import { getForecast } from "@/lib/analytics/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const metric = sp.get("metric") || "revenue";
  const period = sp.get("period") || "monthly";
  const data = await getForecast(metric, period);
  return NextResponse.json(data);
}
