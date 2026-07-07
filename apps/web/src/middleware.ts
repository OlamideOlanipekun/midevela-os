import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get('cookie') || '';
  const isSignedIn = cookieHeader.includes('midevela_mock_auth=true');

  // Protect /dashboard/* and /api/* (except public endpoints)
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isProtectedApi = pathname.startsWith('/api') && 
    !pathname.startsWith('/api/auth') && 
    !pathname.startsWith('/api/webhooks') && 
    !pathname.startsWith('/api/public') &&
    !pathname.startsWith('/api/widget') && // widget is embedded on merchant sites, visitors have no auth cookie
    !pathname.startsWith('/api/workspace/subscription'); // allow mock subscription API for easy testing

  if (isDashboardRoute || isProtectedApi) {
    if (!isSignedIn) {
      // Redirect unauthenticated requests to login, preserving intended path
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
};
