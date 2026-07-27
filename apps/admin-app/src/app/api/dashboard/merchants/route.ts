import { NextRequest, NextResponse } from "next/server";
import { getMerchantGrowthData } from "@/lib/dashboard/service";

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || 30, 180);
  const data = await getMerchantGrowthData(days);
  return NextResponse.json(data);
}
