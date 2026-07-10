import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { listTeamMembers } from "@/server/team/team";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const team = await listTeamMembers(org.id);
    return NextResponse.json({ team });
  });
}
