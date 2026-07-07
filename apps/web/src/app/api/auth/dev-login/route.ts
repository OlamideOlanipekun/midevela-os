import { NextRequest, NextResponse } from "next/server";

/**
 * Development-only helper: sets the mock auth cookie and redirects,
 * so tools (headless browsers, curl) can reach protected pages in one hop.
 * Returns 404 outside development.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const to = req.nextUrl.searchParams.get("to") || "/dashboard";
  const res = NextResponse.redirect(new URL(to, req.url));
  res.cookies.set("midevela_mock_auth", "true", { path: "/", maxAge: 86400 });
  return res;
}
