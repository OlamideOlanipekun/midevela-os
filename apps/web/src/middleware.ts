import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * Fast-path redirect only — checks cookie *presence*, not validity
 * (session tokens are opaque and validated against the DB, which this
 * Edge-capable middleware doesn't touch). Real authorization happens
 * server-side in requireUser()/requireOrg() on every request; this is
 * UX, not the security boundary.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtectedPage =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  if (isProtectedPage && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
