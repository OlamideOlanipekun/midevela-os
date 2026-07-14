import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getDashboardOverview } from "@/server/dashboard/overview";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const overview = await getDashboardOverview(org.id);
    return NextResponse.json(overview);
  });
}
