import { NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { listConversations } from "@/server/conversations/conversations";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const conversations = await listConversations(org.id);
    return NextResponse.json({ conversations });
  });
}
