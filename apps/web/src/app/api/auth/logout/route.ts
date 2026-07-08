import { NextResponse } from "next/server";
import { destroySession } from "@/server/auth/session";
import { withErrorHandling } from "@/server/http";

export async function POST() {
  return withErrorHandling(async () => {
    await destroySession();
    return NextResponse.json({ success: true });
  });
}
