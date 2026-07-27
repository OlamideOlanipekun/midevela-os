import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/dashboard/service";

export async function GET() {
  const data = await getAlerts();
  return NextResponse.json(data);
}
