import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { getSubscriptionForOrg } from "@/server/billing/subscription";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const subscription = await getSubscriptionForOrg(org.id);
    return NextResponse.json(subscription);
  });
}
