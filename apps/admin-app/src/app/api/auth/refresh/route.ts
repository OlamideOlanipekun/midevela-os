import { NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const device = userAgent ? parseDevice(userAgent) : undefined;
    const browser = userAgent ? parseBrowser(userAgent) : undefined;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const result = await refreshSession(refreshToken, ip, device, browser);
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: result.pair.accessToken,
      refreshToken: result.pair.refreshToken,
      admin: result.session,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseDevice(ua: string): string {
  if (/mobile|android|iphone|ipad/i.test(ua)) return "Mobile";
  return "Desktop";
}

function parseBrowser(ua: string): string {
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
}
