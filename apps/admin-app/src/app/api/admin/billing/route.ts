import { NextResponse } from "next/server";
import { getBillingDashboard } from "@/lib/billing/service";

export async function GET() {
  const data = await getBillingDashboard();
  return NextResponse.json(data);
}
