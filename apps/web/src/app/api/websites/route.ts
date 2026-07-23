import { NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireOrg } from "@/server/auth/context";
import { listMerchantWebsites } from "@/server/website/service";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const websites = await listMerchantWebsites(org.id);
    return NextResponse.json({ websites });
  });
}
