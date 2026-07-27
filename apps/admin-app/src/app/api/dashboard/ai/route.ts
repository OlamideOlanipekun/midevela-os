import { NextResponse } from "next/server";
import { getAIHealthData } from "@/lib/dashboard/service";

export async function GET() {
  const data = await getAIHealthData();
  return NextResponse.json(data);
}
