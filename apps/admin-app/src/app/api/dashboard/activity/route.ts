import { NextRequest, NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/dashboard/service";

export async function GET(request: NextRequest) {
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 100);
  const data = await getRecentActivity(limit);
  return NextResponse.json(data);
}
