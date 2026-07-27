import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (refreshToken) {
      await revokeSession(refreshToken);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
