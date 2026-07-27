import { NextResponse } from "next/server";
import { getRevenueAnalytics } from "@/lib/analytics/service";

export async function GET() {
  const data = await getRevenueAnalytics();
  return NextResponse.json(data);
}
