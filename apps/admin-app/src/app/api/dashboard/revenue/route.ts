import { NextRequest, NextResponse } from "next/server";
import { getRevenueData } from "@/lib/dashboard/service";

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || 7, 90);
  const data = await getRevenueData(days);
  return NextResponse.json(data);
}
