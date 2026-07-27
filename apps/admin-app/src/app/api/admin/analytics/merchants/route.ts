import { NextResponse } from "next/server";
import { getMerchantAnalytics } from "@/lib/analytics/service";

export async function GET() {
  const data = await getMerchantAnalytics();
  return NextResponse.json(data);
}
