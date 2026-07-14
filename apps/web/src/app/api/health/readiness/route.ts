import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getReadiness } from "@/server/health/readiness";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const readiness = await getReadiness(org.id);
    return NextResponse.json(readiness);
  });
}
