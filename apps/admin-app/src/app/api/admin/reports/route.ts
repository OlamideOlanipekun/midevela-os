import { NextRequest, NextResponse } from "next/server";
import { listReports, createReport } from "@/lib/analytics/service";

export async function GET() {
  const data = await listReports();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const report = await createReport(body);
  return NextResponse.json(report, { status: 201 });
}
