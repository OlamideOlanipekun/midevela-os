import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { listCustomers } from "@/server/customers/customers";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const customers = await listCustomers(org.id);
    return NextResponse.json({ customers });
  });
}
