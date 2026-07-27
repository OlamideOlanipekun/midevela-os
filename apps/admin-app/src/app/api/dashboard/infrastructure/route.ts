import { NextResponse } from "next/server";
import { getInfrastructureData } from "@/lib/dashboard/service";

export async function GET() {
  const data = await getInfrastructureData();
  return NextResponse.json(data);
}
