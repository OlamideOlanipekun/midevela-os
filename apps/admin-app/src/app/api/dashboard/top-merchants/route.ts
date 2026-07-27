import { NextResponse } from "next/server";
import { getTopMerchants } from "@/lib/dashboard/service";

export async function GET() {
  const data = await getTopMerchants();
  return NextResponse.json(data);
}
