import { NextRequest, NextResponse } from "next/server";
import { getQueueDashboard } from "@/lib/queue/service";

export async function GET() {
  const data = await getQueueDashboard();
  return NextResponse.json(data);
}
