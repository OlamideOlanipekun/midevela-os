import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getUsageStatus } from "@/server/billing/usage";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const usage = await getUsageStatus(org.id);
    return NextResponse.json(usage);
  });
}
